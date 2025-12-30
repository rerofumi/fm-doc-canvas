# 設計仕様書 (Phase 1)

## 1. システムアーキテクチャ

本アプリケーションは **Wails** フレームワークを使用したハイブリッドアプリケーションである。
UI描画およびユーザーインタラクションは WebView 上の **React** アプリケーションが担当し、ファイルシステムアクセスや外部 API (LLM) との通信といった副作用を伴う処理は **Go** バックエンドが担当する。

### 1.1 全体構成図

```mermaid
graph TD
    User[ユーザー] --> UI[Frontend (React)]
    UI -- Wails Binding --> Backend[Backend (Go)]
    
    subgraph Frontend
        Store[Zustand Store]
        Canvas[React Flow Canvas]
        Drawer[Editor Drawer]
        Prompt[Prompt Bar]
    end
    
    subgraph Backend
        App[App Controller]
        FS[File Service]
        LLM[LLM Service]
        Config[Config Service]
    end
    
    Backend -- Read/Write --> LocalFile[Local File System]
    Backend -- HTTP Request --> ExternalAPI[OpenAI Compatible API]
```

## 2. フロントエンド設計 (React)

### 2.1 技術スタック

*   **Core**: React 18+, TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS
*   **State Management**: Zustand
*   **Canvas Engine**: React Flow (@xyflow/react)
*   **Icons**: Lucide React
*   **Markdown**: react-markdown, remark-gfm

### 2.2 ディレクトリ構造 (想定)

```
frontend/src/
├── components/
│   ├── canvas/
│   │   ├── CustomNode.tsx       # 独自デザインのノード
│   │   ├── CustomEdge.tsx       # 独自デザインのライン
│   │   └── CanvasArea.tsx       # React Flow ラッパー
│   ├── drawer/
│   │   ├── EditorDrawer.tsx     # 左側編集ドロワ
│   │   └── SummaryPanel.tsx     # サマリー表示・生成部
│   ├── ui/                      # 汎用 UI コンポーネント
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── ContextMenu.tsx      # 右クリックメニュー
│   └── layout/
│       ├── Layout.tsx
│       └── PromptBar.tsx        # 下部プロンプト入力
├── store/
│   └── useAppStore.ts           # キャンバス状態・選択状態管理
├── types/
│   └── index.ts                 # 型定義
└── App.tsx
```

### 2.3 データモデル (Frontend)

React Flow のデータ構造を拡張して使用する。

```typescript
/**
 * NOTE: 実行時モデル（React Flow / Zustand で扱う形）と、
 * 永続化モデル（JSONファイルに保存する形）を分離する。
 *
 * - 実行時: UI状態（selected, isDrawerOpen, activeNodeId など）を含む
 * - 永続化: ドメインデータ（content/summary/position/接続）を中心に保存する
 *   => UI状態は保存しない（復元時にデフォルトで初期化）
 */

// ノードが保持するカスタムデータ（永続化対象）
interface NodeData {
  content: string; // 本文テキスト（Markdown）
  summary: string; // サマリー（目安: 約100文字。生成時は config.generation.summaryMaxChars を参照）
}

/** =========================
 *  実行時モデル（Runtime）
 *  ========================= */

// LLM設定など（アプリのローカル設定。キャンバスファイルには APIKey を保存しない）
interface AppConfig {
  llm: {
    baseURL: string; // OpenAI互換APIのBase URL
    model: string;   // 使用モデル名
    apiKey?: string; // 秘匿情報（ローカル設定にのみ保存。キャンバスJSONには含めない）
  };
  generation: {
    summaryMaxChars: number; // サマリー上限文字数（例: 100）
  };
}

// アプリケーション上のノード定義（Runtime）
interface AppNode {
  id: string;
  type: 'customNode'; // カスタムノードコンポーネントを使用
  position: { x: number; y: number };
  data: NodeData;

  /**
   * UI状態（保存しない）
   * - React Flow が内部で管理する選択状態と二重管理しないのが理想だが、
   *   必要に応じて Runtime 側で持ってもよい（保存対象外）。
   */
  selected?: boolean;
}

// ライン（エッジ）定義（Runtime）
interface AppEdge {
  id: string;
  source: string;
  target: string;

  /**
   * UI表現（保存は任意）
   * - 保存ファイルでは省略可能（省略時は復元時にデフォルトを補う）
   */
  type?: 'default' | string; // またはカスタムエッジ
  markerEnd?: { type: string }; // 矢印表示用
}

// Zustand ストアの状態（Runtime）
interface AppState {
  nodes: AppNode[];
  edges: AppEdge[];
  isDrawerOpen: boolean;       // UI状態（保存しない）
  activeNodeId: string | null; // UI状態（保存しない）
  config: AppConfig;           // アプリのローカル設定（別途永続化）

  // Actions
  addNode: (node: AppNode) => void;
  updateNodeContent: (id: string, content: string) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  // ...他
}

/** =========================
 *  永続化モデル（Persisted）
 *  ========================= */

type CanvasFileVersion = '1.0';

interface PersistedNode {
  id: string;
  type: 'customNode';
  position: { x: number; y: number };
  data: NodeData;
}

interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | string;
  markerEnd?: { type: string };
}

interface CanvasFileV1 {
  version: CanvasFileVersion; // '1.0'
  metadata?: {
    lastOpened?: string; // 例: ISO文字列（任意）
  };
  /**
   * キャンバスファイルに含める「非秘匿」設定（任意）
   * - apiKey は含めない（ローカル設定で管理）
   */
  llm?: {
    baseURL?: string;
    model?: string;
  };
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}
```

