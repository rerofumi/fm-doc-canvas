# Implementation Specification

## Technical Stack

F1〜F4 で Go 判定済みの既存 stack のみを採用する。

- Desktop: Wails v2.12.0。
- Backend: Go `main` / `backend`、既存 LLM Chat Completions / streaming / tool-call contract。
- Frontend: React 18、TypeScript、Vite、Zustand、`@xyflow/react@^12.3.0`、既存 Markdown renderer。
- Test: existing domain tests、Go tests / vet、Playwright 1.62.1 Wails E2E。
- New dependency: none。

## Design Decisions

1. **Proposal-first**: Relation batch と Cluster View はどちらも `ProposalRecord` 経路で扱う。AI / Direct one-shot が作る出力は accept まで document を変更しない（D-03 / D-08）。
2. **Direct = 提案生成までが承認**: Direct Action は Agent loop / 問い返し / Dialogue 追加を行わないが、Relation / View の確定には別途人間の Accept を要する。F2 Direct Transform（即時 Node 作成 + undo）とは承認対象が異なる。
3. **Generated View は runtime-only**: `activeGeneratedView` は Zustand store の非永続 state に保持し、`WorkspaceDocument` と Save file に書き込まない。V1.3 format は不変。
4. **Overlay は pseudo node**: cluster hull は React Flow へ描画専用の非 interactive pseudo node として inject する。document node / command / persistence には一切触れない。
5. **Batch apply は単一 transaction**: 新規 `addRelations` command で選択された Relation を all-or-nothing 適用し、1 undo で全削除する。
6. **SubCanvas 変換は composite transaction**: document mutation は既存 `createSubCanvas` を再利用するが、変換前 `activeGeneratedView` snapshot を同じ history entry に保持する。undo / redo は document と View を一緒に復元し、変換を一つの可逆操作にする。
7. **構造化出力**: 自由文 parser を使わず、JSON schema（relations / clusters）を LLM に要求し、backend DTO validation を通ったものだけ Proposal 化する。
8. **viewHints は観測情報**: F2 の `spatialHints` と同格の hint として resolver に追加し、意味の自動確定には使わない。
9. **上限で提案を制限**: 1 batch ≤ 8 relations、1 view ≤ 8 clusters、1 view request ≤ 40 nodes。超過は validation error。
10. **Image は F4 の入力境界を再利用**: Text-bearing Node は body allowlist、Image Node は明示選択を優先した F4 Vision allowlist（最大3画像）で送る。Vision非対応またはasset取得失敗時は alt / prompt / provenance の metadata-only へ縮退し、proposal preview に縮退状態を表示する。
11. **共同編集は core の部分実装**: rename、既存 cluster 間の member 移動、member 除外、cluster 削除までを実装する。新規 cluster 作成、split / merge、ungrouped Node の手動追加は後続 slice とし、D-08 全体の完了とは扱わない。

## File Structure

### Domain / State

- `frontend/src/domain/workspace.ts`: `WorkspaceCommand` へ `addRelations` を追加。`RelationRecord` スキーマは変更しない。
- `frontend/src/domain/generatedView.ts`（新規）: `GeneratedViewRecord` / `ClusterViewDraft` / 正規化・検証（source revisions、重複 member、空 cluster、上限、folder 除外）、cluster 削除・既存cluster間のmember移動などの view-local 編集 pure functions、hull bounding-box 計算 helper。
- `frontend/src/domain/proposal.ts`: `createRelationBatchProposal`、`createGeneratedViewProposal` を追加。`decideAndApplyProposal` に `add-relation-batch` / `create-generated-view` の accept / modified / reject / stale 処理を追加。
- `frontend/src/domain/invariants.ts`: batch relation 検証（self / missing endpoint / invalid kind / duplicate accepted / 同一 batch 内重複 / cross-scope）。
- `frontend/src/domain/workspaceCommands.ts`: `addRelations` の atomic apply / undo / history entry。
- `frontend/src/domain/history.ts`（新規、または既存history型の拡張）: commandのundo / redoに加え、optionalなephemeral snapshot `{ activeGeneratedView: GeneratedViewRecord | null }` を同じentryへ保持するcomposite history helper。通常commandはsnapshotなしのまま互換維持する。
- `frontend/src/domain/contextResolver.ts`: `ResolveContextInput` に optional `generatedView` を受け、`ContextEnvelope.viewHints` を出力する拡張。
- `frontend/src/domain/transform.ts` 相当の再検証 helper として `generatedView.ts` 内へ `revalidateDirectSuggestion(request, latestState)`（Direct 結果の遅着 / stale 判定）を追加。

