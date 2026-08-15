# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and plan start

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: F4 受入完了後の F-5B を新規 Full plan として開始する。
- Sources and checks: user request（F-5B 実装プラン作成、fm-dev-process 適用）、`05_roadmap.md` F-5B / D-08 / CW-4B、`plan_index.md`、F4 `90_status.md`（state: done、REQ-16 Go）。
- Actions: 既存 plan の amend ではなく `plan_20260815_generated_views` を新規作成。suffix はロードマップ候補名 `generated_views`。
- Decision: Full。domain command、backend tool、Canvas UI、E2E に広い影響がある。
- Alternatives rejected or deferred: 親 roadmap plan への追記、Light、Library View / Layout suggestion を含める案。
- Artifacts updated: plan directory start、`90_status.md`。
- Handoff: Claim と調査範囲を定義する。

## WL-002 — Step 1: Claim

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: F-5B の価値仮説と core / 非対象を分ける。
- Sources and checks: F-5B 3項目の独立判定規則、D-08、F2 の Relation / Proposal 実装（`workspace.ts`、`proposal.ts`）、`createSubCanvas` 既存 command。
- Actions: core を Relation batch suggestion + Cluster View + Cluster→SubCanvas 変換と定義。Library View / Layout suggestion は後続候補。
- Decision: 構造の発見を助け、人間の採否でのみ確定する。plan `done` は core のみ。
- Deferred: Library View、auto-layout、View 永続化、複数 View。
- Artifacts updated: `10_claim.md`。
- Handoff: MVP UX を定義する。

## WL-003 — Step 2: App Requirements

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: ユーザーが価値を確認できる最小体験を定義する。
- Sources and checks: CW-4B 到達判定、D-03 / D-05 / D-08、F4 app requirement の形式。
- Actions: Direct / Dialogue の二経路、batch proposal の項目別採否、一時的 overlay、明示 SubCanvas 変換、stale 安全を MVP にした。
- Decision: Direct Action の承認は提案生成まで。Relation / View の確定は必ず人間の Accept。
- Artifacts updated: `20_app_requirement.md`。
- Handoff: REQ と verification を割り当てる。

## WL-004 — Step 3/4: Pre-implementation research

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: 仕様が依存する既存実装と未検証点を特定する。
- Sources and checks: `workspace.ts`（WorkspaceCommand / RelationRecord）、`proposal.ts`（ProposalRecord / decideAndApplyProposal）、`contextResolver.ts`（relationHints / spatialHints）、`agent_loop.go`（tool 定義 / validation）、`app.go DirectTransform`（one-shot pattern）、`projectToFlow.ts`、`package.json`（@xyflow/react ^12.3.0）。
- Actions: 新規 dependency 不要と判定。hull pseudo node の z / 追従挙動を WP-0 spike の open question として記録。Direct one-shot は `DirectTransform` / `context_packet.go` の JSON 契約パターンを再利用すると判定。
- Decision: cheatsheet 新規ファイルは spike 結果が出るまで作らない。xyflow 挙動確認結果は将来 cheatsheet 候補。
- Alternatives rejected or deferred: SVG overlay 先行案（spike 失敗時の fallback に回す）。
- Artifacts updated: `10_claim.md` Uncertainties、`50_review_notes.md` R-03。
- Handoff: REQ 表へ検証方法を割り当てる。

## WL-005 — Step 5: Requirements

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: core slice を検証可能な REQ / NFR に落とす。
- Sources and checks: F2 / F4 の requirement 形式、D-08、Gate F-5B。
- Actions: REQ-01〜17、NFR-01〜05 を定義。E4 Gate は Relation batch と Cluster View を独立判定（REQ-17）。上限（8 relations / 8 clusters / 40 nodes）を設定。
- Decision: V1.3 format を変更しないため View は永続化しない（NFR-04）。
- Artifacts updated: `30_requirement.md`。
- Handoff: 実装仕様へ展開する。

## WL-006 — Step 6: Specification

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: 実装者が推測なしで進められる設計に落とす。
- Sources and checks: F4 spec の構造、既存 file structure、`agent_types.go` DTO 規則。
- Actions: data model（RelationBatchDraft / ClusterViewDraft / GeneratedViewRecord / addRelations / viewHints）、file structure、agent / direct contract、error handling、WP-0〜5、実装順、Core E2E F5-01〜05 を定義。
- Decision: batch は新 Proposal kind + `addRelations` command。View は store runtime state + hull pseudo node。
- Alternatives rejected or deferred: batch を個別 Proposal に分割する案（R-04）、View 永続化（R-02）。
- Artifacts updated: `40_specification.md`。
- Handoff: review packet と status を揃える。