### 2.4 コンポーネント仕様

#### CustomNode (キャンバス上のノード)
*   **表示**: `data.content` を表示。CSS で `line-clamp-10` 等を指定し、最大10行程度で省略表示する。
*   **スタイル**: Tailwind CSS で枠線、背景色、角丸、シャドウを定義。選択時は枠線色を変更。
*   **ハンドル**: 左右に接続用ハンドルを配置（左: Target, 右: Source）。
*   **操作**: クリックで選択。右クリックでコンテキストメニューを表示し、ノードの削除が可能。

#### CustomEdge (キャンバス上のライン)
*   **表示**: SourceからTargetへの有向線。
*   **操作**: クリックで選択。右クリックでコンテキストメニューを表示し、ラインの削除が可能。
*   **制約**: 接続時に循環参照（ループ）を検知し、発生する場合は接続を拒否してエラーダイアログを表示する。

#### EditorDrawer (編集ドロワ)
*   **制御**: `isDrawerOpen` が true の時、左側からスライドイン。エッジをドラッグしてリサイズ可能。
*   **内容**:
    *   **Toolbar**: Edit/Preview 切り替えトグル。
    *   **Textarea**: `activeNodeId` に対応するノードの `content` を編集。自動保存（onChange または onBlur で Store 更新）。
    *   **Preview**: Markdown レンダリング表示。
    *   **Summary Area**: 下部に固定。サマリーテキストと「再生成」ボタン。

#### PromptBar (AI入力)
*   **入力**: テキストエリアと送信ボタン。
*   **挙動**: 送信時に現在選択されているノード（単数/複数）の内容を収集し結合したものをコンテキストし、プロンプトとともに Backend へリクエストを送る。

## 3. バックエンド設計 (Go)

### 3.1 構造体とメソッド (Wails Binding)

`App` 構造体に以下のメソッドを定義し、フロントエンドから呼び出し可能にする。

```go
type App struct {
    ctx context.Context
    // services...
}

/**
 * Config は「アプリのローカル設定」を表す。
 * - APIKey などの秘匿情報はここで扱う（キャンバスファイルには保存しない）
 * - 保存先は Go の `os.UserConfigDir()` 配下（例: `<UserConfigDir>/fm-doc-canvas/config.json`）を想定
 * - Phase 1 では APIKey は平文で保存する（後続フェーズでOSの資格情報ストア等へ移行検討）
 */
type Config struct {
    LLM LLMConfig `json:"llm"`
    Generation GenerationConfig `json:"generation"`
}

type LLMConfig struct {
    BaseURL string `json:"baseURL"`
    Model   string `json:"model"`
    APIKey  string `json:"apiKey"` // 秘匿情報（キャンバスファイルには含めない）
}

type GenerationConfig struct {
    SummaryMaxChars int `json:"summaryMaxChars"` // 例: 100
}

// 設定関連（ローカル設定）
func (a *App) GetConfig() (Config, error)
func (a *App) SaveConfig(cfg Config) error

// ファイル操作（キャンバスファイル）
// JSON文字列としてキャンバスデータ（CanvasFileV1相当）を受け取りファイルに保存
func (a *App) SaveCanvasToFile(filePath string, jsonData string) error
// ファイルを読み込みJSON文字列（CanvasFileV1相当）を返す（ダイアログ表示含む）
func (a *App) LoadCanvasFromFile() (string, error)

// LLM 操作
// プロンプトとコンテキスト（結合済みテキスト）を受け取り、LLMの応答を返す
func (a *App) GenerateText(prompt string, contextData string) (string, error)
// テキストを受け取り、サマリーを返す
func (a *App) GenerateSummary(text string) (string, error)
```

### 3.2 サービス層