### Store / UI

- `frontend/src/store/useAppStore.ts`:
  - state: `activeGeneratedView: GeneratedViewRecord | null`、`lastSuggestReceipt`（Direct 提案生成の receipt / error）。
  - actions: `runDirectSuggestRelations()`、`runDirectSuggestClusters()`、`closeGeneratedView()`、`editGeneratedView(patch)`、`convertClusterToSubCanvas(clusterId, label)`。変換actionはdocument command成功後にViewを別更新せず、変換前View snapshotを含むcomposite history resultを一度にcommitする。
  - undo / redo: composite entryの場合はWorkspace command適用とephemeral snapshot復元を一つのZustand `set`でcommitする。command失敗時はhistory cursorとViewを変更せず、redoでも変換後View縮退状態を復元する。
  - lifecycle: `newWorkspace` / `discardWorkspace` / `replaceWorkspaceAfterValidatedLoad` / `navigateCanvas` / `navigateParent` / `navigateBack` 時に `activeGeneratedView` を破棄。Stop は in-flight request / 未確定 Proposal だけを無効化し、accepted View は維持する。accept 時は既存 View を閉じてから置換。
  - member node 削除 command 後に view を縮退（空 cluster 除去 → 全滅なら close）。
- `frontend/src/components/canvas/CanvasArea.tsx`: active view がある場合、`projectToFlow` 結果へ hull pseudo nodes を混ぜる。背景 context menu に `Suggest Relations (canvas)` / `Suggest Clusters` を追加。
- `frontend/src/domain/projectToFlow.ts`（または CanvasArea 内の合成関数）: `GeneratedViewRecord` + 現在 node position から `clusterHull` pseudo node 配列を生成。`selectable/draggable/connectable=false`、member より低い z、document projection には含めない。
- `frontend/src/components/canvas/ClusterHullNode.tsx`（新規）: 半透明の囲み + cluster label + 色。
- `frontend/src/components/canvas/GeneratedViewBanner.tsx`（新規）: view label、cluster chip 一覧（chip から rename / 削除 / member 編集 / `Convert to SubCanvas…`）、`Close view`。
- `frontend/src/components/proposal/RelationBatchProposalCard.tsx`（新規、または `ToolCard.tsx` 拡張）: 項目ごとの kind / direction / reason / endpoint 表示、項目 checkbox（除外 = modify）、`Accept selected` / `Reject all` / `Stop`。
- `frontend/src/components/proposal/ClusterViewProposalCard.tsx`（新規）: cluster 名・理由・member 一覧の preview、rename / member 付け替え・除外 / cluster 削除の modify、Accept / Reject / Stop。
- `frontend/src/components/canvas/ConvertClusterDialog.tsx`（新規）: member 一覧、Folder label 入力（default = cluster label）、移動先 Current Canvas、境界 Relation 維持の説明、Confirm / Cancel。
- `frontend/src/components/ui/ContextMenu.tsx`: node 複数選択時の `Suggest Relations` を追加。
- `frontend/src/types/chat.ts`: `ChatToolProposal.operation` に `"relation-batch" | "generated-view"` を追加し、`relationBatch?` / `generatedView?` DTO を追加。

### Backend / Agent

- `backend/agent_types.go`:
  - `RelationBatchProposal`（relations []{SourceNodeID, TargetNodeID, Kind, Reason, Direction}、correlation envelope: WorkspaceID / CanvasID / RuntimeGeneration / ScopeEpoch / RunEpoch、Sources preview、provenance）。
  - `ClusterViewProposal`（ViewLabel、Clusters []{Label, Reason, NodeIDs}、UngroupedNodeIDs、correlation envelope、provenance）。
  - `DirectSuggestRelationsRequest` / `DirectSuggestClustersRequest`（対象全Nodeの `SourceRevisions`、Text body、Image metadata、F4 Vision allowlistで許可されたimage input、Vision fallback状態を含むcorrelation構造 + Validate）。
  - `ToolApplyProposal` に `RelationBatch *RelationBatchProposal` と `ClusterView *ClusterViewProposal` を追加。
