# Implementation Specification — fm-doc-canvas GUI Update (2026-08-16, amended)

## Technical Context

- React 18 / TypeScript / Zustand / React Flow
- Wails v2
- Existing Chat API: `SendChat`, `CancelChat`, event correlation
- Existing Direct API: Promise based Text / Image generation without cancel contract
- Verification: project `mise.toml` tasks

新規 dependency は導入しない。

## Target Files

```text
frontend/src/
├── App.tsx
├── components/
│   ├── canvas/CanvasArea.tsx
│   ├── chat/ChatHeader.tsx
│   ├── chat/ChatInput.tsx
│   ├── chat/AssistantActionRow.tsx       # new or extracted
│   ├── context/ContextPreview.tsx        # badge-only; rename optional
│   ├── drawer/ChatDrawer.tsx
│   ├── layout/CanvasBreadcrumb.tsx
│   ├── layout/PromptBar.tsx              # delete after migration
│   └── ui/
│       ├── ContextMenu.tsx
│       └── SubCanvasDialog.tsx            # rename / dissolve confirmation
├── domain/
│   ├── workspace.ts
│   └── workspaceCommands.ts
├── store/
│   ├── useAppStore.ts
│   └── useChatStore.ts
├── tests/
└── runtime/e2eBridge.ts

frontend/e2e/*.spec.ts
```

`MoveToCanvasDialog.tsx` と `src/i18n/` は作成しない。

## 1. Header / Breadcrumb / Canvas

### Header

- Remove: `New Workspace`, `Save`, `Load`
- Keep in Settings: Clear Canvas / New Workspace equivalent, Save, Load
- Icon + Text: Undo、Auto Layout、AI Assistant
- Settings は icon button のままでもよいが accessible name を持つ。
- 1280px で折り返さないよう、ロゴ・作成・操作・設定を group 化し gap を調整する。

### Breadcrumb

- Keep: Parent、breadcrumb links、boundary aggregate count
- Remove: `Use this Canvas as context`

### Canvas sizing

- `App.tsx` から `<PromptBar />` を削除する。
- app root は `h-screen flex flex-col`、Canvas wrapper は `min-h-0 flex-1` とし、下端まで React Flow が占有する。

## 2. Unified Assistant State

`useChatStore` を Assistant drawer の runtime state authority として拡張する。Chat session persistence には、default title を reload 後も一意に識別する後方互換な `isDefaultTitle` marker を追加する。旧データに marker がない場合、明示的に default と安全に判定できる title だけを default とし、それ以外は user-defined title として保護する。

```ts
type AssistantMode = "chat" | "direct";
type DirectMode = "text" | "image";
type AssistantOperation =
  | { kind: "chat"; runId: string; sessionId: string }
  | { kind: "direct-text" | "direct-image" | "web-search" | "next-actions"; operationId: string; scope: ScopeSnapshot }
  | null;

interface AssistantRuntimeState {
  mode: AssistantMode;
  directMode: DirectMode;
  draftsByCanvasId: Record<string, string>;
  imageProvider: ImageProvider;
  activeOperation: AssistantOperation;
}
```

### Draft authority

- `ChatInput` の local `useState` と `useAppStore.promptInput` を `draftsByCanvasId[currentCanvasId]` へ統合する。
- `appendPromptInput` を利用する既存導線は active Canvas draft へ追記する。
- `CanvasArea` の context-menu Web検索など `promptInput` を直接読む既存導線も active Canvas draft を参照するよう更新する。
- mode 切替では同じ draft を表示する。
- Canvas 切替では切替先 Canvas の draft を表示し、戻ると以前の draft を復元する。
- submit handler は `Promise<boolean>` を返す。`true` の場合だけ input が draft を消去する。

### Single-operation rule

- `activeOperation !== null` の間、新しい submit / Web search / Next action を開始しない。
- mode、session、provider の切替も無効にする。
- drawer close は operation を cancel しない。
- operation terminal event / finally で、operationId または runId が一致する場合だけ idle へ戻す。

### Direct freshness

Direct 開始時に以下を snapshot する。

```ts
type ScopeSnapshot = {
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  selectionRevision: number;
};
```

- Text / Image result 適用直前に snapshot を現在値と比較する。
- 不一致なら node を作成せず `stale` receipt を表示し、draft を保持する。
- Image は既存 `applyDirectImageVariant` guard を再利用する。
- Text は `addNode` 直呼びをやめ、snapshot を検証してから domain command で対象 Canvas に作成する。
- Direct は backend cancel を提供しない。処理中は spinner + `処理中` を表示し、Stop button は出さない。

## 3. Assistant UI and Action Matrix

### Layout order

