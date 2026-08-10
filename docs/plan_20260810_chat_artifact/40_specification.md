# Implementation Specification

## Architecture Decision

### Source of truth

- Canvas の runtime state は Frontend の `useAppStore` を正本とする。
- Artifact は外部 `.md` ファイルではなく Canvas node 内の論理 Markdown 文書である。
- Backend agent は `SendChat` 開始時に受け取った request-local `CanvasSnapshot` を使う。
- snapshot 全体を LLM の初期 prompt へ入れない。`directContextNodeIds` のノードだけを直接文脈へ入れ、その他は tool で必要時に読む。
- Backend tool は Canvas を直接永続化せず、Frontend へ mutation proposal を送る。

### Edit acknowledgment

Artifact 編集は次の hand-shake で処理する。

1. Backend tool が snapshot 内で read 済みの `baseRevision` から編集案を作る。
2. Backend は `chat:tool_apply` event で `runId`, `toolCallId`, `nodeId`, `baseRevision`, diff, proposed content を送る。
3. Frontend は現在の node revision と比較する。
4. 一致すれば Zustand state に適用し、revision/version/count を更新する。不一致または run cancel 済みなら適用しない。
5. Frontend は `ResolveToolApplication` で applied / conflict / cancelled / error を Backend へ返す。
6. Backend は acknowledgment を受けて初めて tool result を LLM へ返し、`chat:tool_done` を送る。

これにより、LLM が「編集済み」と認識したのに Canvas では競合拒否されている状態を防ぐ。

## Technical Stack

既存 stack を継承し、新規外部依存は追加しない。

- Frontend: React 18、TypeScript 5.x、Zustand 5.x、Tailwind CSS 3.x、`@xyflow/react` 12.x、`react-markdown`、`remark-gfm`
- Backend: Go、Wails v2、標準ライブラリ `context`, `net/http`, `encoding/json`, `sync`
- Toolchain: `mise.toml` の task / tools

Ollama / OpenAI-compatible tool calling の provider/model ごとの差異は実装前 research で確認し、未検証 model を一律に対応済みとは扱わない。

## File Structure

### New files

```text
frontend/src/
├── components/canvas/ArtifactNode.tsx
├── components/drawer/ChatDrawer.tsx
├── components/chat/
│   ├── ChatHeader.tsx
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── ToolCard.tsx
│   └── ChatInput.tsx
├── components/layout/ChatToggleButton.tsx
├── store/useChatStore.ts
├── types/chat.ts
├── utils/chatContext.ts
└── utils/diffUtils.ts

backend/
├── chat_service.go
├── chat_session.go
├── canvas_snapshot.go
├── system_prompt.go
└── agent/
    ├── loop.go
    ├── events.go
    └── tools/
        ├── tool.go
        ├── registry.go
        ├── run_state.go
        ├── write_artifact.go
        ├── apply_edit.go
        ├── read_artifact.go
        ├── list_artifacts.go
        ├── search_artifact.go
        ├── list_canvas_nodes.go
        ├── read_canvas_node.go
        └── edit_engine.go
```

### Modified files

```text
frontend/src/types/index.ts
frontend/src/store/useAppStore.ts
frontend/src/components/canvas/CanvasArea.tsx
frontend/src/components/canvas/CustomNode.tsx
frontend/src/components/canvas/ImageNode.tsx
frontend/src/components/drawer/EditorDrawer.tsx
frontend/src/App.tsx
backend/file.go
app.go
```

Wails binding はルート `app.go` に追加し、生成物 `frontend/wailsjs/` は Wails に再生成させる。

## Data Model

### Artifact node

```typescript
export interface ArtifactNodeData extends Record<string, unknown> {
  filename: string;
  language: "markdown" | "text";
  content: string;
  summary: string;
  version: number;   // UI に表示する確定編集 version
  revision: number;  // 全 content mutation で増える競合検出用 counter
  charCount: number;
  wordCount: number;
  lastEditSummary?: string;
  lastEditedAt?: number;
}
```

既存 `TextNodeData` には `revision?: number` を追加する。旧 Canvas で欠落している場合は runtime load 時に 0 として扱う。Text は user-facing version を持たず、全 content mutation で revision を増加する。

- `revision` は手動入力を含む全 content mutation で単調増加する。
- `version` は EditorDrawer の編集確定または agent edit の適用成功時に増加する。
- agent event の競合判定には `revision` を使い、表示用 `version` だけでは判定しない。
- `filename` は Canvas 内表示名兼 export の既定名であり、外部ファイル path ではない。

### Canvas file