- `backend/agent_loop.go`:
  - tool 定義 `propose_relation_batch`（params: `relations[]`（source_node_id / target_node_id / kind / reason / direction）、`reason`。required: relations）。両端 node は `read_canvas_node` 済みであること。≤8 件。
  - tool 定義 `propose_cluster_view`（params: `label`、`clusters[]`（label / reason / node_ids）、`ungrouped_node_ids`）。member は request snapshot に存在すること。≤8 clusters / ≤40 nodes。
  - `executeTool` へ validation を追加（self / duplicate / missing endpoint / kind enum / 上限 / snapshot 存在）。失敗は既存どおり `toolResult{Status:"error"}`。
- `backend/suggest_service.go`（新規、または app.go 内の one-shot 関数）: Direct 用の prompt / multimodal message 組み立てと JSON parse。Text-only / metadata-only は既存text path、Vision allowlistに画像がある場合はF4のmultimodal Chat message pathを再利用する。`"Return JSON only with keys …"` 形式で固定し、parse失敗はerror。
- `app.go`: `SuggestRelations(req)` / `SuggestClusters(req)` bound methods（`DirectTransform` のone-shot / correlation patternとF4 Vision message builderを組み合わせる。Agent loopなし、session保存なし）。E2E用の `ArmDelayedSuggest` / fault注入は既存 `ArmDelayedDirectTransform` patternに倣う。
- `backend/system_prompt.go`: ルール追加 — 複数 node の関係提案は `propose_relation_batch`、俯瞰的なまとまりの提案は `propose_cluster_view` を使うこと。cluster membership は確定事実ではなく、SubCanvas 化は人間が行うこと。既存 pairwise `propose_relation` は単発のまま使える。

### Tests / E2E

- `frontend/src/tests/f5RelationBatch.test.ts`（新規）: batch 正規化 / invariant / atomic `addRelations` / undo / source revision stale。
- `frontend/src/tests/f5GeneratedView.test.ts`（新規）: draft validation、source revision stale、view-local edit、縮退、lifecycle（navigation / load / new で破棄、Stopでaccepted View維持）、composite SubCanvas undo、hull計算。
- `frontend/src/tests/f2Transform.test.ts` / `frontend/vite.domain-test.config.ts` / `frontend/package.json`: 上記F5 testを既存entryからimportするか、専用entry / scriptを追加する。`npm --prefix frontend run test` の標準出力にF5 test完了名を出し、ファイル作成だけで未実行にならないようにする。
- `frontend/src/tests/f3ContextPacket.test.ts` 等既存 resolver test へ `viewHints` case を追加（新規 `f5ViewHints.test.ts` でも可）。
- `backend/f5_suggest_test.go`（新規）: tool schema / validation、Direct one-shot の JSON parse、`FixtureLLM` の canned response、上限 / 重複 / self 拒否。
- `frontend/e2e/ce2e-f5.spec.ts`（新規）: F5-01〜F5-05。
- `frontend/e2e/helpers.ts` / `run-e2e.mjs`: fake provider 拡張（relation-batch / cluster view の fixture 応答）、delay / fault arm helper。実 network / 実 key 禁止は維持。

## Data Model

### Relation batch draft / proposal

```ts
interface RelationBatchItem {
  sourceNodeId: string;
  targetNodeId: string;
  kind: "source" | "derived" | "supports" | "opposes" | "similar";
  reason?: string;
  direction?: "forward" | "reverse";
}

interface RelationBatchDraft {
  relations: RelationBatchItem[];        // 1..8 items
  sourceRevisions: Record<string, number>;
  imageInputModes: Record<NodeId, "vision" | "metadata-only">;
  provenance: Provenance;                // origin="relation-batch"
}
```

- 正規化時に次を拒否: 空 batch、self relation、欠損 endpoint、不正 kind、同一 batch 内の重複 pair+kind、既存 accepted relation との重複、8 件超過。
- Proposal modify は「項目の除外」のみ許可（kind / direction / reason の行内編集は将来候補）。Accept は残った項目の一括適用。

### Cluster view draft / active record

