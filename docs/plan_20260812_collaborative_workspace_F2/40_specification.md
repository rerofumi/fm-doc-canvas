# Implementation Specification

## Technical Stack

F1 で Go 判定済みの既存 stack のみを採用する。

- Desktop: Wails v2.12.0。
- Backend: Go `main` / `backend`、既存 LLM Chat Completions / streaming / tool-call contract。
- Frontend: React 18、TypeScript、Vite、Zustand、`@xyflow/react`、既存 Markdown renderer。
- Test: existing domain tests、Go tests / vet、Playwright 1.62.1 Wails E2E。
- New dependency: none。

## Design Decisions

1. **Non-destructive first**: F2 の生成物は source を上書きせず、派生 Text Node として作る。
2. **Structured Proposal**: LLM の自由文を解釈して mutation しない。source IDs、base revisions、operation、content、Relation proposal を構造化 DTO で扱う。
3. **Atomic apply**: 派生 Node と自動 `derived` Relation は一つの command transaction / history entry にする。
4. **Current Canvas boundary**: 入力・出力 placement は Current Canvas。Relation endpoint が別 Canvas の場合は明示 target と scope validation を要求する。
5. **V1.3 compatible extension**: accepted Relation の optional `reason` と transform provenance は V1.3 の既存形を壊さず追加する。strict parser / downstream compatibility を壊す version bump は No-Go。
6. **Text-only transform**: F4 の multimodal と混同しないため、F2 の content generation は Text-bearing Node の Markdown / text のみを扱う。
7. **Human spatial feedback without inference**: Current Canvas で人間が変更した Node position を明示 `spatialHints` として resolver payload に含めるが、位置だけから Relation、group、優先度、因果を自動確定しない。
8. **Entry-specific approval**: Dialogue / Agent は structured Proposal と decision を使う。明示 Direct Action は user action 自体を approval とし、追加 Proposal / Dialogue 履歴を作らず、同じ validation / atomic command / provenance / stale / undo を使う。
9. **Comparison appropriate to entry**: Dialogue / Agent は apply 前の source-output comparison、Direct Action は apply 後の change summary / source-output diff を示す。

## File Structure

### Domain / State

- `frontend/src/domain/workspace.ts`: `RelationRecord` の reason / transform provenance に必要な optional fields、transform request / proposal の型。
- `frontend/src/domain/workspaceCommands.ts`: `applyTransform`、Relation create/update/remove、atomic history / revision / invariant validation。
- `frontend/src/domain/proposal.ts`: `create-derived-text`、`add-relation`、transform metadata を含む Proposal operation と decision apply。
- `frontend/src/domain/transform.ts`（新規）: operation arity、source revision snapshot、request body、draft normalization、preview model。
- `frontend/src/domain/invariants.ts`: self relation、missing endpoint、invalid kind、cross-scope、duplicate / stale relation の検証。
- `frontend/src/domain/contextResolver.ts`: accepted typed Relation、derived provenance、Current Canvas の明示 `spatialHints` を次の context / relation target に含める規則。
- `frontend/src/domain/workspacePersistence.ts`: V1.3 optional relation / provenance fields の serialize / parse / roundtrip。

### Store / UI

- `frontend/src/store/useAppStore.ts`: transform request lifecycle、atomic command dispatch、relation actions、proposal decision、error / stale feedback。
- `frontend/src/components/canvas/CanvasArea.tsx`: multi-selection、transform / relate action entry、relation edge interaction。
- `frontend/src/components/ui/ContextMenu.tsx`: `Summarize`、`Compare`、`Counterpoint`、`Add Relation` の current selection action。
- `frontend/src/components/proposal/TransformProposalCard.tsx`（新規）: source / operation / preview / provenance / relation preview、Accept / Modify / Reject / Stop。
- `frontend/src/components/proposal/TransformComparison.tsx`（新規、または既存 Markdown renderer の組合せ）: source ごとの識別を保つ apply 前 comparison と Direct Action の post-apply diff / change summary。
- `frontend/src/components/proposal/RelationProposalCard.tsx`（新規、または既存 `ToolCard.tsx` 拡張）: kind / direction / reason の採否・変更。
- `frontend/src/components/canvas/RelationEdge.tsx`（新規、または既存 edge 拡張）: Relation kind の label / selected detail / direction。既存 boundary aggregate を壊さない。
- `frontend/src/components/context/ContextPreview.tsx`: accepted Relation と derived source の表示、unaccepted proposal の除外。
- `frontend/src/types/chat.ts`: transform / relation proposal event、tool correlation DTO。

