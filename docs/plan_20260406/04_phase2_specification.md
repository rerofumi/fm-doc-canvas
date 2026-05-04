# 設計仕様書 (Phase 2)

## 1. はじめに

本ドキュメントは Phase 2 の機能拡張に関する設計仕様書である。
Phase 1 の基盤（`docs/02_specification.md`）に加え、画像ノード、画像生成機能、キャンバス整頓機能、およびファイルインポート機能を追加するためのアーキテクチャおよびデータモデルの変更を定義する。

## 2. フロントエンド設計 (React)

### 2.1 コンポーネント追加・変更

#### Canvas Components
*   **ImageNode (新規)**:
    *   `src` 属性（画像ファイルの識別子。`imageGen.downloadPath` 配下からの相対パス）を受け取り、Backend から表示用の Data URL を取得して `<img>` タグで表示する（詳細は「2.4 ローカル画像の表示方式（Wails）」参照）。
    *   選択時スタイル、削除コンテキストメニューは `CustomNode` と同様。
    *   リサイズ機能: `react-resizable` または `react-flow` の NodeResizer を使用して実装を検討。
*   **CanvasArea (変更)**:
    *   Wails Runtime のファイルドロップ機能（`OnFileDrop`）で外部ファイルのドロップを検知する（Web標準の `onDrop` ではローカルの絶対パスが取得できないため採用しない）。
    *   （任意）Wails の drop target 機構（`useDropTarget=true`）を用い、キャンバス領域をドロップターゲットとしてハイライトする。
    *   `nodeTypes` に `imageNode: ImageNode` を登録。

#### UI Components
*   **PromptBar (変更)**:
    *   モード切替トグルスイッチ（Text / Image）を追加。
    *   State として `mode: 'text' | 'image'` を管理。
*   **LayoutButton (新規)**:
    *   ツールバーに追加。クリック時に `dagre` 等のライブラリを用いてノード位置を計算し、`setNodes` で更新する。

### 2.2 データモデル (Frontend)

Phase 1 のモデルを拡張し、Union Type を導入する。

```typescript
/**
 * Phase 2 拡張データモデル
 */

// Text Node Data (Existing)
interface TextNodeData {
  content: string;
  summary: string;
}

// Image Node Data (New)
interface ImageNodeData {
  /**
   * 画像ファイルの識別子（`imageGen.downloadPath` 配下からの相対パス）
   * 例:
   * - "generated_001.png"
   * - "Import/photo.png"
   */
  src: string;
  alt?: string; // 生成プロンプト等
}

// Node Types
type AppNodeData = TextNodeData | ImageNodeData;

// アプリケーション上のノード定義（Runtime）
interface AppNode {
  id: string;
  type: 'customNode' | 'imageNode'; // 'customNode' はテキストノードを指す
  position: { x: number; y: number };
  data: AppNodeData;
  width?: number;  // リサイズ用
  height?: number; // リサイズ用
  selected?: boolean;
}

// 設定モデルの拡張
interface AppConfig {
  llm: {
    baseURL: string;
    model: string;
    apiKey?: string;
  };
  // 新規追加
  imageGen: {
    provider: 'openrouter'; // 固定
    baseURL: string;
    model: string;
    apiKey?: string; // LLMと共有可だが設定としては分離
    /**
     * 画像保存先ディレクトリ
     * - デフォルト: "Image/"（アプリ実行ファイルと同階層を基準に解釈）
     * - 設定値が相対パスの場合: 実行ファイル基準で解決して絶対パス化する（Go側で実施）
     */
    downloadPath: string;
  };
  generation: {
    summaryMaxChars: number;
  };
}
```

### 2.3 状態管理 (Zustand)