```typescript
export interface CanvasFileV1_2 {
  version: "1.2";
  metadata: {
    canvasId: string;
    lastOpened?: string;
  };
  llm?: { baseURL?: string; model?: string };
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}
```

- 新規 Canvas 生成時に UUID 相当の `canvasId` を作る。
- V1.0 / V1.1 に `canvasId` がない場合は runtime load 時に作り、次回 save で V1.2 に保存する。
- load だけでは元ファイルを書き換えない。

### Request-local Canvas snapshot

```go
type NodeSnapshot struct {
    ID       string `json:"id"`
    Type     string `json:"type"` // text | artifact | image
    Revision int64  `json:"revision"`
    Version  int64  `json:"version"`
    Filename string `json:"filename,omitempty"`
    Markdown string `json:"markdown,omitempty"`
    ImageRef string `json:"imageRef,omitempty"`
    Prompt   string `json:"prompt,omitempty"`
}

type EdgeSnapshot struct {
    Source string `json:"source"`
    Target string `json:"target"`
}

type CanvasSnapshot struct {
    CanvasID string         `json:"canvasId"`
    Nodes    []NodeSnapshot `json:"nodes"`
    Edges    []EdgeSnapshot `json:"edges"`
}
```

Text / Artifact は `Markdown`、Image は `ImageRef` と `Prompt` を設定する。画像 binary は snapshot に複製せず、vision 対応 provider へ渡す時だけ既存 image storage から解決する。

### Chat request

```go
type ChatRequest struct {
    RunID                string         `json:"runId"`
    SessionID            string         `json:"sessionId"`
    CanvasID             string         `json:"canvasId"`
    Prompt               string         `json:"prompt"`
    TargetNodeID         string         `json:"targetNodeId,omitempty"`
    DirectContextNodeIDs []string       `json:"directContextNodeIds"`
    Snapshot             CanvasSnapshot `json:"snapshot"`
}
```

- `RunID` は Frontend が送信ごとに生成する。
- `DirectContextNodeIDs` は `traverseContextBackwards` の結果順とし、target を末尾に含む。
- target がない場合は空配列にする。
- Backend は `CanvasID`, node ID、edge endpoint の整合を検証する。

### Chat event

```go
type ChatEvent struct {
    RunID       string             `json:"runId"`
    SessionID   string             `json:"sessionId"`
    Type        string             `json:"type"`
    Text        string             `json:"text,omitempty"`
    ToolEvent   *ToolEvent         `json:"toolEvent,omitempty"`
    Apply       *ToolApplyProposal `json:"apply,omitempty"`
    Error       string             `json:"error,omitempty"`
}

type ToolApplyProposal struct {
    ToolCallID     string `json:"toolCallId"`
    NodeID         string `json:"nodeId,omitempty"`
    BaseRevision   int64  `json:"baseRevision,omitempty"`
    Operation      string `json:"operation"` // create | replace | edit
    Filename       string `json:"filename,omitempty"`
    Proposed       string `json:"proposed"`
    LastEditSummary string `json:"lastEditSummary,omitempty"`
}
```

全 event は `runId/sessionId` で route する。mutation event は `toolCallId/nodeId/baseRevision` でも相関する。

### Chat session persistence

```json
{
  "version": 1,
  "canvases": {
    "canvas-id": {
      "sessions": [
        {
          "id": "session-id",
          "title": "chapter_01.md について",
          "createdAt": 0,
          "updatedAt": 0,
          "messages": []
        }
      ]
    }
  }
}
```

各 message は送信時の `runId`, `targetNodeId`, `targetVersion` を任意項目として保持する。

## Context Construction

### Direct context

`frontend/src/utils/chatContext.ts` は次を行う。

1. `activeNodeId` かつ `isEditorOpen` の時だけ target を設定する。
2. `traverseContextBackwards(targetNodeId, nodes, edges)` を呼ぶ。
3. 返された順序を保ち、nodeId を重複排除する。
4. branch / loop warning を request metadata と UI warning に残す。
5. Text / Artifact は Markdown source、Image は imageRef と prompt を snapshot 化する。

直接コンテキストは target と接続元だけであり、Canvas の非接続ノード本文は含めない。

### On-demand context

`list_artifacts`, `search_artifact`, `list_canvas_nodes`, `read_canvas_node` は request-local snapshot を読む。tool が読んだ内容だけを tool result として LLM へ追加する。

- `list_canvas_nodes`: 全 node の nodeId、type、短い識別情報。本文と画像 binary は返さない
- `read_canvas_node(text/artifact)`: nodeId、type、Markdown、version/revision
- `read_canvas_node(image)`: nodeId、type、imageRef、prompt。vision 非対応 model では prompt と `imageIncluded=false` を返す
- snapshot は run 中に固定し、Frontend の後続変更は取り込まない

