# Implementation Specification

## Technical Stack

F1〜F3 で Go 判定済みの既存 stack に、Image Variant 契約と Dialogue Vision を追加する。

- Desktop: Wails v2.12.0。
- Backend: Go `main` / `backend`、既存 `ImageGenService` / `ImagePort`、既存 LLM Chat Completions / streaming / tool-call。
- Frontend: React 18、TypeScript、Vite、Zustand、`@xyflow/react`。
- Test: existing domain tests、Go tests / vet、Playwright 1.62.1 Wails E2E。
- New npm / Go module: none。
- New external API: none。画像生成は既存 OpenRouter / OpenAI / Google / xAI。Vision は既存 `GenerateTextWithImages` と同じ `image_url` content parts。

## Design Decisions

1. **Reuse, do not replace**: 新しい画像生成サービスは作らない。`ImagePort.GenerateImage` / `GenerateImageWithProvider` を Dialogue tool と Direct Action の両方から使う。
2. **Generate then place**: Dialogue の `generate_image` は asset を作り、配置は Proposal。tool 成功だけでは document 不変。
3. **Direct Action stays direct**: PromptBar は request-as-approval。生成成功後に atomic Variant を置き、Dialogue へ載せない。
4. **Image Variant, not overwrite**: 元 Image / Text を書き換えず、新しい Image Node + `derived` Relation を作る。
5. **Vision is explicit allowlist**: Dialogue の選択 Image だけ pixel を送る。F1 の metadata-only は除外・未選択・cap 超過に残す。
6. **No auto-regenerate**: 差分説明は AL-0/1。再生成は人間の明示 `generate_image` または PromptBar。
7. **Dialogue uses default provider**: Settings の既定 Image Provider。request-level 切替は PromptBar のみ。failover なし。
8. **Keep V1.3**: provenance に `origin=image` と optional `prompt` を足す。file version は上げない。
9. **Caps**: Vision 3 枚 / run、参照画像 5 枚、image timeout 既存 180s、1 tool call あたり 1 枚。
10. **Physical files persist**: undo / reject は JSON / history だけ戻す。downloadPath のファイルは残す。

## File Structure

### Domain / State

- `frontend/src/domain/workspace.ts`: `Provenance.origin` に `"image"`、optional `prompt`。
- `frontend/src/domain/workspaceCommands.ts`: `applyImageVariant` atomic command（Image Node + derived Relations）。
- `frontend/src/domain/contextResolver.ts`: Dialogue `read` / 画像関連 operation で選択 Image を `image-binary` にする。cap 3。
- `frontend/src/domain/proposal.ts`: Image Variant Proposal の preview / accept / reject。
- `frontend/src/domain/workspacePersistence.ts`: optional provenance field の roundtrip。未採用 Proposal は persist しない。
- `frontend/src/domain/invariants.ts`: image source endpoint、self-relation、scope guard。

### Store / UI

- `frontend/src/store/useAppStore.ts`: Direct Image receipt、`applyImageVariant`、stale / error。
- `frontend/src/store/useChatStore.ts`: Image Proposal event。session / canvas JSON へ pixel を書かない。
- `frontend/src/components/chat/ToolCard.tsx`: `generate_image` の preview（asset path / alt / sources / accept / reject）。
- `frontend/src/components/layout/PromptBar.tsx`: Image Direct Action を Variant command + receipt / undo へ接続。既存 provider selector は維持。
- `frontend/src/components/context/ContextPreview.tsx`: Dialogue の `image-binary` 表示。`metadata only` は除外時だけ。
- `frontend/src/App.tsx`: Direct Image receipt を既存 Direct receipt 面に載せる。
- `frontend/src/types/chat.ts`: `operation: "image-variant"`、Direct Image receipt。

### Backend / Agent

- `backend/ports.go`: `FixtureImage` に last prompt / context / ref count を記録する観測口を追加してよい。新しい port は作らない。
- `backend/agent_loop.go`: `generate_image` tool。ImagePort を注入。配置 Proposal を emit。
- `backend/agent_types.go`: Image Variant Proposal DTO。
- `backend/llm.go` / `streamChat`: 最初の user message に allowlist 済み `image_url` parts を載せられるようにする。Responses API へは移さない。
- `backend/chat_service.go`: ImagePort 配線、Stop / stale / correlation。
- `app.go`: E2E で `FixtureImage` と temp `ImageAssetService` を nil にしない。`GenerateImage*` は既存 binding を維持しつつ domain apply へ寄せる。
- `backend/system_prompt.go`: 画像を見て差分を説明する、自動再生成しない、配置は Proposal、を短く指示。

### Tests / E2E

- `frontend/src/tests/f4ImageVariant.test.ts`（新規）
- `frontend/src/tests/f4VisionContext.test.ts`（新規）
- `backend/f4_image_tool_test.go`（新規）
- `frontend/e2e/ce2e-f4.spec.ts`（新規）: F4-01〜05。既存 harness の temp root / fake provider / cleanup を再利用。