### Backend / Agent

- `backend/agent_types.go`: structured transform / relation proposal DTO、source revision map、optional reason / provenance。
- `backend/agent_loop.go`: `propose_transform`、`propose_relation` tool definition / validation / execution。既存 read-before-mutate と max 10 rounds を維持。
- `backend/transform_service.go`（新規、または既存 LLM service の thin adapter）: Direct Action 用の one-shot structured transform。Agent loop、問い返し、追加 tool round、Dialogue append を行わず、一回の provider request を validated `TransformDraft` に変換する。
- `backend/canvas_snapshot.go`: Text-bearing source snapshot、current scope、Relation metadata、selected / active Node の position hint の immutable read model。
- `backend/chat_service.go`: proposal event の correlation、Stop / stale / acknowledgement の既存 handshake を拡張。
- `app.go`: Dialogue / Agent event と区別できる Direct Action bound method / DTO の追加。既存 `generateText` / Chat API の互換を維持。

### Tests / E2E

- `frontend/src/tests/f2Transform.test.ts`（新規）: arity、request allowlist、derived atomic apply、provenance、undo。
- `frontend/src/tests/f2Relation.test.ts`（新規）: kind、direction、reason、self / missing endpoint、projection、undo。
- `backend/f2_transform_test.go`（新規）: tool schema、snapshot scope、structured proposal、revision / stale、fake LLM response。
- `backend/f2_direct_transform_test.go`（新規、または上記へ統合）: one-shot provider call、no Agent round / Dialogue append、DTO failure no-op、direct receipt。
- `frontend/e2e/ce2e-f2.spec.ts`（新規）: F2-01〜F2-04。
- `frontend/e2e/helpers.ts` / `run-e2e.mjs`: F1 harness の temp root / fake provider / cleanup を再利用し、real network を禁止する。

## Data Model

### Transform request / draft

```ts
type TransformOperation = "summarize" | "compare" | "counterpoint";

interface TransformRequest {
  operation: TransformOperation;
  sourceNodeIds: string[];
  sourceRevisions: Record<string, number>;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  contextDigest: string;
  instruction?: string;
}

interface TransformDraft {
  operation: TransformOperation;
  sourceNodeIds: string[];
  sourceRevisions: Record<string, number>;
  content: string;
  summary: string;
  reason?: string;
  suggestedRelations: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    kind: "source" | "derived" | "supports" | "opposes" | "similar";
    reason?: string;
  }>;
  provenance: Provenance;
}
```

The UI may allow editing `content`, `summary`, Relation kind / direction, and reason before apply. Draft normalization rejects missing sources, empty content, invalid kind, and revision mismatch.

### Spatial context hint

```ts
interface SpatialContextHint {
  nodeId: string;
  canvasId: string;
  position: { x: number; y: number };
  selected: boolean;
}
```

- Resolver は Current Canvas の request 対象となる selected / active Node だけを安定した Node ID と position の組で出力する。
- 別 Canvas の座標、hidden body、未採用 Proposal の placement は暗黙に含めない。
- `spatialHints` は観測情報であり、Relation / group / ranking / causal semantics ではない。semantic Relation は既存の明示 Relation model だけで表す。
- Node move 後の次 request で hint が更新されることを resolver test と F2-04 で確認する。

### Relation

`RelationRecord.status` remains `accepted` for persisted document records. A Proposal has its own lifecycle; rejected / stale / unaccepted candidates are not inserted into `WorkspaceDocument.relations`.

```ts
interface RelationRecord {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: "context" | "source" | "derived" | "supports" | "opposes" | "similar";
  status: "accepted";
  reason?: string;
  provenance?: Provenance;
  presentation?: { sourceHandle?: string; targetHandle?: string };
  extensions?: Record<string, unknown>;
}
```