#### LLMService
*   OpenAI 互換 API クライアントの実装。
*   設定（BaseURL, APIKey, Model）を使用してリクエストを送信。
*   システムプロンプトにて「Markdown形式で出力せよ」「簡潔に答えよ」等の基本指示を制御。

#### FileService
*   `wails/v2/pkg/runtime.SaveFileDialog` 等を用いてネイティブダイアログを表示。
*   JSON ファイルの Read/Write。

## 4. LLM 連携ロジック詳細

### 4.1 コンテキスト構築ルール

ユーザーがプロンプト送信ボタンを押した際の処理フロー：

1.  **選択ノードの取得**: Zustand Store から `selected: true` のノードを抽出。
2.  **順序決定**:
    *   選択ノードが1つの場合: そのノードの `content` を使用。
    *   選択ノードが複数の場合:
        *   ノード間に接続（Edge）があるか確認。
        *   接続がある場合、トポロジカルソートまたは接続順（Source -> Target）に従ってテキストを結合。
        *   接続がない場合、あるいは循環がある場合は、配列上の順序（作成順など）またはY座標順などをフォールバックとして使用。
3.  **プロンプト構築**:
    ```text
    Context:
    {結合されたテキスト}

    User Prompt:
    {入力されたプロンプト}
    ```
4.  **Backend 送信**: `GenerateText` を呼び出し。
5.  **応答処理**:
    *   返答テキストを受け取る。
    *   同時に `GenerateSummary` を呼び出し、返答テキストのサマリーを生成（非同期または直列）。
    *   新しいノードを作成し、キャンバス中央または見やすい位置に追加。

### 4.2 サマリー生成
*   LLM生成ノードの場合、生成フローの一環としてサマリー生成を行う。
*   既存ノードの手動サマリー生成ボタン押下時は、対象ノードのテキストのみを送信し、サマリー生成プロンプト（例：「以下のテキストを100文字以内で要約してください」）を実行する。

## 5. データ保存形式 (JSON Schema)

実行時の Zustand / React Flow の状態をそのまま保存せず、**永続化に必要な情報のみ**を保存する。

*   **保存する**: ノード本文/サマリー、ノード位置、エッジ接続、（任意で）エッジ描画に関する最低限の属性
*   **保存しない**: `selected`, `isDrawerOpen`, `activeNodeId` などのUI状態
*   **秘匿情報は保存しない**: `apiKey` はキャンバスファイルに含めず、`GetConfig/SaveConfig` のローカル設定（保存先: `os.UserConfigDir()` 配下）で管理する。Phase 1 では平文で保存する

```json
{
  "version": "1.0",
  "metadata": {
    "lastOpened": "2025-01-01T12:34:56Z"
  },
  "llm": {
    "baseURL": "https://api.example.com/v1",
    "model": "gpt-4o-mini"
  },
  "nodes": [
    {
      "id": "uuid-1",
      "type": "customNode",
      "position": { "x": 100, "y": 100 },
      "data": {
        "content": "Full markdown text...",
        "summary": "Short summary..."
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "uuid-1",
      "target": "uuid-2",
      "type": "default",
      "markerEnd": { "type": "arrowclosed" }
    }
  ]
}
```

### 5.1 Runtime型との対応（重要）
*   `nodes/edges` は永続化モデル（`PersistedNode/PersistedEdge`）として読み書きする
*   Runtimeモデル（`AppNode/AppEdge`）へ復元する際、保存されていないフィールドはデフォルト値で補完する
    *   例: `edge.type` 未指定なら `'default'` を補完
    *   例: UI状態（選択/ドロワ）は初期化（未選択・閉じた状態）
*   **ロード時の正規化**: エッジ接続のSource/Targetハンドル位置が明確な場合（左右配置など）、ロード時に適切な接続位置へ自動補完・正規化を行う。
*   将来拡張のため、未知のフィールドは破棄しても良いが、可能なら読み込み時に無視して処理を継続する（後方互換）

## 6. フェーズ1 実装ステップ

1.  **Frontend基盤構築**:
    *   React, Tailwind, Zustand, React Flow のインストールと設定。
    *   メインレイアウト（Canvas, Drawer, PromptBar）の配置。
2.  **キャンバス基本機能**:
    *   ノード追加、移動、削除。
    *   ノード選択処理。
    *   ライン接続、削除。
3.  **編集機能**:
    *   ドロワの実装。
    *   テキストエリアとStoreの同期。
    *   Markdownプレビュー。
4.  **Backend基盤構築**:
    *   ファイル保存・読み込みの実装。
    *   設定保持機能。
5.  **LLM連携**:
    *   Go側でのHTTPクライアント実装。
    *   Frontendからの呼び出し結合。
    *   サマリー生成の実装。