*   `nodes` 配列が `TextNode` と `ImageNode` の混合になるため、操作関数（`updateNodeContent` 等）は `type` をチェックするか、`customNode` に対してのみ作用するようにガードする。
*   `activeNodeId` が画像ノードを指している場合、Editor Drawer は「画像プレビュー」または「プロパティ表示」モードになるか、あるいは何も表示しない（編集不可）。Phase 2 では**テキストノード以外選択時はドロワを閉じる**か**読み取り専用**とする。
*   画像表示は Backend からの読み込み（Data URL 変換）を伴うため、必要に応じてフロント側で `src -> dataURL` の簡易キャッシュを導入する（大量画像時の毎回読込を避ける）。

### 2.4 ローカル画像の表示方式（Wails）

Wails のフロントエンド（WebView）から、任意のローカルファイルを `<img src="...">` で直接参照することは環境差・制約が出やすい。
Phase 2 では **「保存はファイル、表示は Data URL」方式** を標準とする。

*   `ImageNode.data.src` は `imageGen.downloadPath` 配下からの相対パス（例: `"Import/foo.png"`）として保存する。
*   表示時は Frontend が `Backend.GetImageDataURL(src)` を呼び出し、`data:image/...;base64,...` を受け取って `<img>` の `src` に設定する。
*   これにより、パス解決や `file://` 制約に依存せず、確実に表示できる。

> 注: 将来的に画像が大量になり Data URL の転送がボトルネックになる場合は、Wails AssetServer のカスタムハンドラ等でローカル画像を配信する方式へ移行を検討する（Phase 2 では必須ではない）。

### 2.5 パス解決ルール（重要）

パスの基準が曖昧だと、生成・インポート・保存/ロードで破綻するため、以下を規約とする。

*   `config.imageGen.downloadPath`
    *   デフォルト値は `"Image/"` とし、「**アプリ実行ファイルと同階層**」を基準に解釈する。
    *   設定値が相対パスの場合、Go 側で実行ファイル基準で解決して絶対パス化して扱う。
*   `ImageNode.data.src`
    *   常に `downloadPath` 配下からの相対パスを保存する（例: `"generated_001.png"`, `"Import/photo.webp"`）。
    *   キャンバスJSONに絶対パスは保存しない（環境移行で壊れるため）。
    *   セキュリティ/堅牢性:
        *   `src` は絶対パスを禁止し、`..` を含む値（パス・トラバーサル）を禁止する。
        *   ロード時も同様に検証し、違反するノードはエラーまたは無視扱いとして処理を継続する。
*   インポート画像の配置
    *   `downloadPath/Import/` を作成し、その配下へコピーする。
    *   `src` には `"Import/<filename>"` を保存する。

## 3. バックエンド設計 (Go)

### 3.1 構造体とメソッド (Wails Binding)

`App` 構造体および `Config` 構造体を拡張する。

```go
type Config struct {
    LLM      LLMConfig      `json:"llm"`
    ImageGen ImageGenConfig `json:"imageGen"` // 追加
    Generation GenerationConfig `json:"generation"`
}

type ImageGenConfig struct {
    Provider     string `json:"provider"`     // "openrouter"
    BaseURL      string `json:"baseURL"`
    Model        string `json:"model"`
    APIKey       string `json:"apiKey"`
    DownloadPath string `json:"downloadPath"` // デフォルト: "Image/"（実行ファイル基準で解決）
}

// 画像生成用メソッド
// プロンプトと（将来的に）参照画像を受け取り、生成された画像の保存先を返す
// 返り値は `downloadPath` 配下からの相対パス（例: "generated_001.png"）
func (a *App) GenerateImage(prompt string, refImages []string) (string, error)

// 画像表示用メソッド（Phase 2 標準）
// `src`（downloadPath 配下からの相対パス）を受け取り、data URL（data:image/...;base64,...）を返す
func (a *App) GetImageDataURL(src string) (string, error)

// ファイルインポート用メソッド
// Wails Runtime のファイルドロップから渡される「絶対パス」を受け取り、必要なら downloadPath/Import/ にコピーして相対パスを返す
// テキストファイルなら内容を読み取って返す
// 返り値: { type: "text"|"image", content: string (text content or src relative path) }
func (a *App) ImportFile(filePath string) (ImportResult, error)
```