`context` is retained for F1 legacy / Context Resolver behavior. F2 UI offers the five F2 kinds, with `derived` automatically suggested for a transform output.

### Proposal operation

Extend `ProposalRecord.operation` with:

- `create-derived-text`: one output Text / Artifact role, source IDs, source revisions, operation, content, summary, optional filename, suggested Relation list, provenance.
- `add-relation`: source / target IDs, relation kind, direction, reason, source revisions, provenance.

The proposal envelope retains `proposalId`, provider tool call ID, run / scope correlation, `decisionId`, `receiptId`, and resulting node / relation IDs. The same `decideAndApplyProposal` path handles Dialogue / Agent の Accept / Modify / Reject / Cancel。Direct Action は ProposalRecord を作らず、entry route と user action correlation を持つ direct receipt を返す。

## Commands and Transactions

1. Resolve the shared Context and validate source arity / current scope。Current Canvas の selected / active source について `spatialHints` を capture する。
2. Capture source revisions and create a transform request。entry route を `dialogue-agent` / `direct-action` として相関付ける。
3. `dialogue-agent` は draft / structured Agent Proposal を受け取り、document を変更せず source-output comparison を表示する。`direct-action` は追加 Agent 判断や Proposal を作らず、user action を approval として result 到着時に次の atomic apply へ進む。
4. Dialogue / Agent の Accept / Modify、または検証済み Direct Action result で `applyTransform` を実行する:
   - revalidate Workspace / Canvas / runtime / scope / run and every source revision;
   - create one derived Text-bearing Node with `provenance.origin = "llm"`, `operation`, source IDs, source revisions, provider / model;
   - add accepted `derived` Relation(s) from every source to the new Node, plus only the user-approved suggested Relations;
   - validate the entire document;
   - commit one history entry and clear future history;
   - return node / relation receipt IDs.
5. On any failure, return the original state and history unchanged. Do not delete physical image files as a side effect.
6. Manual Relation creation / edit / remove uses the same invariant and history machinery but does not require a Proposal when initiated by an explicit user command.
7. Direct Action 成功後は source IDs、operation、created IDs、provenance、source-output diff / change summary、undo receipt を表示する。失敗時は document / history を変更せず retry 条件を示す。

## UI / Screens

- Transform action is available only when selection satisfies operation arity. Disabled actions explain the missing selection count.
- Proposal card shows source chips, operation, source-output comparison、output preview, `new derived node` placement, Relation chips, reason, base revisions, and origin.
- Modify edits output content and allows changing Relation kind / direction / reason before one Apply.
- Direct Action は事前 Proposal を表示せず、action 実行前に選択 source / operation が action affordance から分かり、成功後に change summary / source-output diff / provenance / undo を表示する。
- Relation edge uses arrow direction and kind label on selection; detail can be in a compact popover / card, not a permanent full-screen modal. Reverse は source / target endpoint を交換するが、React Flow の source/target handle role は交換せず、edge を描画可能なまま維持する。
- Accepted output is selected and focused in the Current Canvas. Position is deterministic relative to source bounding box; the user may move it afterward.
- 人間が移動した selected / active Node の位置は次の Context preview で `spatial hint` と明示し、意味的 Relation と混同しない copy を使う。
- Reject / Stop / stale / conflict messages state that the original nodes were not changed and provide the next available action.

## Agent Contract

- `propose_transform`: requires a prior read of every source node, operation, source IDs, source revisions, content, summary, and suggested relations. It is limited to the request snapshot and body allowlist.
- `propose_relation`: requires prior read of both endpoints and returns kind, direction, reason, and source revisions. It cannot create a relation to an unseen / excluded node.
- Dialogue / Agent route だけが `propose_transform` / `propose_relation` の Proposal event を生成する。Direct Action route は同じ source snapshot と DTO validation を利用できるが、問い返し、Suggest、追加 tool round、Dialogue append を行わない。
- Direct Action route は専用 bound method から one-shot structured provider request を一回だけ発行し、validated draft を frontend の atomic command へ返す。provider error、invalid DTO、stale source は no-op とし、暗黙に Agent route へ fallback しない。
- Existing `read_canvas_node`, `list_canvas_nodes`, `apply_edit`, Artifact tools, max 10 rounds, provider metadata, cancellation, and correlation remain compatible.
- Backend sends one structured `chat:tool_apply` Proposal event. Frontend returns the existing acknowledgement envelope plus the expanded proposal / receipt fields.