1. Title / target / close
2. Chat / Direct tabs
3. Chat only: session selector + New
4. Common: Image Provider
5. Body: Chat timeline or Direct result surface
6. Direct only: Text / Image selector
7. Context badge
8. Shared textarea
9. Shared action row

### Keyboard

- Enter / Shift+Enter: newline
- Ctrl+Enter / Cmd+Enter: submit
- Escape: dialog only。textarea draft は消さない。

### Mode actions

#### Chat

- Submit: existing `SendChat` flow
- Stop: existing local cancel first + `CancelChat`
- Next action: `requestNextActions(activeSession.messages)`
- Web search: user query message を session に追加して `runWebSearch(query, { entryRoute: "dialogue-agent" })`。ToolCard を同 session timeline に表示する。

#### Direct

- Submit Text: migrated PromptBar Text flow + freshness guard
- Submit Image: migrated PromptBar Image flow + existing image stale guard
- Next action: `requestNextActions([])`。Canvas selection / focus / context のみを利用する。
- Web search: `runWebSearch(query, { entryRoute: "direct-action" })`。既存 Context Packet / promote surface を利用する。
- Stop は表示しない。

Image Provider は app config の `config.imageGen.provider` で初期化し、ユーザーがドロワーで変更した後は Assistant runtime state を次回 request の authority とする。ドロワーでの変更は Settings の永続設定を暗黙には書き換えない。

### Session title

- Default title は `新しい会話` または `${target.label} について`。
- session persistence に `isDefaultTitle` を保存し、target の復元順序や reload 時の選択状態に依存せず default title を判定する。
- marker のない旧 session は `新しい会話` の完全一致のみ default として移行し、`〜 について` の suffix 推定は行わない。
- 最初の user message append と同じ store update で一度だけ title を更新する。
- `message.trim().replace(/\s+/g, " ")` を `Array.from(...).slice(0, 24).join("")` で切る。
- user が後に rename できる機能は本計画外。非 default title は上書きしない。
- 既存 chat session save/load path をそのまま使用する。

## 4. Context Badge Simplification

- `ContextPreview` の open state、detail list、checkbox、`setContextExcluded` 呼び出しを削除する。
- badge は `resolveSharedContext(mode, operation)` の payload から Text / Image 件数を算出する。
- badge は button にせず、情報表示 (`role="status"`) とする。
- `excludedNodeIds` は schema compatibility のため field を残してもよいが、app initialization / workspace replacement で必ず `[]` に正規化し、resolver はこの GUI 廃止後の stale exclusion を適用しない。
- `setContextExcluded` command / store API は参照がなくなったことを確認して削除するか deprecated とする。
- regression test: exclude 済み state fixture を読み、node 再選択後に payload に含まれること。

## 5. Parent Lift from SubCanvas

### Entry point

- Current Canvas に parent がある場合だけ、node context menu に `親 Canvas へ移動` を表示する。
- 右クリック node が current selection に含まれる場合は選択一式、含まれない場合は右クリック node だけを対象にする。
- Text、Artifact、Image、FolderNode を対象にできる。FolderNode は subtree ごと移動し、既存 cycle guard を維持する。

### Command application

- `moveNodes` に parent Canvas ID と明示 positions を渡す helper を `useAppStore` に追加する。
- group layout は後述の placement algorithm を使用する。
- Relation endpoint は node ID が変わらないため全て保持する。
- 成功後、current SubCanvas から消えた node ID を selection / active node / focus / explicit mutation target から除去する。
- `N件を親 Canvasへ移動しました` toast と `親 Canvasを開く` action を表示する。自動 navigation はしない。
- 失敗時は document と runtime を変更せず、理由を dialog/toast に表示する。

## 6. Safe SubCanvas Dissolve

### Confirmation data

FolderNode の context menu から `SubCanvasを削除` を選ぶと、次を表示する。

- 引き上げる member 数
- 削除される FolderNode Relation 数
- member Relation は保持されること
- Undo で全体を復元できること

member 0件かつ Folder Relation 0件でも destructive action として確認する。

### Domain command extension

`dissolveSubCanvas` を単一 atomic command として拡張する。

1. Root / missing Canvas を拒否する。
2. member、parent、FolderNode、Folder Relation を事前収集する。
3. member group の parent positions を計算する。
4. member の `parentCanvasId` を parent へ変更する。member が FolderNode なら child Canvas の `parentCanvasId` も更新する。
5. FolderNode endpoint の Relation だけを削除する。
6. FolderNode と child Canvas を削除する。
7. current Canvas、selection、focus、context target を整合させる。
8. document invariant を検証してから commit する。
9. snapshot history 1件を作り、Undo で positions / Canvas / FolderNode / Relations / runtime を復元する。

