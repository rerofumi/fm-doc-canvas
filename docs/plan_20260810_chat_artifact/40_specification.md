# Implementation Specification

## Technical Stack

採用スタック（既存 fm-doc-canvas のものを継承）:

### Frontend

- React 18 + TypeScript 5.x
- Zustand 4.x（既存）
- Tailwind CSS 3.x（既存）
- `@xyflow/react` 12.x（既存、`fm-mindmap` と同じメジャーバージョン）
- `react-markdown` + `remark-gfm`（既存 `EditorDrawer.tsx` で利用中）
- `lucide-react`（既存、アイコン）

### Backend

- Go 1.23+（既存 `go.mod`）
- Wails v2（既存）
- 標準ライブラリ: `net/http`, `encoding/json`, `sync`, `context`
- 追加: なし（外部 SDK / ライブラリ追加は**行わない**）

### LLM

- OpenAI 互換 API（既存 `backend/llm.go` の構造を継承）
- Ollama native tool calling（`fm-image-assistant` の検証済みパターン）

採用判定:
- `Tools []interface{}` フィールドは既存 `backend/llm.go` の `ChatCompletionRequest` で**既に宣言済み** → 新規追加不要。
- `apply_edit` の search/replace は `fm-my-canvas/tools/edit_engine.go` のロジックを**Go に書き写す** → 外部ライブラリ追加不要。

## File Structure

### 新規ファイル

```
frontend/src/
├── components/
│   ├── canvas/
│   │   └── ArtifactNode.tsx              # 新規
│   ├── drawer/
│   │   └── ChatDrawer.tsx                # 新規
│   ├── chat/
│   │   ├── ChatHeader.tsx                # 新規
│   │   ├── MessageList.tsx               # 新規
│   │   ├── MessageBubble.tsx             # 新規
│   │   ├── ToolCard.tsx                  # 新規
│   │   └── ChatInput.tsx                 # 新規
│   └── layout/
│       └── ChatToggleButton.tsx          # 新規
├── store/
│   └── useChatStore.ts                   # 新規
└── utils/
    └── diffUtils.ts                      # 新規（search/replace diff 計算）

backend/
├── chat_service.go                       # 新規
├── system_prompt.go                      # 新規
├── artifacts.go                          # 新規（ArtifactManager 移植）
└── agent/
    ├── loop.go                           # 新規
    ├── events.go                         # 新規
    └── tools/
        ├── tool.go                       # 新規（Tool インターフェース）
        ├── registry.go                   # 新規
        ├── write_artifact.go             # 新規
        ├── apply_edit.go                 # 新規
        ├── read_artifact.go              # 新規
        ├── list_artifacts.go             # 新規
        ├── search_artifact.go            # 新規
        └── edit_engine.go                # 新規（fm-my-canvas から移植）
```

### 変更ファイル

```
frontend/src/
├── types/index.ts                        # ArtifactNodeData, PersistedArtifactNode, CanvasFileV1_2 追加
├── store/useAppStore.ts                  # addArtifactNode, updateArtifactContent, incrementArtifactVersion, setArtifactLastEditSummary アクション追加
├── components/canvas/CanvasArea.tsx      # nodeTypes に artifactNode 追加
├── components/drawer/EditorDrawer.tsx    # activeNode.type === 'artifactNode' 分岐追加
├── App.tsx                               # ChatDrawer 配置、activeNode 連動 useEffect、ヘッダーボタン追加

backend/
└── app.go                                # SendChat, CancelChat メソッド追加
```

## Data Model

### `ArtifactNodeData` (Frontend)

```typescript
export interface ArtifactNodeData extends Record<string, unknown> {
  filename: string;              // "chapter_01.md"
  language: "markdown" | "text";
  content: string;               // ファイル全体
  summary: string;               // カード表示用サマリー
  version: number;               // 編集ごとに increment（apply_edit 確定後のみ）
  charCount: number;             // 文字数
  wordCount: number;             // 単語数（日本語は概算）
  lastEditSummary?: string;      // "冒頭シーンを緊密に"
  lastEditedAt?: number;         // Date.now()
}
```

### `PersistedArtifactNode`

```typescript
export interface PersistedArtifactNode {
  id: string;
  type: "artifactNode";
  position: { x: number; y: number };
  data: ArtifactNodeData;
  width?: number;
  height?: number;
}
```

### `CanvasFileV1_2`