### 3.2 サービス層

#### ImageGenService (新規)
*   OpenRouter API (`chat/completions`) へのリクエスト処理。
*   Base64 または URL で返ってきた画像をデコード/ダウンロードし、ローカルファイルシステム (`Config.ImageGen.DownloadPath`) に保存する。
*   ファイル名の重複回避ロジック（UUIDやタイムスタンプ付与）。
*   保存先ディレクトリ解決:
    *   `downloadPath` が相対パスの場合、**実行ファイル基準**で絶対パスに解決してから使用する（例: `os.Executable()` + `filepath.Dir`）。

#### ImageAssetService（新規）
*   **GetImageDataURL**:
    *   `src`（`downloadPath` 配下からの相対パス）を受け取り、画像ファイルを読み込んで `data:<mime>;base64,<...>` を返す。
    *   パス安全性（必須）:
        *   `src` が絶対パスでないことを検証する。
        *   `src` に `..` を含む値（パス・トラバーサル）を拒否する。
        *   `filepath.Clean` 後、`downloadPath` と結合して得られる実体パスが `downloadPath` 配下であることを検証する。
    *   MIME 推定:
        *   拡張子または `http.DetectContentType` 等で MIME を推定し、適切な Data URL を構築する。

#### FileService (拡張)
*   **ImportFile**:
    *   拡張子判定 (`.txt, .md` vs `.png, .jpg, .webp`)。
    *   画像の場合: `Config.ImageGen.DownloadPath/Import/` ディレクトリを作成し、そこへ `io.Copy`。
    *   テキストの場合: `os.ReadFile`。

## 4. 機能実装ロジック

### 4.1 画像生成フロー

1.  Frontend: `PromptBar` で "Image" モード選択 & 送信。
2.  Frontend: 選択ノードからテキストを抽出・結合（Context）。  
    * Phase 2 では画像ノードが選択に含まれていても **参照画像としては渡さない**（空配列）。
3.  Frontend: `Backend.GenerateImage(prompt, images)` をコール（Phase 2 では `images` は空配列）。
4.  Backend:
    *   OpenRouter API (`chat/completions`) へリクエスト（`modalities: ["image","text"]` を含める）。
    *   レスポンスの assistant message から `images` を取得する。
        *   `image_url.url` が **Base64 Data URL**（`data:image/...;base64,...`）の場合: デコードして保存。
        *   `image_url.url` が **http(s) URL** の場合: ダウンロードして保存。
    *   保存先は `config.imageGen.downloadPath`（絶対パス化済み）配下とし、ファイル名は重複回避（UUID/タイムスタンプ等）を行う。
    *   返り値は `downloadPath` 配下からの相対パス（例: `"generated_20250101_123456.png"`）。
5.  Frontend:
    * 返された相対パスを `ImageNode.data.src` に設定して `type: 'imageNode'` を作成し `addNode`。
    * 画像表示は `Backend.GetImageDataURL(src)` を用いて行う（「2.4」参照）。

### 4.2 キャンバス整頓 (Auto-layout)

*   ライブラリ: `dagre` (Directed Acyclic Graph Layout) を使用（軽量で実績あり）。
*   ロジック:
    *   現在の `nodes` と `edges` を dagre graph に変換。
    *   ノードサイズ（幅・高さ）を考慮してレイアウト計算を実行。
    *   計算結果の `x, y` を各ノードに適用し、`setNodes` で更新。
    *   アニメーション（React Flow の `useNodesState` 等のトランジション）を活用するとUXが良い。

### 4.3 ファイルインポート (D&D)

Phase 2 では Web 標準の `onDrop` ではなく、**Wails Runtime のファイルドロップ**を使用する。