確認 cancel は command 自体を dispatch しない。

### Placement algorithm

Parent lift と dissolve は同じ純粋 helper を使う。

1. 移動 group の `minX/minY` を求めて相対配置を保持する。
2. Anchor は parent 上の FolderNode position とする。
3. Candidate position は `anchor + (32, 32) + (member.position - min)`。
4. group bounding box が parent の既存 node bounding box と交差する間、group 全体を `(48, 48)` ずつ最大20回移動する。
5. 20回で解消しない場合も最後の決定的位置を使用し、手動で移動可能とする。
6. 同じ入力 document から常に同じ positions を返す unit test を用意する。

## 7. Dialog / Context Menu Accessibility

- `window.prompt` / `window.confirm` は使用しない。
- Rename / Dissolve は dialog component を使用する。
- initial focus、Tab containment、Escape cancel、confirm後の元menu triggerへのfocus return を実装する。
- ContextMenu は viewport 内へ clamp する。
- Rename は trim 後空文字を inline error として拒否する。

## 8. Requirement Traceability

| REQ | Area | Main files | Verification |
| --- | --- | --- | --- |
| REQ-02 | Header | `App.tsx`, `components/layout/*` | Playwright + E3 |
| REQ-03 | Breadcrumb | `CanvasBreadcrumb.tsx` | Playwright + E3 |
| REQ-04 | PromptBar removal / Canvas sizing | `App.tsx`, `PromptBar.tsx` | Playwright + E3 |
| REQ-05 | Assistant state / draft | `useChatStore.ts`, `ChatDrawer.tsx`, `ChatInput.tsx` | store + Playwright |
| REQ-06 | Provider | `ChatHeader.tsx`, `ChatDrawer.tsx`, Direct handler | payload test + Playwright |
| REQ-07 | Action matrix | `AssistantActionRow.tsx`, stores | component + Playwright |
| REQ-08 | Session title | `useChatStore.ts`, chat persistence | store + reload E2E |
| REQ-09 | Context badge | `ContextPreview.tsx`, resolver/runtime normalization | logic + Playwright |
| REQ-10 | Rename | `CanvasArea.tsx`, `SubCanvasDialog.tsx`, command | domain + Playwright |
| REQ-12 | Safe dissolve | `workspaceCommands.ts`, dialog, placement helper | domain + Playwright + Undo |
| REQ-13 | Verification | `mise.toml`, tests, E2E | command output |
| REQ-14 | Parent lift | `CanvasArea.tsx`, `useAppStore.ts`, command/helper | domain + Playwright |
| REQ-15 | Lifecycle / stale | `useChatStore.ts`, Direct handlers | logic + navigation E2E |
| REQ-N01 | Responsive layout | components + E2E | viewport + resize |
| REQ-N02 | Accessibility | menu / dialog / input + E2E | keyboard + focus |

## 9. Work Packages

| WP | REQ IDs | Target | Completion condition |
| --- | --- | --- | --- |
| **WP-1** | REQ-02,03,04,N01 | Header / Breadcrumb / Canvas | PromptBar 不在、Canvas 拡張、1280px 成立 |
| **WP-2** | REQ-10,12,14,N02 | SubCanvas command / menu / dialog | rename、parent lift、relation-aware dissolve、Undo |
| **WP-3** | REQ-05,06,07,08,15,N01,N02 | Unified Assistant | common draft、action matrix、title、freshness |
| **WP-4** | REQ-09 | Context badge / resolver | exclusion UI・stale exclusion解消 |
| **WP-5** | REQ-13 + all active | tests / e2e | build、logic、Playwright、manual UX evidence |

推奨実装順は `WP-2 → WP-3 → WP-4 → WP-1 → WP-5`。SubCanvas command と Assistant state を先に安定させ、最後に PromptBar を外す。

## 10. Verification

```powershell
mise run build
mise run test
mise run e2e
```

### Core E2E additions

1. Chat / Direct tab で draft 保持、Canvas別 draft 復元。
2. Chat submit / cancel、Direct Text / Image submit、operation 中の多重送信拒否。
3. Direct 実行中に Canvas navigation し、late result が適用されない。
4. Chat / Direct の Web search entry route と結果面。
5. 初回 user message title、reload 後の保持。
6. Context badge、legacy exclusion fixture、再選択復帰。
7. 単一・複数 node の parent lift、Relation保持、stale selection不在。
8. 空 / member有 / Folder Relation有 SubCanvas dissolve、cancel no-op、Undo完全復元。
9. 1280x720 header / drawer / action row と keyboard dialog flow。