後続変更による stale write は revision acknowledgment で拒否する。

## Tool Contracts

### `read_artifact`

- Input: `node_id`
- Success: filename、content、version、revision
- Error: node 不存在、artifact 以外
- 成功時に run state へ read revision を記録する。

### `apply_edit`

- Input: `node_id`, `search_text`, `replacement`, `edit_summary`
- Target: Text または Artifact
- Preconditions: 同じ run で `read_canvas_node(node_id)` または `read_artifact(node_id)` が成功し、同じ revision を読んでいる
- 一致 1 件だけを置換する。0 件・複数件では変更しない。
- mutation proposal の acknowledgment が applied の時だけ success を返す。

### `write_artifact`

- Input: `node_id?`, `filename?`, `content`, `edit_summary`
- `node_id` あり: read 済み revision を要求し、全体置換 proposal を作る。
- `node_id` なし: 元の user prompt が新規文書の作成を明示している時だけ新規作成 proposal。作成指示が曖昧なら tool を実行せず確認を求める。filename がなければ衝突しない既定名を提案する。
- filename 重複時は nodeId で識別し、暗黙に既存 node を上書きしない。

### `list_artifacts`

- Input: なし
- Output: nodeId、filename、version、charCount
- content 全文は返さない。

### `search_artifact`

- Input: `query`, `node_ids?`, `max_results?`
- Output: nodeId、filename、match offset、前後の短い snippet
- 空 query は error。結果件数に上限を設ける。

### `read_canvas_node`

- Input: `node_id`
- Output: node type に応じた Markdown または imageRef + prompt
- `read_canvas_node` 自体は読み取り専用。Text の変更は `apply_edit`、Artifact の変更は `apply_edit` / `write_artifact` を使い、Image を変更する tool は MVP に含めない。

### `list_canvas_nodes`

- Input: `types?`
- Output: nodeId、type、Artifact filename / Text 先頭 / Image prompt 先頭の短い識別情報
- Markdown 全文と画像 binary は返さない。
- Canvas 上の任意ノードを `read_canvas_node` で指定するための index として使う。

## Agent Loop

1. direct context と user prompt を message に構成する。
2. provider へ tool definitions とともに送信する。
3. assistant text は `chat:stream` で送る。
4. tool call は `chat:tool_start` を送って実行する。
5. mutation tool は Frontend acknowledgment を待つ。timeout は 10 秒とし、cancel と連動する。
6. tool result を conversation に追加して次 round へ進む。
7. 最大 10 tool round、または tool call のない assistant response で終了する。
8. run ごとに `done/cancelled/error` のいずれか 1 件だけを送る。

`ChatService` は active run を `map[runID]cancelFunc` で管理する。同一 session の同時 run は禁止し、別 session の run は `runId` で独立して route できる。

## Wails Bindings

ルート `app.go` に追加する。

```go
func (a *App) SendChat(req backend.ChatRequest) error
func (a *App) CancelChat(runID string) error
func (a *App) ResolveToolApplication(result backend.ToolApplicationResult) error
func (a *App) LoadChatSessions(canvasID string) ([]backend.ChatSession, error)
func (a *App) SaveChatSessions(canvasID string, sessions []backend.ChatSession) error
```

- `SendChat` は request validation 後に非同期 run を開始する。
- `CancelChat` は指定 run だけを冪等に中断する。
- `ResolveToolApplication` は待機中の toolCallId に 1 回だけ応答できる。
- session persistence は Frontend から debounce 500ms で呼ぶ。

## UI / Store Behavior

### ArtifactNode / CustomNode

- `react-markdown` + `remark-gfm` で本文 preview を表示する。
- 大きい本文は表示文字数を制限し、全内容は EditorDrawer で扱う。
- Artifact は filename/version/charCount を追加表示する。

### ImageNode

- 既存画像表示を維持し、prompt 表示と copy button を保証する。

### ChatDrawer

- default 420px、min 320px、max viewport 80%。
- ChatHeader は target type に応じた識別情報を表示する。
- session switch と target switch は独立させる。
- event は `runId/sessionId` が一致する message にだけ反映する。
- 背景 session の run event は対応 session に保存し、現在表示中 session へ混入させない。

### ToolCard

- running / applied / conflict / cancelled / error を区別する。
- diff は Backend proposal の search/replacement から生成した構造を表示する。
- acknowledgment 前に成功表示にしない。

## Persistence

### Canvas