```ts
interface ClusterViewDraft {
  label: string;                          // view title
  clusters: Array<{
    id: string;                           // runtime-local
    label: string;
    reason?: string;
    nodeIds: NodeId[];                    // >=1
  }>;                                      // >=2 clusters
  ungroupedNodeIds: NodeId[];
  sourceRevisions: Record<NodeId, number>; // request対象全Node、key set完全一致
  imageInputModes: Record<NodeId, "vision" | "metadata-only">;
  provenance: Provenance;                 // origin="cluster-view"
}

interface GeneratedViewRecord extends ClusterViewDraft {
  id: string;
  kind: "cluster";
  workspaceId: string;
  canvasId: CanvasId;
  runtimeGeneration: string;
  scopeEpoch: number;
  source: "dialogue" | "direct";
  createdAt: string;
}
```

- 正規化時に次を拒否: 2 cluster 未満、同一 node の複数 cluster 所属、snapshot 未存在 node、Folder node の member 化、8 clusters / 40 nodes 超過。member が1件に減った cluster は表示上許容するが、変換は既存 `createSubCanvas` の最少要件に従う。
- Direct結果到着時とProposal Accept時に、`sourceRevisions` のkey set完全一致と対象全Nodeのrevision一致を検証する。Image Nodeのrevisionもrequest snapshot値を使い、asset取得可否とは分離する。
- View-local 編集（rename / member 移動 / 削除）は record の shallow copy で行い、document command を発行しない。

### addRelations command

```ts
| { type: "addRelations"; relations: RelationRecord[] }
```

- 単一 history entry。全 relation を invariant 検証後に追加し、1件でも失敗すれば全体 no-op。
- undo は追加した relation IDs を一括削除。provenance は `origin="relation-batch"` + provider / model / createdAt を保持。

### viewHints（ContextEnvelope 拡張）

```ts
interface ViewContextHint {
  viewId: string;
  kind: "cluster";
  label: string;
  clusters: Array<{ clusterId: string; label: string; memberNodeIds: NodeId[] }>;
}
```

- `resolveContext` の入力に optional `generatedView` を受け、active かつ request の `activeContextNodeIds` と交差する member を持つ cluster だけを出力する。
- hint には「provisional grouping, not confirmed relation」相当の注記を prompt 組み立て側で付与する。

## Commands and Transactions

| Operation | Command / path | Atomicity |
| --- | --- | --- |
| Batch relation accept | `addRelations` | 単一 history entry、1 undo |
| View accept | store state のみ | document 不変 |
| View-local edit | store state のみ | document 不変、undo 不要 |
| Cluster → SubCanvas | 既存 `createSubCanvas` + View snapshot composite history | document / active Viewを単一commit。1 undo / redoで両方を復元 |
| View close / 破棄 | store state のみ | document 不変 |

## UI / Screens

1. **Context menu**: 2 node 以上選択で `Suggest Relations`。Canvas 背景 menu に `Suggest Relations (whole canvas)` / `Suggest Clusters (whole canvas)`（対象が 40 nodes を超える場合は disabled + 理由 tooltip）。
2. **Direct suggestion 実行中**: 既存 Direct Action receipt 領域に pending / error を表示。成功時は Proposal card を chat panel（Dialogue 非追加）または dedicated proposal 領域へ表示する。
3. **RelationBatchProposalCard**: 表形式で `source → target`、kind badge、reason、checkbox。`Accept selected (n)` / `Reject all` / `Stop`。stale / conflict は F2 と同じ表示。
4. **ClusterViewProposalCard**: cluster ごとに label / reason / member chip を表示。modify（rename、member の chip 移動 / 除外、cluster 削除）。`Accept` / `Reject` / `Stop`。
5. **GeneratedViewBanner**: Canvas 上部に view label、cluster chip、`Close view`。chip の context action: rename、delete、`Convert to SubCanvas…`。
6. **ClusterHullNode**: member の bounding box + padding の半透明矩形。cluster ごとに固定 palette 色（≤8）。label を左上に表示。pseudo node は選択 / ドラッグ / 接続不可。
7. **ConvertClusterDialog**: member 一覧（title / summary）、Folder label input（default = cluster label、inline 編集可）、移動先 = Current Canvas、境界 Relation は badge / aggregate で維持される説明。Confirmでcomposite transactionを実行し、成功後clusterをViewから除去。undoでは変換前Viewも復元する旨を表示する。
8. **Image input badge**: proposal previewで画像ごとに `Vision` / `metadata only` を表示し、Vision非対応またはasset取得失敗による縮退を確認できるようにする。