```typescript
export interface CanvasFileV1_2 {
  version: "1.2";
  metadata?: { lastOpened?: string };
  llm?: { baseURL?: string; model?: string };
  nodes: PersistedNode[];    // TextNode | ImageNode | ArtifactNode
  edges: PersistedEdge[];
}

export type CanvasFile = CanvasFileV1_0 | CanvasFileV1_1 | CanvasFileV1_2;
```

### `ChatMessage` / `ToolEvent` / `DiffSegment` (useChatStore)

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolEvents?: ToolEvent[];
  artifactRef?: {
    filename: string;
    nodeId: string;
    version: number;
  };
}

export interface ToolEvent {
  id: string;
  toolName: "write_artifact" | "apply_edit" | "read_artifact" | "list_artifacts" | "search_artifact";
  arguments: Record<string, any>;
  result?: string;
  status: "running" | "done" | "error";
  diff?: DiffSegment[];
  startedAt: number;
  completedAt?: number;
}

export interface DiffSegment {
  type: "context" | "remove" | "add";
  text: string;
}
```

### Backend: `ChatRequest` (Wails binding)

```go
type ChatRequest struct {
    SessionID     string `json:"sessionId"`
    Prompt        string `json:"prompt"`
    TargetNodeID  string `json:"targetNodeId"`
    StylePresetID string `json:"stylePresetId,omitempty"`  // 将来用、本 MVP では未使用
}
```

### Backend: `ChatEvent` (EventsEmit payload)

```go
type ChatEvent struct {
    Type      string         `json:"type"`     // "stream" | "tool_start" | "tool_done" | "done" | "cancelled" | "error"
    Text      string         `json:"text,omitempty"`
    ToolEvent *ToolEvent     `json:"toolEvent,omitempty"`
    Error     string         `json:"error,omitempty"`
}

type ToolEvent struct {
    ID          string                 `json:"id"`
    ToolName    string                 `json:"toolName"`
    Arguments   map[string]interface{} `json:"arguments"`
    Result      string                 `json:"result,omitempty"`
    Status      string                 `json:"status"`     // "running" | "done" | "error"
    Diff        []DiffSegment          `json:"diff,omitempty"`
    StartedAt   int64                  `json:"startedAt"`
    CompletedAt int64                  `json:"completedAt,omitempty"`
}
```

## UI / Screens

### `ArtifactNode.tsx`

- `CustomNode.tsx` の構造を踏襲
- カラースキーム: 既存 Text ノード（青系）と区別するためアンバー系（`bg-amber-50`, `border-amber-200`）
- ヘッダー: ファイル名バッジ (`<FileText>` アイコン + `filename` フォントモノスペース)
- ボディ: `summary`（content の冒頭 100 字）
- フッター: `charCount` 区切り文字付き + `lastEditSummary`
- `Handle` の位置・スタイルは Text ノードと同一にして相互接続を可能にする

### `EditorDrawer.tsx` の追加分岐

- `activeNode.type === 'artifactNode'` の場合:
  - ヘッダー右側に `filename • v{version}` を表示
  - フッターを Summary 欄から `📝 {charCount} chars • v{version}` 表示に切替
  - 編集・プレビューは既存 textarea + react-markdown を再利用

### `App.tsx` のレイアウト

```
<div className="flex flex-col h-screen">
  <SettingsDrawer />     {/* 既存 */}
  <header>               {/* 既存 */}
    [+ Node] [+ Artifact] [Layout] [💬] [�]   {/* + Artifact と 💬 を追加 */}
  </header>
  <main className="flex-1 relative">
    <CanvasArea />       {/* 既存 */}
    <EditorDrawer />     {/* 既存、左ドロワー */}
    <ChatDrawer />       {/* 新規、右ドロワー */}
  </main>
  <PromptBar />          {/* 既存 */}