## WL-007 — Step 7: Review Notes and Status

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: 設計判断と却下選択肢を記録し、status を planned で固定する。
- Sources and checks: claim / requirement / spec の整合確認。
- Actions: R-01〜R-08 の findings、Fixed / Deferred / Rejected を記録。`90_status.md` に REQ / NFR / Plan Checks 表を作成（implementer state は空欄）。
- Decision: Acceptance は別 session / human が実施する規則を維持。
- Artifacts updated: `50_review_notes.md`、`90_status.md`。
- Handoff: reviewer 向け資料を作る。

## WL-008 — Step 8: Reviewer material and index

- Date/time: 2026-08-15
- Actor/session: Pi planning session
- Purpose: 人間レビュー用の packet を作成し、roadmap / index と整合させる。
- Sources and checks: F4 `60_review_packet.md` 形式、`plan_index.md`、`05_roadmap.md` 昇格済み範囲。
- Actions: `60_review_packet.md` を作成。`plan_index.md` に新規 plan 行を追加し、`multimodal_context` を `done` へ同期。`05_roadmap.md` F-5B に個別 plan リンクを追加。
- Decision: review board / checklist は既存慣行どおり packet に内包し、独立ファイルは作らない。
- Artifacts updated: `60_review_packet.md`、`docs/plan_index.md`、`docs/plan_20260811_collaborative_workspace/05_roadmap.md`。
- Handoff: human review 後、WP-0 spike から実装を開始する。

## WL-009 — Step 9: Review findings amendment

- Date/time: 2026-08-15
- Actor/session: Codex review follow-up
- Purpose: human reviewで採用された4指摘とStop境界を、Claim / Requirements / Specification / Review Packet / Statusへ反映する。
- Sources and checks: `createSubCanvas`既存historyがWorkspace documentのみを復元すること、Direct Transformの`sourceRevisions`契約、F4 Vision allowlist、frontend domain testの単一entry構成、D-08共同編集境界。
- Actions: Cluster→SubCanvasをdocument + active Viewのcomposite undoへ変更。Relation batch / Cluster Viewへ対象全Nodeのrevision再検証を追加。Image Node入力をF4 Vision allowlist + 表示付きmetadata fallbackへ固定。F5 frontend testのentry / script登録をREQ-16 / WP-5へ追加。Stopはin-flight / 未確定Proposalだけを無効化するよう修正。
- Decision: View-local共同編集は現コードベース中心の部分実装（rename / 既存cluster間member移動 / 除外 / 削除）を維持し、新規cluster / split / merge / ungrouped追加は後続候補とする。
- Artifacts updated: `10_claim.md`、`20_app_requirement.md`、`30_requirement.md`、`40_specification.md`、`50_review_notes.md`、`60_review_packet.md`、`90_status.md`、`91_worklog.md`。
- Handoff: 修正後traceabilityを再確認し、WP-0 spikeから実装を開始する。

## WL-010 — Step 10: Implementation (WP-0〜4)

- Date/time: 2026-08-15
- Actor/session: Pi implementation session
- Purpose: `40_specification.md` に従って F-5B core slice を実装する。
- Sources and checks: `40_specification.md`、`30_requirement.md`、`50_review_notes.md`、既存 `workspace.ts` / `proposal.ts` / `workspaceCommands.ts` / `contextResolver.ts` / `useAppStore.ts` / `agent_loop.go` / `agent_types.go` / `app.go` / `context_packet.go` の F2〜F4 パターン。
- Actions:
  - Backend（WP-2）: `agent_types.go` に RelationBatch / ClusterView DTO と DirectSuggest request の Validate、`agent_loop.go` に `propose_relation_batch` / `propose_cluster_view` tool、`suggest_service.go`（新規）に structured JSON parse、`app.go` に `SuggestRelations` / `SuggestClusters` + E2E arm/delay、`system_prompt.go` に無断確定禁止ルール、`f5_suggest_test.go`（新規）。
  - Frontend domain（WP-1）: `generatedView.ts`（新規、正規化 / 検証 / view-local edit / hull / revalidate）、`workspace.ts` に `addRelations` + HistoryEntry.viewSnapshot、`workspaceCommands.ts` に atomic `addRelations`、`proposal.ts` に `add-relation-batch` / `create-generated-view` の proposal 経路、`contextResolver.ts` に `viewHints`。
  - Store / lifecycle（WP-3）: `useAppStore.ts` に `activeGeneratedView` / direct suggest actions / composite SubCanvas undo / navigation・load・delete での縮退。
  - UI（WP-4）: `ClusterHullNode` / `GeneratedViewBanner` / `ConvertClusterDialog` / `RelationBatchProposalCard` / `ClusterViewProposalCard` / `DirectProposalPanel`、`CanvasArea` hull inject + context menu、`App.tsx` banner / proposal 描画。
  - Tests（WP-5）: `f5RelationBatch.test.ts` / `f5GeneratedView.test.ts`（新規）を `f2Transform.test.ts` entry から import。