## Agent Contract

- `propose_relation_batch`: 1 tool call で 1〜8 件の relation。両端は `read_canvas_node` 済み必須。tool 結果は proposal として frontend へ emit し、document は変更しない。
- `propose_cluster_view`: member はsnapshot存在かつ `read_canvas_node` 済み必須。対象全Nodeのrevisionをproposalへ記録する。Imageはread結果のmetadataとrequestのF4 Vision allowlistで提供された画像だけを使う。2〜8 clusters。acceptまでは何も変更しない。
- 既存 `propose_relation` は維持。Agent が単発でよい場合はそちらを使ってよい。
- max 10 rounds、read-before-mutate、conflict / cancelled / error の扱いなど既存 rule を維持する。

## Direct Action Contract

- `SuggestRelations`: 選択（≥2）または Current Canvas 全体のallowlisted snapshotと対象全Nodeのrevisionをone-shot LLMへ渡し、`RelationBatchDraft`を返す。ImageはF4 Vision allowlist / metadata fallback契約に従う。
- `SuggestClusters`: 選択（≥2）または Current Canvas 全体（≤40 nodes）のallowlisted snapshot、対象全Nodeのrevision、image input modeをone-shotで渡し、`ClusterViewDraft`を返す。
- どちらも `DirectTransform` と同じく request validation → provider call → structured parse の順。Agent round なし、Dialogue message 追加なし、chat session 保存なし。
- 結果は Proposal として表示され、accept / reject は人間の操作を要する。

## Persistence

- `WorkspaceDocument` と Save JSON に Generated View / pending batch proposal を含めない。V1.3 format 不変。
- Accept された Relation は既存 `RelationRecord` として V1.3 に roundtrip する（`reason` / `provenance` optional field）。
- Load / New / Discard 時に `activeGeneratedView` を必ずクリアする。

## Error Handling

| Failure | Behavior |
| --- | --- |
| provider timeout / 4xx / 5xx | document 不変。Direct は receipt error、Dialogue は既存 tool error 表示。retry / 対象変更を案内 |
| 不正 JSON / schema 違反 | backend validation error として no-op。部分 proposal を作らない |
| 上限超過（>8 relations / >8 clusters / >40 nodes） | request 前に UI で抑制し、backend でも拒否 |
| stale accept（navigation / New / Load / Stop / member 削除後） | proposal を `stale` / `conflict` にし、適用しない |
| source revision mismatch | Direct結果到着時 / Proposal Accept時に全体no-op。再提案を案内 |
| Vision非対応 / image asset取得失敗 | metadata-onlyへ縮退しproposalにbadge表示。metadataも取得できなければ対象不正としてno-op |
| 変換時の member 欠損 | `createSubCanvas` を実行せず理由を表示 |
| batch 内 1 件でも invariant 違反 | accept 時に全体 no-op + 理由表示 |

## Requirement Traceability

| REQ | 主な実装 / 検証 |
| --- | --- |
| REQ-01 | contextResolver、F4 Vision allowlist / fallback、`DirectSuggestRelationsRequest.Validate`、F5-01/05 |
| REQ-02 | `suggest_service` / `app.go SuggestRelations`、`f5_suggest_test.go`、F5-01 |
| REQ-03 | `agent_loop.go propose_relation_batch`、F5-02 |
| REQ-04/05 | `addRelations` command、`RelationBatchProposalCard`、f5RelationBatch.test.ts、F5-01 |
| REQ-06/07 | `generatedView.ts`、F4 Vision message path、`ClusterViewProposalCard`、`f5_suggest_test.go`、F5-02/03/05 |
| REQ-08 | `ClusterHullNode`、`GeneratedViewBanner`、projectToFlow 拡張、F5-03 |
| REQ-09 | store lifecycle、Stop separation、workspacePersistence 非含入、F5-04 |
| REQ-10 | `ConvertClusterDialog` + `createSubCanvas` / View composite history、F5-03 |
| REQ-11 | proposal.ts / generatedView.ts の source revision / Stop stale guard、F5-04 |
| REQ-12 | contextResolver viewHints、f5ViewHints / F5-03 |
| REQ-13 | error handling、F5-05 |
| REQ-14 | system_prompt.go、agent test |
| REQ-15 | UI 各 component、F5-05 |
| REQ-16 | F5 frontend test entry登録 + 全 test / build / e2e command |
| REQ-17 | 50_review_notes.md / E4 session |