前提:
*   Backend（Wails）側でファイルドロップを有効化するため、`options.App` の `EnableFileDrop` を `true` に設定する。

1.  Frontend: Wails Runtime の `OnFileDrop((x, y, paths) => ...)` を登録する。
    * `paths` は **絶対パス配列**。
    * `useDropTarget=true` を使う場合、キャンバス領域をドロップターゲットとしてハイライトできる（任意）。
2.  Frontend: ドロップされた各ファイルについて `Backend.ImportFile(filePath)` をループ実行（非同期）。
3.  Backend: ファイルタイプに応じて処理し、結果（テキスト本文 or `src` 相対パス）を返す。
4.  Frontend: 結果に基づき `TextNode` または `ImageNode` を生成し、ドロップ位置付近に配置する。
    * 位置は `OnFileDrop` の `(x, y)`（ウィンドウ座標）を React Flow の座標系へ変換して用いる（`screenToFlowPosition` 等）。
    * 変換時は Canvas コンテナ要素の `getBoundingClientRect()` を使い、`clientX/clientY` 相当へ補正してから変換する（実装時に統一する）。

## 5. データ保存形式 (JSON Schema Update)

Phase 2 仕様に合わせて更新する。

### 5.1 バージョンと互換性（重要）

*   `version` を `"1.1"` に更新する。
*   `"1.0"`（Phase 1）を読み込む場合:
    * `nodes` は `customNode` のみとして解釈できるため、そのままロード可能。
*   `"1.1"` を Phase 1 アプリ（旧版）で開く場合:
    * `type: "imageNode"` は表示されない（または Unknown Node 扱い）可能性があるが、**クラッシュせずに無視できる**実装が望ましい（推奨）。
*   ロード時の堅牢性:
    * 未知の `type` のノードは、落とす/無視する/Unknown Node 表示のいずれでもよいが、**処理を継続する**こと。
    * 未知フィールドは無視して処理継続（Phase 1 方針を踏襲）。

### 5.2 Image Node の `src` 取り扱い

*   `ImageNode.data.src` は **`imageGen.downloadPath` 配下からの相対パス**を保存する。
*   JSON に絶対パスは保存しない。

```json
{
  "version": "1.1", // バージョンアップ
  "nodes": [
    {
      "id": "text-1",
      "type": "customNode",
      "position": { "x": 0, "y": 0 },
      "data": { "content": "...", "summary": "..." }
    },
    {
      "id": "image-1",
      "type": "imageNode", // 新規タイプ
      "position": { "x": 200, "y": 0 },
      "width": 300,        // オプショナル: サイズ保存
      "height": 200,
      "data": {
        "src": "generated_001.png",
        "alt": "Sunset"
      }
    },
    {
      "id": "image-2",
      "type": "imageNode",
      "position": { "x": 200, "y": 260 },
      "data": {
        "src": "Import/photo.webp",
        "alt": "Imported file"
      }
    }
  ]
  // ...edges, llm config (Phase 1 同様)
}
```

## 6. Phase 2 実装ステップ

1.  **設定・バックエンド拡張**:
    *   `Config` 構造体に `ImageGen` 追加。
    *   `ImageGenService` 実装（OpenRouter 接続、画像保存）。
    *   `ImportFile` メソッド実装。
2.  **フロントエンド基盤拡張**:
    *   `ImageNode` コンポーネント作成。
    *   `PromptBar` にモード切替実装。
    *   D&D ハンドリング実装 (`CanvasArea`)。
3.  **画像生成連携**:
    *   PromptBar から `GenerateImage` 呼び出し。
    *   結果のノード追加処理。
4.  **整頓機能**:
    *   `dagre` 導入。
    *   レイアウト計算ロジック実装。
    *   ツールバーにボタン追加。
5.  **結合テスト**:
    *   テキスト生成と画像生成の切り替え確認。
    *   ファイルのドラッグアンドドロップ確認。
    *   保存・ロード（画像パス解決）の確認。