- Decision: overlay は pseudo node 方式（`selectable/draggable/connectable=false`、低 z）で確定。Direct は F4 Vision allowlist + metadata fallback を再利用。
- Verification: `go test -count=1 ./...` exit 0、`go vet ./...` exit 0、`npm --prefix frontend run test`（F5 test 名出力確認）exit 0、`npm --prefix frontend run build`（tsc + vite）exit 0。
- Alternatives rejected or deferred: SVG overlay（spike 不要と判定）、batch の個別 Proposal 分割（R-04 に従い addRelations 単一 transaction）。
- Artifacts updated: `app.go`、`backend/*`、`frontend/src/domain/*`、`frontend/src/store/*`、`frontend/src/components/*`、`frontend/src/types/chat.ts`、`frontend/src/tests/*`、`90_status.md`、`91_worklog.md`。
- Handoff: Core E2E（`mise run e2e` / ce2e-f5）と REQ-17 E4 は別 session で実施。受理後 `05_roadmap.md` / current docs へ反映。

## WL-011 — Step 11: User acceptance fixes

- Date/time: 2026-08-15
- Actor/session: User acceptance + Codex fix session
- Purpose: E4で報告されたRelation batchの選択scope / Accept問題と、長時間解析中のフィードバック不足を修正する。
- Findings: Node右クリック時のReact Flow選択集合がDirect suggestionへ明示的に渡されず、store側で2件未満としてCanvas全体へfallbackする経路があった。またDirect proposal cardの候補除外は`modifiedRelations`を渡していたが、decisionが`accept`のままでdomain側のmodify分岐を通らず、除外が適用されていなかった。`lastSuggestReceipt: pending`は存在したが画面に描画されていなかった。
- Actions: Nodeメニューの操作時点で選択Node IDsを固定してRelation解析へ渡した。modified payload付きAcceptを`modify` decisionへ接続し、Relation batch Accept時のsource revision再検証を追加した。Relation / Cluster解析中のspinner付き`role=status` bannerを追加し、同時suggest開始を抑止した。
- Verification: frontend logic / domain tests passed、TypeScript + Vite production build passed、別ポートでCore E2E 33件 passed。F5-01で4 Node中の選択2 NodeだけがRelation対象になること、F5-04でpending中status表示を確認。
- Decision: Cluster View + SubCanvasはGoを維持。Relation batchは修正後の人手再確認までHold。
- Artifacts updated: `frontend/src/store/useAppStore.ts`、`frontend/src/components/canvas/CanvasArea.tsx`、`frontend/src/App.tsx`、`frontend/src/domain/proposal.ts`、`frontend/e2e/ce2e-f5.spec.ts`、`90_status.md`、`91_worklog.md`。
- Handoff: 実LLMで選択2 NodeのRelation proposal / Acceptと、Relation / Cluster解析中bannerを再確認する。

## WL-012 — Step 12: Final human acceptance

- Date/time: 2026-08-15
- Actor/session: User acceptance session
- Purpose: 修正版のRelation batchと解析中表示を再確認し、F-5B core Gateを確定する。
- Result: ユーザーが修正版を「良さそう」と評価し、確認完了・受け入れ了承を宣言した。
- Decision: Relation batch suggestionはGo。先にGo判定済みのCluster View + SubCanvasと合わせ、REQ-17をGo、plan stateを`done`とする。
- Artifacts updated: `90_status.md`、`91_worklog.md`、`docs/plan_index.md`、`05_roadmap.md`、`08_glossary.md`。
- Handoff: Library View / Layout suggestionは後続候補として独立に計画・判定する。