## Work Packages

- **WP-0 Harness**: fake LLM fixture（relation-batch / cluster-view 応答）、delay / fault arm helper、E2E bridge 拡張。
- **WP-1 Domain**: `generatedView.ts`、`addRelations` command、SubCanvas + View composite history、source revision invariants、resolver `viewHints`、unit test。
- **WP-2 Backend**: DTO / validation、`propose_relation_batch` / `propose_cluster_view` tool、Direct one-shot 2種、system prompt、Go test。
- **WP-3 Store / lifecycle**: direct suggestion actions、proposal decision 統合、active view lifecycle / 縮退、`convertClusterToSubCanvas`。
- **WP-4 UI**: hull pseudo node、banner、proposal card 2種、変換 dialog、context menu、accessibility。
- **WP-5 E2E / Gate**: frontend test entry / script登録確認、ce2e-f5.spec.ts、regression run、E4 review note、docs 反映。

## Implementation Order / First Checks

1. `@xyflow/react` で pseudo hull node（`selectable/draggable=false`、低 z）が既存 node 操作を妨げないことを spike で確認する（WP-0 / WP-1 最初）。
2. backend DTO + validation + Go test を先に固定する。
3. frontend domain（addRelations / generatedView 正規化）を reducer test で固める。
4. F4 Vision allowlist / multimodal message builderを再利用してImage入力とmetadata fallbackを固定する。
5. Direct 経路 → Dialogue tool 経路の順で接続する。
6. 最後に E2E と UX review。

## Verification

- `mise run build`、`mise run test`、`mise exec -- go vet ./...`、`mise run e2e` が exit 0。`mise run test` の出力でF5 frontend unit testの実行を確認する。
- 既存 F1〜F4 の Core E2E（foundation / f2 / f3 / f4）が regression pass。
- Save file diff に Generated View 由来の key が現れないことを確認する。

## Core E2E Scope

### F5-01 — Direct relation batch: preview / modify / accept / undo

選択 3 node → `Suggest Relations` → batch card に fake 応答の relation が並ぶ → 1 件除外して Accept → 残り edge が label 付きで描画 → 1 undo で全削除。Dialogue 履歴が増えないことも確認。

### F5-02 — Dialogue tools: batch relation + cluster view proposals

fake LLM が `propose_relation_batch` → `propose_cluster_view` を呼ぶ対話で、両 Proposal card が表示され、Accept 前に document 不変、Reject / stale で no-op。

### F5-03 — Cluster View overlay, viewHints, convert to SubCanvas

cluster view accept → hull / banner 表示 → node をドラッグしても hull が追従し document position だけ更新 → 次 chat request の payload に viewHints（F5-03 では bridge observation で確認）→ 1 cluster を preview 付きで SubCanvas 化 → Folder Node / member 移動 / 境界 Relation aggregate を確認 → undo でdocumentと変換前active View / cluster overlayをともに復元。

### F5-04 — Ephemeral lifecycle and stale guards

view active のまま Save → Load 後に view なし（relation は残る）→ navigation / New / Discard で view 破棄 → Stopではaccepted View維持 → member削除でcluster縮退 → source revision変更後およびStop後の遅着proposal acceptがno-op。

### F5-05 — Errors, limits, accessibility, regression

timeout / invalid JSON / empty result の error 表示、>8 relations / >40 nodes の拒否、ImageのVision / metadata-only表示とfallback、主要controlのaccessible name、PromptBar / Transform / web_search既存導線が壊れていないこと。`mise run test`内でF5 frontend unit testが実行された証跡も確認する。

## F-5B Core Gate Review

REQ-17 の E4 で、Relation batch suggestion と Cluster View を独立に Go / Hold / Stop 判定する。Layout suggestion と Library View は後続候補として disposition を `50_review_notes.md` に記録し、ロードマップ F-5B milestone はそれらの判定まで open とする。