## Data Model

### Provenance extension

```ts
interface Provenance {
  origin: "user" | "file-import" | "llm" | "migration" | "web" | "image";
  sourceNodeIds?: NodeId[];
  operation?: string; // "generate-image"
  provider?: string;
  model?: string;
  createdAt?: string;
  sourceRevisions?: Record<NodeId, number>;
  prompt?: string;
}
```

旧 file は新 field なしで読める。Save は accepted document のみ。

### Image Variant command

```ts
interface ApplyImageVariantInput {
  src: string;
  alt?: string;
  prompt: string;
  provider?: string;
  model?: string;
  sourceNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  proposalId?: string;
  position?: { x: number; y: number };
}
```

- source は Current Canvas の Text-bearing または Image。0 件でもよい（prompt only）。
- 各 source へ `derived` を 1 本。self / missing / off-canvas は atomic fail。
- 失敗時は Node も Relation も残さない。

### Image Variant Proposal

```ts
interface ImageVariantProposal {
  proposalId: string;
  toolCallId: string;
  src: string;
  prompt: string;
  provider?: string;
  model?: string;
  sourceNodeIds: string[];
  sourceRevisions: Record<string, number>;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  runId?: string;
  runEpoch?: number;
}
```

preview は fixture / production とも相対 path と既存 Image Node 表示経路を使う。data URL を Proposal JSON に埋め込まない。

### Vision payload

Dialogue `operation=read`（および画像評価を含む Dialogue send）:

- 選択 Image の先頭 3 件: `{ kind: "image-binary", destination: "llm" }`。
- 4 件目以降: `{ kind: "image-metadata" }` + warning `vision-cap`。
- excluded / off-canvas: 送らない。
- Direct `generate-text`: 現行どおり明示 binary。
- Direct `generate-image`: 現行どおり参照画像を Image Provider へ。

Agent の最初の user content は text + allowlist 済み data URL。tool result や history へ pixel を再掲しない。`read_canvas_node` は allowlist 内なら backend が asset を読み `imageIncluded=true` とするが、同じ run で既に送った ID は再送せず参照だけ返す。

## Commands and Transactions

1. Resolve prompt と allowlist。scope 外本文 / 画像を拒否する。
2. Dialogue: `generate_image` が ImagePort を呼ぶ。成功しても document 不変。`chat:proposal`（image-variant）を出す。
3. Direct Action: ImagePort を呼び、成功したら `applyImageVariant` を 1 history entry で commit。receipt を出す。
4. Accept Proposal: scope / proposalId / source revisions を再検証し、同じ command を commit。
5. 失敗・stale・cap 超過は元状態のまま。物理ファイルが既に書けていても document には載せない。
6. Undo は F2 と同じ history cursor。ファイルは残る。

## UI / Screens

- Dialogue: `generate_image` のあと ToolCard に preview、source 一覧、Accept / Reject。assistant 本文だけに画像を閉じ込めない。
- Direct Action: PromptBar Image モード維持。成功後は既存 Direct receipt に `generate-image applied` と Undo。
- Context Preview: Dialogue で `image-binary → llm` を表示。除外すると metadata に戻る。
- エラー: 設定を開く、prompt を直す、閉じる。暗黙再生成しない。
- PromptBar provider selector は Image Direct Action に残す。Dialogue UI には出さない。

## Agent Contract

- `generate_image`: required `prompt`。optional `source_node_ids`。未指定時は request snapshot の選択 allowlist を使う。hidden body を model に渡させない。
- Tool result は `{ src, prompt, provider, model, proposalId }` の短い JSON。pixel なし。
- `generate_image` は Node / Relation を作らない。配置は人間の Accept または Direct Action。
- 既存 transform / relation / web_search / Artifact tools、max 10 rounds、cancel、correlation は維持する。
- system prompt: 画像を見て差分を説明する。ユーザーが頼まない限り `generate_image` を繰り返さない。
- Direct Action `GenerateImage*` は Agent loop、問い返し、Dialogue append を行わない。

## Persistence

- Keep `version: "1.3"`。optional provenance field のみ追加。
- Save は accepted Node / Relation。pending Image Proposal、data URL、rejected src は保存しない。
- 画像実体は従来どおり JSON 外の相対参照。
- 旧 V1.3 は新 field なしで読める。unknown version は既存 failure no-op。

## Error Handling

User-visible codes:

- `image-unauthorized`
- `image-timeout`
- `image-provider-error`
- `image-invalid-prompt`
- `image-invalid-asset`
- `image-variant-stale`
- `image-source-out-of-scope`
- `vision-cap`

Provider エラーは部分 Node を作らない。生成成功・配置失敗でも document は不変。残留ファイルは NFR-05。