</div>
```

### `ChatDrawer.tsx`

- `EditorDrawer.tsx` の構造を踏襲
- `fixed top-0 right-0`、`translate-x-full` で非表示
- リサイズハンドルは**左端**（EditorDrawer は右端）
- 幅: デフォルト 420px、最小 320px、最大 `window.innerWidth * 0.8`

### `ChatHeader.tsx`

```
┌─────────────────────────────────�
│ Chat                      [✕]  │
├─────────────────────────────────┤
│ TARGET                          │
│ �─────────────────────────────┐ │
│ │ 📝 chapter_01.md       v3   │ │  ← artifactNode の場合
│ └─────────────────────────────┘ │
│ ─ or ─                          │
│ ┌─────────────────────────────┐ │
│ │ ✨ キャンバス全体            │ │  ← 対象未選択
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ SESSION    [▾ chapter_01] [+New]│
└─────────────────────────────────┘
```

### `MessageList.tsx`

- スクロール追従（最新メッセージで `scrollTop = scrollHeight`）
- 「↓ 最新へ」ボタン（48px 以上スクロールアップ時に表示）
- 空状態: 「会話を始めましょう」プレースホルダ

### `MessageBubble.tsx`

- user: 右寄せ、青背景、白文字
- assistant: 左寄せ、白背景、`react-markdown` レンダリング
- toolEvents があれば MessageBubble の上に ToolCard をスタック表示

### `ToolCard.tsx`

```
┌──────────────────────────────────┐
│ 📝 ファイル作成       [✓]        │
│ chapter_01.md                    │
├──────────────────────────────────┤
│ 📝 差分編集           [✓]        │
│ chapter_01.md                    │
│ - 冷たい石畳の上に倒れていた      │
│ + 薄暗い広間の石畳に倒れていた    │
└──────────────────────────────────┘
```

### `ChatInput.tsx`

- 自動高さ調整 textarea（最大 200px）
- Enter で送信、Shift+Enter で改行
- ストリーミング中は ✕ Stop ボタン
- フッターに「🎭 文体: 標準」ボタン（クリックで将来トグル可能、本 MVP では無効化）

## Inputs

### `SendChat(req: ChatRequest) error`

- 入力検証:
  - `req.Prompt` が空文字列ならエラー
  - `req.TargetNodeID` は空文字列許容（キャンバス全体対象）
- 出力: なし（非同期、`EventsEmit` で結果を送信）

### `CancelChat()`

- 現在のチャットループをキャンセル
- 冪等（複数回呼び出し可能）

## Persistence

### Canvas File（既存 save/load の拡張）

- `saveCanvasToFile` / `loadCanvasFromFile` の `file.go` を更新
- 新規ノード（`artifactNode`）を含めて `version: "1.2"` で書き出し
- 読み込み時にバージョン判定:
  - `version === "1.0" || "1.1"`: そのまま `nodes: PersistedNode[]` にキャスト
  - `version === "1.2"`: そのまま
  - 未知のバージョン: エラー（保存時に警告ダイアログ表示も検討）

### Chat Session（新規）

- 保存先: `~/.config/fm-doc-canvas/chat-sessions.json`（OS 標準）
- フォーマット:
  ```json
  {
    "sessions": [
      {
        "id": "session-xxx",
        "title": "chapter_01.md について",
        "createdAt": 1234567890,
        "messages": [...]
      }
    ]
  }
  ```
- 保存タイミング: メッセージ追加・更新のたびに debounce（500ms）で書き込み

## Error Handling

### Frontend

- `sendChat` の例外: アラート表示 + `finalizeStream` 呼び出し
- Wails イベント欠落: タイムアウト（30 秒）で強制 `finalizeStream`
- Markdown パース失敗: `react-markdown` のデフォルト挙動（エラー箇所を `<code>` で表示）

### Backend

- LLM API エラー: `chat:error` イベント送出 + ループ中断
- ツール実行エラー: `chat:tool_done` (status: "error") を送出し、ループは継続（LLM が次の手でリカバリ可能）
- コンテキストキャンセル: `chat:cancelled` イベント送出 + 正常終了

## Import / Export

- 既存の `exportMarkdown` / `exportNode` / `exportNodesAsMarp` は**変更しない**
- Artifact ノードは Text ノードと同じく `exportMarkdown` でエクスポート可能（content がそのまま Markdown として出力される）

## Environment Constraints

- Wails の `EventsEmit` / `EventsOn` は既存パターン（`fm-image-assistant` の `EventsEmit("llm-event")` で実証済み）
- 既存の `app.go` の `App` 構造体に新メソッドを追加するだけで Wails バインディング自動生成される
- `frontend/wailsjs/go/main/App.d.ts` は自動再生成される（手動編集不要）

## Requirement Traceability

### Sprint A: Artifact ノード

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-A01 | `addArtifactNode` アクション | `useAppStore.ts`, `App.tsx` | UI 操作 |
| REQ-A02 | `ArtifactNodeData` 型 | `types/index.ts` | TypeScript 型チェック |
| REQ-A03 | EditorDrawer 連携 | `EditorDrawer.tsx`, `ArtifactNode.tsx` | UI 操作 |
| REQ-A04 | Edit / Preview 切替 | `EditorDrawer.tsx` (既存実装再利用) | UI 操作 |
| REQ-A05 | ArtifactNode カード表示 | `ArtifactNode.tsx` | UI スクリーンショット |
| REQ-A06 | charCount / wordCount 自動計算 | `useAppStore.ts` (`updateArtifactContent`) | unit test |
| REQ-A07 | V1_2 save/load | `file.go`, `types/index.ts` | save → load ラウンドトリップ |
| REQ-A08 | V1_0/V1_1 後方互換 | `file.go` | 既存ファイル読み込みテスト |
| REQ-A09 | 起動時自動生成 | `App.tsx` (useEffect) | UI 操作 |
| REQ-A10 | Text/Image ノードとの接続 | `ArtifactNode.tsx` (Handle) | UI 操作 |

### Sprint B: 右ドロワーチャット

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-B01 | ChatDrawer 開閉 | `ChatDrawer.tsx`, `ChatToggleButton.tsx` | UI 操作 |
| REQ-B02 | ChatHeader ファイル名表示 | `ChatHeader.tsx` | UI スクリーンショット |
| REQ-B03 | 「キャンバス全体」表示 | `ChatHeader.tsx` | UI スクリーンショット |
| REQ-B04 | セッションセレクタ | `ChatHeader.tsx` | UI 操作 |
| REQ-B05 | セッション新規作成 | `ChatHeader.tsx`, `useChatStore.ts` | UI 操作 |
| REQ-B06 | Enter 送信 | `ChatInput.tsx` | UI 操作 |
| REQ-B07 | typewriter 効果 | `MessageBubble.tsx` | UI スクリーンショット |
| REQ-B08 | Stop ボタン | `ChatInput.tsx`, `app.go` (`CancelChat`) | UI 操作 |
| REQ-B09 | targetNode 自動連動 | `App.tsx` (useEffect) | UI 操作 |
| REQ-B10 | EditorDrawer 閉じ時 null | `App.tsx` (useEffect) | UI 操作 |
| REQ-B11 | SendChat echo スタブ | `app.go`, `chat_service.go` | バックエンドログ |

### Sprint C: エージェントループ

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-C01 | maxSteps=10 | `chat_service.go` | unit test |
| REQ-C02 | 5 ツール実装 | `agent/tools/*.go` | unit test |
| REQ-C03 | apply_edit search/replace | `agent/tools/edit_engine.go` | unit test |
| REQ-C04 | CancellationToken | `chat_service.go` | unit test |
| REQ-C05 | `chat:stream` 送出 | `chat_service.go`, `events.go` | DevTools |
| REQ-C06 | `chat:tool_start` / `chat:tool_done` 送出 | `chat_service.go`, `events.go` | DevTools |
| REQ-C07 | `chat:done` 送出 | `chat_service.go` | DevTools |
| REQ-C08 | システムプロンプト構成 | `system_prompt.go` | 静的検査 |
| REQ-C09 | apply_edit 後のキャンバス反映 | `useAppStore.ts`, `App.tsx` (EventsOn フック) | UI 操作 |
| REQ-C10 | write_artifact 後の新規ノード | `useAppStore.ts`, `App.tsx` | UI 操作 |
| REQ-C11 | diff 表示 | `ToolCard.tsx`, `diffUtils.ts` | UI スクリーンショット |
| REQ-C12 | Ollama 動作確認 | Ollama 環境での実機 | UI 操作 |

### Non-Functional

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-N01 | V1_1 → V1_2 マイグレーション | `file.go` | 既存ファイル読み込みテスト |
| REQ-N02 | 起動時間 | N/A（性能測定のみ） | Performance プロファイル |
| REQ-N03 | ストリーミング中の UI 応答性 | N/A | 体感 + Performance |
| REQ-N04 | wails build 成功 | N/A | build exit code 0 |
| REQ-N05 | ESLint 成功 | N/A | lint exit code 0 |
| REQ-N06 | API キー直書きなし | `backend/config*` | grep |
| REQ-N07 | XSS 安全性 | `react-markdown` | 既知ペイロード |
| REQ-N08 | チャット履歴永続化 | `useChatStore.ts` | 再起動テスト |
| REQ-N09 | maxSteps 暴走防止 | `chat_service.go` | unit test + 仕様定数 |

## Work Packages

実装は Sprint 単位で WP を切る。各 WP は独立して実装・単体検証可能。

### WP-A: Artifact ノード実装（Sprint A）

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-A1 | REQ-A02 | `frontend/src/types/index.ts` | `ArtifactNodeData`, `PersistedArtifactNode`, `CanvasFileV1_2` 型追加、TypeScript 型チェック通過 |
| WP-A2 | REQ-A06, A10 | `frontend/src/components/canvas/ArtifactNode.tsx`, `useAppStore.ts` | ArtifactNode コンポーネント作成、store アクション追加、CanvasArea の nodeTypes 登録 |
| WP-A3 | REQ-A03, A04 | `frontend/src/components/drawer/EditorDrawer.tsx` | artifactNode 分岐追加、Edit/Preview 切替動作 |
| WP-A4 | REQ-A01, A05, A09 | `frontend/src/App.tsx` | ヘッダー「+ Artifact」ボタン、起動時自動生成、`isEditorOpen` 連携 |
| WP-A5 | REQ-A07, A08, N01 | `frontend/src/store/useAppStore.ts`, `backend/file.go` | V1_2 save/load 対応、後方互換確認 |

### WP-B: 右ドロワーチャット実装（Sprint B）

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-B1 | REQ-B01 | `frontend/src/components/drawer/ChatDrawer.tsx`, `ChatToggleButton.tsx` | 右ドロワーの開閉、リサイズ動作 |
| WP-B2 | REQ-B02, B03, B04, B05, B09, B10 | `frontend/src/components/chat/ChatHeader.tsx`, `useChatStore.ts`, `App.tsx` | ヘッダー表示、セッション管理、targetNode 連動 |
| WP-B3 | REQ-B06, B07, B08 | `frontend/src/components/chat/ChatInput.tsx`, `MessageBubble.tsx`, `MessageList.tsx` | 入力・ストリーミング・キャンセル動作 |
| WP-B4 | REQ-B11 | `backend/app.go`, `backend/chat_service.go` | `SendChat`, `CancelChat` スタブ実装（echo） |
| WP-B5 | REQ-N08 | `frontend/src/store/useChatStore.ts` | `~/.config/fm-doc-canvas/chat-sessions.json` への永続化 |

### WP-C: エージェントループ実装（Sprint C）

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-C1 | REQ-C08 | `backend/system_prompt.go` | 役割+ツール指示+応答形式のプロンプト定義 |
| WP-C2 | REQ-C02, C03 | `backend/agent/tools/*.go`, `edit_engine.go` | 5 ツール実装、apply_edit の unit test pass |
| WP-C3 | REQ-C01, C04, C05, C06, C07, N09 | `backend/chat_service.go`, `agent/loop.go`, `agent/events.go` | ループ実装、ストリーミング送出、cancellation |
| WP-C4 | REQ-C05, C06, C07, C09, C10, C11 | `frontend/src/App.tsx` (EventsOn), `useAppStore.ts` (applyToolToCanvas), `ToolCard.tsx`, `diffUtils.ts` | イベント受信 → キャンバス反映、ToolCard diff 表示 |
| WP-C5 | REQ-C12 | N/A（実機検証） | Ollama 環境での動作確認スクリーンショット |

## Verification

### Build & Lint

- `mise x -- wails build` exit code 0
- `mise x -- npm run lint` exit code 0
- `mise x -- go build ./...` exit code 0（明示的な確認）

### Unit Test

- `backend/agent/tools/edit_engine_test.go` の apply_edit テスト（正常系・異常系・複数候補系）が pass
- `backend/chat_service_test.go` の maxSteps=10 テスト + cancellation テストが pass

### Manual E2E

- Sprint A: アプリ起動 → 「+ Artifact」 → Artifact ノード追加 → クリック → EditorDrawer で編集 → プレビュー確認 → 保存 → 再読込
- Sprint B: アプリ起動 → 「💬」 → ChatDrawer 開く → ノードクリック → ChatHeader 表示確認 → メッセージ送信 → SendChat echo 確認
- Sprint C: ノード選択 → チャットで「冒頭を書いて」 → write_artifact ツールカード表示 → ノード更新確認 → 「もっと緊密に」 → apply_edit diff 表示 → ノード v2 更新確認

## Core E2E Scope

`fm-doc-canvas` には E2E テストフレームワークが**未導入**。本 MVP では手動 UI 確認 + DevTools イベントログで代替する。E2E フレームワーク（Playwright 等）の導入は Sprint D 以降の将来課題。

Core E2E REQ IDs: REQ-A01〜A10, REQ-B01〜B11, REQ-C05〜C07, REQ-C09〜C12, REQ-N01