## Persistence

- Keep `version: "1.3"` for F2. Add optional relation `reason` and transform provenance fields to the existing arrays; older files omit them and load with undefined / default values.
- Save only accepted document state. Pending Proposal, raw Dialogue, run state, and rejected candidate content are not saved.
- Roundtrip tests compare workspace / canvas identity, node IDs, content, source revisions, provenance, relation endpoints / kind / reason, and current Canvas.

## Error Handling

- `invalid-source-arity`, `source-out-of-scope`, `source-revision-conflict`, `proposal-stale`, `relation-endpoint-missing`, `self-relation`, `unsupported-operation`, `empty-transform-output`, `transform-provider-error` are user-visible actionable errors.
- Provider / JSON / tool-call errors do not create partial Node or Relation.
- A late Proposal after New / Discard / Load / navigation / Stop is marked stale or cancelled and cannot be retried implicitly.

## Requirement Traceability

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-01/02 | Context and arity | `transform.ts`, `contextResolver.ts`, `agent_loop.go` | domain + backend tests, F2-01 |
| REQ-03/05 | Derived atomic mutation | `workspaceCommands.ts`, `proposal.ts`, `useAppStore.ts` | reducer/fault tests, F2-02 |
| REQ-04/10 | Proposal lifecycle / stale guard | `proposal.ts`, `chat_service.go`, `ToolCard` | integration + F2-02/F2-04 |
| REQ-06/07 | Typed Relation | `workspace.ts`, `invariants.ts`, relation UI | relation tests, F2-03 |
| REQ-08/09 | Projection / shared Context | `projectToFlow.ts`, `contextResolver.ts`, `ContextPreview` | resolver/projection tests, F2-03/F2-04 |
| REQ-11 | V1.3 persistence | `workspacePersistence.ts` | fixtures / roundtrip |
| REQ-12/13/14 | UX, environment, completion checks | E2E harness, status checks | F2-01〜05, build/test/vet |
| REQ-15 | Human spatial feedback | `contextResolver.ts`, `ContextPreview.tsx`, `canvas_snapshot.go` | resolver movement test, F2-04 |
| REQ-16 | Dialogue / Direct Action separation | entry routing, store, `chat_service.go`, direct receipt UI | route integration test, F2-05 |
| REQ-17 | Preview / diff contract | `TransformComparison.tsx`, proposal / direct result UI | browser test, F2-01/F2-05, E4 UX |
| REQ-18 | F2 core value Gate | review scenario and `90_status.md` | separate E4 task-based review |
| NFR-01〜04 | Dependency, transaction, allowlist, provenance | package/go diff, commands, resolver/DTO, persistence | E1/E3 evidence rows in status |

## Work Packages

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-0 | REQ-13/14 | `mise.toml`, E2E harness, cheatsheet if needed | F1 baseline stays green; fake provider can emit transform / relation proposal; no new dependency/API adoption is unverified |
| WP-1 | REQ-01/02/06 | domain types, invariants, `transform.ts`, command fixtures | operation arity, typed Relation, scope and self/missing endpoint guards pass |
| WP-2 | REQ-03/05/07/08/11 | commands, proposal, persistence, projection, store | atomic derived output + Relation, manual Relation, undo, V1.3 roundtrip pass |
| WP-3 | REQ-04/09/10/13/15/16 | agent DTO/tools, chat service, Context preview, route separation | structured proposals, body/spatial allowlist, correlation, Direct Action separation, Stop/stale handling pass |
| WP-4 | REQ-04/07/08/12/15/16/17 | transform / relation UI, comparison, direct result, edge detail, keyboard states | user can preview/diff, modify, accept/reject, use one-shot Direct Action, inspect Relation and recover from errors |
| WP-5 | REQ-01〜18, NFR-01〜04 | domain/backend tests, `ce2e-f2.spec.ts`, build, E4 review handoff | F2-01〜05, test/vet/build/E2E pass; Gate evidence template ready for separate acceptance |