## Requirement Traceability

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-01 | Prompt / context allowlist | `contextResolver.ts`, Image request | domain + F4-01/02 |
| REQ-02 | Dialogue tool | `agent_loop.go`, ImagePort | tool test + F4-01 |
| REQ-03 | Direct Action route | PromptBar, `useAppStore` | F4-02 |
| REQ-04/10 | Proposal lifetime | `proposal.ts`, chat store | F4-01 |
| REQ-05/06 | Variant + provenance | `workspaceCommands.ts` | F4-01/02 |
| REQ-07/08 | Vision payload | resolver, `llm.go`, `read_canvas_node` | F4-03 |
| REQ-09 | Diff explain, no auto-regen | system prompt, fixture LLM | F4-03, E4 |
| REQ-11/12 | Stale / errors | store, chat_service | F4-04/05 |
| REQ-13/16 | UX / Gate | ToolCard, PromptBar | E1/E4 |
| REQ-14/15 | Harness / completion | E2E fixture wiring | F4-01〜05 |
| NFR-01〜05 | deps / txn / allowlist / secrets / files | manifests, commands | E1/E2/E3 |

## Work Packages

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-0 | REQ-14/15 | E2E composition, FixtureImage / temp assets, last-request capture | F1〜F3 baseline green。E2E で ImagePort が非 nil。実ネットワークなし |
| WP-1 | REQ-01/07/10 | resolver, provenance, vision cap | Dialogue 選択 Image が binary、除外は metadata、Save に Proposal なし |
| WP-2 | REQ-04/05/06 | `applyImageVariant`, proposal, persistence | atomic + undo、provenance roundtrip、fault no-op |
| WP-3 | REQ-02/08/09/11/12 | agent tool, ImagePort inject, vision user message, errors | tool 非 mutation、stale、no failover、allowlist pixel |
| WP-4 | REQ-03/13 | PromptBar receipt, ToolCard preview, ContextPreview copy | Direct は Dialogue 非追加。Accept / Undo が UI で完結 |
| WP-5 | REQ-01〜16, NFR-01〜05 | `ce2e-f4.spec.ts`, build, E4 template | F4-01〜05 と plan commands。Gate は別受入 |

## Implementation Order / First Checks

1. **WP-0 — harness first**: `mise run test` / `go vet` を再実行し、E2E の `imageGenService` nil を直す。FixtureImage が決定的 path を返す。
2. **WP-1 — vision / allowlist**: resolver の Dialogue image-binary と cap を pure test で固める。
3. **WP-2 — variant transaction**: `applyImageVariant`、undo、failure injection、V1.3 provenance。
4. **WP-3 — tool and vision payload**: `generate_image`、stale、errors、user message image parts。実 provider 画質は Conditional。
5. **WP-4 — UI**: ToolCard preview と PromptBar receipt。UI から document を直接書き換えない。
6. **WP-5 — vertical acceptance**: F4-01〜05 を `mise run e2e` に追加し、implementer evidence だけ `90_status.md` へ書く。REQ-16 は別 session。

## Verification

- Baseline before implementation: `mise run test` and `mise exec -- go vet ./...`。
- Per WP: domain tests + 対象 Go tests。
- Final: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e`。
- E2E は real provider env が無いこと、temp root cleanup、Dialogue tool 後の Node 数不変、Accept 後の provenance、Direct の session 数不変、stale no-op を assert する。

## Core E2E Scope

### F4-01 — Dialogue generate_image is proposal, then variant

Text Node を 1 つ選んで Dialogue から画像生成する。request は prompt と選択本文だけ。tool 後も Node / Relation 数は不変。Accept で Image Node、`derived`、`origin=image`、one undo を確認する。元 Text は不変。

### F4-02 — PromptBar Direct Action stays direct

PromptBar Image で生成する。Dialogue session 数は不変。Image Variant と receipt Undo がある。request-level provider を変えても Settings 既定は変わらない。

### F4-03 — Vision allowlist and intent/result

Image 2 枚と Text 1 枚を選び、1 枚を除外して Dialogue を送る。payload は除外なし Image だけ binary。fixture LLM は差分説明を返し、無断の `generate_image` は呼ばない。4 枚選択時は 3 枚だけ binary。

### F4-04 — Stale and Stop

生成中に New または Canvas 移動した遅着 Proposal / Direct result は no-op。Stop 後の遅着も配置しない。

### F4-05 — Errors and PromptBar regression

unauthorized / timeout / empty prompt で document 不変。PromptBar Text 生成と既存 F1〜F3 導線が残る。

## F4 Core Gate Review

Separate acceptance は代表的な実課題 1 件で REQ-16 を記録する。

- transfer: 文脈再入力や別画像 tool への移動が減ったか
- grounded use: 意図と結果の差分を同じ机で共有できたか
- control: 元状態、由来、取消、未採用が残っていないことを説明できるか
- friction: Direct Action の待ちや確認が便益を上回らないか
- decision: Go / Hold / Stop と短い理由、再生成ループを試す trigger

telemetry、生成枚数目標、終了アンケートは追加しない。