- V1.0 / V1.1 は runtime へ読み込む。
- 次回 save で V1.2、canvasId、Artifact data を保存する。
- Artifact の source text が保存・再読込で一致することを test する。

### Chat sessions

- 保存先は Wails のアプリ設定ディレクトリ配下 `chat-sessions.json` とし、`~` の文字列連結ではなく OS API /既存 config path 解決を使う。
- Backend が JSON encode/decode と filesystem I/O を担当する。
- Canvas ごとに `canvasId` で分離する。
- malformed JSON はエラーとして返し、空履歴として黙って上書きしない。

## Error Handling

- invalid request: run を開始せず呼出し元へ error
- provider error: `chat:error`
- tool validation error: `chat:tool_done(status=error)` とし、LLM が再試行可能
- apply conflict: Frontend は変更せず conflict acknowledgment、Backend は conflict tool result を LLM へ返す
- apply timeout: error 扱い、変更なし
- cancel: 待機中 HTTP/tool acknowledgment を解除し、以後の proposal を適用しない
- unknown event/run/session: Frontend は無視して diagnostic log を残す

## Import / Export

- Text / Artifact は `ExportMarkdown` で source text を `.md` へ保存する。
- Artifact filename は save dialog の既定名に使うが、選択先を強制しない。
- 外部 `.md` との常時同期、watch、双方向更新は行わない。
- 既存 Image export と Marp export は維持する。

## Requirement Traceability

| Area | REQ IDs | Main files |
| --- | --- | --- |
| Node model / Markdown / export | REQ-A01〜A14 | `types/index.ts`, node components, `EditorDrawer.tsx`, `useAppStore.ts`, `backend/file.go` |
| Chat UI / focus / session | REQ-B01〜B10, REQ-B12 | `ChatDrawer.tsx`, `components/chat/*`, `useChatStore.ts`, `App.tsx` |
| Tools / loop | REQ-C01〜C12, REQ-C18 | `backend/agent/*`, `chat_service.go`, `system_prompt.go` |
| Direct / on-demand context | REQ-C13〜C15, REQ-C19 | `chatContext.ts`, `canvas_snapshot.go`, `list_canvas_nodes.go`, `read_canvas_node.go` |
| Event correlation / conflict | REQ-C09, REQ-C16, REQ-C17, REQ-C20, REQ-B08 | `events.go`, `App.tsx`, `useAppStore.ts`, `chat_service.go` |
| Compatibility / quality / persistence | REQ-N01〜N08, REQ-N10 | `backend/file.go`, `chat_session.go`, build and manual checks |

## Work Packages

| WP | REQ IDs | Target | Completion condition |
| --- | --- | --- | --- |
| WP-A1 | REQ-A01〜A06, A09〜A11, A14 | Artifact/Text types, node UI, EditorDrawer, store | Markdown 表示・編集・revision・count・初期化 test/確認 |
| WP-A2 | REQ-A07, A08, A12, N01 | Canvas persistence / export | V1 fixtures と V1.2 roundtrip pass |
| WP-A3 | REQ-A13 | ImageNode | prompt 表示・copy 確認 |
| WP-B1 | REQ-B01〜B07, B09, B10, B12 | Chat UI / store | target と session が独立して動作 |
| WP-B2 | REQ-N08, N10 | chat session backend/store | Canvas 別再起動復元 pass |
| WP-C1 | REQ-C13〜C15, C19 | snapshot / context tools | direct/on-demand context test pass |
| WP-C2 | REQ-C02, C03, C08, C18 | tools / prompt / run state | tool contract test pass |
| WP-C3 | REQ-C01, C04〜C07, C12 | loop / provider / event | loop/cancel/event/実機確認 |
| WP-C4 | REQ-B08, C09〜C11, C16, C17, C20 | acknowledgment / Frontend apply | apply/conflict/cancel test pass |
| WP-QA | REQ-N02〜N07 | quality checks | plan-defined evidence recorded |

## Verification

### Automated commands

- `mise run build`
- `mise x -- npm --prefix frontend run build`
- `mise x -- go test ./...`

### Required tests

- Canvas V1 fixtures / V1.2 roundtrip
- Artifact count / revision / version
- graph context order / branch / loop
- seven tool contracts and read-before-write rule
- max round / context cancellation / terminal event uniqueness
- run/session routing
- apply acknowledgment success / conflict / cancel / timeout
- session persistence and canvasId isolation

## Core E2E Scope

`30_requirement.md` の Core E2E 1〜9 を実施する。UI は手動 E2、状態遷移と event routing は E1 test を証拠とする。Playwright 等の追加は本計画の対象外。