## Implementation Order / First Checks

1. **WP-0 — harness first**: F1 の `mise run test` / `go vet` を再実行し、fake provider が source revision 付きの transform / Relation Proposal を返せる最小 fixture を追加する。ここで dependency 追加や real network が不要であることを確認する。
2. **WP-1 — domain contract next**: operation arity、Relation kind、endpoint / scope / self guard、transform request / draft を pure domain test で固める。UI や provider response の揺れを先に実装しない。
3. **WP-2 — transaction and persistence**: `applyTransform`、manual Relation、one undo、failure injection、V1.3 roundtrip を実装する。派生 Node と Relation の partial apply がないことを最初の機能 Go 条件とする。
4. **WP-3 — Agent bridge and entry routing**: read-before-propose、structured DTO、allowlist / spatial hints、run / scope / revision correlation、Dialogue / Direct Action 分離、Stop / stale を backend と frontend acknowledgment / direct receipt でつなぐ。
5. **WP-4 — visible collaboration UI**: domain / Agent の contract が green になってから Proposal comparison、Direct Action result diff、Relation detail、spatial hint、keyboard / error state を追加する。UI から直接 document を書き換えない。
6. **WP-5 — vertical acceptance**: F2-01〜05 を `mise run e2e` に追加し、最後に test / vet / build / E2E の implementer evidence を `90_status.md` へ記録する。REQ-18 の E4 review は別 session / human が実課題で行い、Acceptance 列と `state: done` はその受入後にのみ更新する。

## Verification

- Baseline before implementation: `mise run test` and `mise exec -- go vet ./...` pass (2026-08-12)。
- Per WP: `mise exec -- npm --prefix frontend run test:domain`、`mise exec -- npm --prefix frontend run test:acceptance-gaps` plus new F2 logic tests。
- Final: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e`。
- E2E fake provider scenarios must assert no real provider environment, temp root cleanup, proposal receipt, node / relation count, original content, and stale result behavior。

## Core E2E Scope

### F2-01 — Transform preview and scope

Create two Text nodes, select them, run Compare, and assert the request includes only selected source bodies / revisions. Preview appears; original nodes and document counts are unchanged before accept. Run Summarize with one node and Counterpoint with one node.

### F2-02 — Human decision and undo

Accept a transform, verify one derived node + derived Relation + provenance. Modify a draft, reject another, Stop an active run, and undo the accepted transaction. Assert original nodes remain unchanged and failed / cancelled decisions leave no partial output.

### F2-03 — Typed Relation

Create / edit / reverse / remove `supports` and `opposes`, accept an AI `similar` proposal, inspect edge kind / direction / reason, save/load, and verify cross-canvas projection remains an aggregate.

### F2-04 — Context continuity and stale safety

Use an accepted derived node / Relation in the next Context preview and Dialogue. Move a selected Node and assert its Current Canvas position is reflected as an explicit spatial hint without creating a Relation; assert another Canvas position is excluded. Exclude a source, navigate or start New Workspace while a proposal is pending, then deliver the late result and assert stale / cancelled with no mutation. Save/load the accepted state.

### F2-05 — Direct Action separation and result diff

Run a transform from the explicit Canvas action and assert the user action is treated as approval: no Proposal decision card, no Dialogue append, and no additional Agent round. Validate one atomic derived Node + Relation transaction, post-apply source-output diff / change summary, provenance, receipt, and one undo. Compare with the Dialogue route and assert that route remains unmutated until explicit Accept / Modify.

## F2 Core Gate Review

Separate acceptance uses one representative real task and records concise E4 evidence for REQ-18:

- discovery: whether a new issue, comparison axis, counterpoint, or useful Relation emerged;
- collaborative correction: whether Modify / Relation editing advanced the shared understanding rather than only cleaning AI output;
- control: whether the reviewer can explain the original state, provenance, and undo path;
- friction: whether cleanup, confirmation, and correction burden outweighed the benefit;
- decision: Go / Hold / Stop for the F2 core slice, with a short rationale and follow-up disposition triggers.

Do not add telemetry, mandatory end-of-session surveys, or fixed adoption-rate targets for this review.
