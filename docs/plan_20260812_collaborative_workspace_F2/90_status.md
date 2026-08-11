# Status

state: done
worklog: enabled

tier: Full
plan: plan_20260812_collaborative_workspace_F2

## Planning Scope

- Implementation slice: F-2 Collaborative Transform & Relate core slice
- Core E2E: in scope (`F2-01`〜`F2-05`)
- Worklog: enabled, inherited from the F1 collaborative workspace plan
- F2 follow-up candidates: extract / split / merge / reframe / variant / card conversion / multimodal / Generated View
- Milestone boundary: this plan may close the F2 core slice only; roadmap F-2 remains open until every deferred transform candidate has an adopted / deferred / rejected disposition

## Acceptance Table

`WP` は primary implementation owner。Acceptance は実装セッションとは別の session / human が実施する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | Current Canvas の明示 source と transform operation を解決し、暗黙の別 Canvas / excluded body を送らない | resolver test + F2-01 | E1 | WP-1/3 | implemented | repair: exact ID-set allowlist; real UI Shift multi-select add/remove/re-add → Compare in F2-01 | **pass** — 実UI modifier selection と明示source Compareを17-test E2Eおよびユーザー確認で再受入 |
| REQ-02 | summarize / compare / counterpoint の arity / scope / request validation | domain + backend DTO test | E1 | WP-1/3 | implemented | repair: `revalidateDirectTransform` latest-state correlation; domain stale tests; Go Validate | **pass** — exact-set validation、arity、latest scope / revision correlation を再確認 |
| REQ-03 | 元 Node を変更せず derived Text Node と provenance を作る | atomic reducer + F2-01/02 | E1 | WP-2 | implemented | `applyTransform`; F2-01 passed | **pass** — source 非変更、derived node / provenance、undo を再確認 |
| REQ-04 | Proposal preview / lifecycle / decision / Stop | proposal test + F2-02 | E1 | WP-3/4 | implemented | repair: `ToolCard` Proposal ID/operation/source comparison/reason/revisions/provenance/suggested Relation; F2-02 Accept/Modify/Reject/Stop | **pass** — required metadata、comparison、Accept/Modify/Reject/Stop/stale を再確認 |
| REQ-05 | derived Node + Relation の atomic apply と one undo | fault injection + F2-02 | E1 | WP-2/5 | implemented | repair: `apply-transform-before-commit` fault; domain no-op assert; F2-02 fault path | **pass** — fault no-op と one undo を再実行で確認 |
| REQ-06 | typed Relation、reason、provenance、endpoint / self guard | invariant / relation test | E1 | WP-1/2 | implemented | repair: suggested Relation Current Canvas scope guard; out-of-scope atomic fail test | **pass** — endpoint/self/scope guard と atomic failure を確認 |
| REQ-07 | manual / AI Relation の accept / change / reverse / reject / remove | relation UI + F2-03 | E1 | WP-2/4 | implemented | repair: Relation editor layout; reverse preserves renderable handle roles and visible edge; AI lifecycle; real UI manual create; F2-03 | **pass** — manual/AI lifecycle、長文Editor、reverse後edge可視性を自動・ユーザー確認で再受入 |
| REQ-08 | edge projection、kind / direction、cross-canvas aggregate | projection test + F2-03 | E1 | WP-2/4 | implemented | labeled React Flow edge; existing boundary E2E + F2-03 passed | **pass** — projection / boundary aggregate の再実行 pass |
| REQ-09 | accepted derived / Relation の next Context 反映、unaccepted exclusion | resolver test + F2-04 | E1 | WP-3/5 | implemented | `relationHints`; F2-04 accepted-only + unaccepted exclusion | **pass** — persisted accepted record のみ resolver 対象になる構造を確認 |
| REQ-10 | source revision / scope / generation / run stale guard | integration test + F2-02/04 | E1 | WP-3/5 | implemented | repair: `runDirectTransform` revalidates latest workspace after await; domain + F2-04 delayed edit/nav/New | **pass** — await後のlatest state再取得と edit/navigation/New の no-op E2Eを確認 |
| REQ-11 | V1.3 compatible persistence、旧 migration、failure no-op | fixture roundtrip / failure tests | E1 | WP-2/5 | implemented | reason/provenance V1.3 roundtrip; F2-04 Save/Load | **pass** — migration / roundtrip / unknown-version no-op test を再実行 |
| REQ-12 | actionable errors、accessible proposal / relation UX | browser assertions + human UX review | E1/E4 | WP-4/5 | implemented | repair: menu/dialog semantics; Relation form remains within viewport/dialog for long labels; modifier selection sync; F2-01/03 | **pass** — 主要UXへの到達、Relation dialog、controlをユーザー実画面確認で受入 |
| REQ-13 | allowlist、existing LLM contract、fake provider、no credential/network E2E | backend / harness inspection | E1 | WP-0/3/5 | implemented | repair: exact sourceNodes/sourceRevisions set match; provider body only allowlisted order; Go negative tests | **pass** — extra/missing/duplicate/revision mismatch拒否とallowlist順 bodyを再確認 |
| REQ-14 | all plan-defined test / vet / build / Core E2E commands pass | command output | E1 | WP-5 | implemented | repair: all commands exit 0; 17/17 E2E including real modifier selection, visible edge after reverse, nested Parent navigation | **pass** — 修正後の全plan commandと実UI回帰coverageを再確認 |
| REQ-15 | Current Canvas の人間配置を explicit spatial hint として次 Context に反映し、意味を自動確定しない | resolver movement test + F2-04 | E1 | WP-3/4 | implemented | `spatialHints` with explicit non-inference copy; F2-04 passed | **pass** — Current Canvas hint と non-inference copy を確認 |
| REQ-16 | Dialogue / Agent Proposal と request-as-approval Direct Action を分離する | route integration test + F2-05 | E1 | WP-3/4/5 | implemented | repair: Direct uses same stale revalidation; F2-05 route separation + no Dialogue append | **pass** — route分離、no Dialogue append、共通stale条件を確認 |
| REQ-17 | Proposal pre-apply comparison と Direct Action post-apply diff / undo | browser assertions + F2-01/05 + UX review | E1/E4 | WP-4/5 | implemented | repair: ToolCard source-output comparison; App Direct receipt `diff.sources`/`diff.output` + Undo button; F2-01/05 | **pass** — Proposal comparison、Direct diff、Undo UIを確認 |
| REQ-18 | 実課題で discovery、共同修正、control、cleanup burden を評価し F2 core Gate を判定する | separate task-based review note | E4 | WP-5 | implemented | 2026-08-13 user acceptance: F-2 implementation journeys verified; REQ-18 Go approved | **pass** — ユーザーが実画面でF-2実装項目を確認し、core value GateをGo承認 |
| NFR-01 | 新規 runtime / UI dependency を追加しない | package / lock / go.mod diff inspection | E3 | WP-0/5 | implemented | dependency diff is feature-free; build passed; no new deps in repair | **pass** — dependency manifest diff と build を確認 |
| NFR-02 | atomic transaction failure で document / history / revision / selection を部分更新しない | fault injection / reducer test | E1 | WP-2/5 | implemented | repair: transform fault injection domain + F2-02; full no-op asserts | **pass** — document/history/revision/selectionのfull no-opを再確認 |
| NFR-03 | 外部送信本文を body allowlist に限定し source IDs / revisions を一致させる | payload assertion / Go DTO test | E1 | WP-3/5 | implemented | repair: extra/missing/dup/revision mismatch rejected before provider; allowlist order body | **pass** — exact ID/revision setとprovider bodyを再確認 |
| NFR-04 | accepted Relation / derived provenance を元 Node 非変更で追跡できる | persistence test + implementation pointer | E1/E3 | WP-2/5 | implemented | provenance/reason roundtrip and source-preserving F2 E2E | **pass** — roundtrip と source-preserving apply を確認 |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: separate acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | implemented | exit 0 (repair 2026-08-13) | **pass** — 2026-08-13 再実行 |
| Go vet | `mise exec -- go vet ./...` | implemented | exit 0 (repair 2026-08-13) | **pass** — 2026-08-13 再実行 |
| Frontend logic / domain / acceptance gaps | `mise exec -- npm --prefix frontend run test` | implemented | exit 0; F2 domain stale/fault/relation tests | **pass** — 2026-08-13 再実行 |
| Frontend build | `mise exec -- npm --prefix frontend run build` | implemented | exit 0 | **pass** — Wails build 内で再実行 |
| Wails production build | `mise run build` | implemented | exit 0; Windows exe generated | **pass** — 2026-08-13 再実行 |
| Core E2E | `mise run e2e` / F2-01〜05 | implemented | 17 tests passed; real modifier selection; F2-03 reverse後edge visible; nested Parent navigation regression | **pass** — 17/17 pass、過去のbridge maskingを除去した実UI経路を確認 |
| Native smoke | F1 native baseline unchanged; F2 relation / proposal observation if UI-only issue appears | implemented | Wails dev E2E harness and binding smoke passed | - |
| Human UX review | Proposal comparison, Direct Action result diff, relation direction / reason, spatial hint copy, undo / stale copy | implemented | 2026-08-13 user verified F-2 implementation journeys including repaired UI | **pass** — 実画面確認済み |
| F2 core value Gate | REQ-18 task-based E4 review: discovery / correction / control / friction, then Go / Hold / Stop | implemented | 2026-08-13 user decision: Go | **pass** — F2 core slice Go |
| F-2 milestone disposition | deferred operations have adopted / deferred / rejected records; remains open when this core plan closes | todo | - | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence | implemented | repair pointers and real UI F2-01/F2-03 evidence updated | **pass** — REQ-01〜18 / NFR-01〜04に実装・検証・受入証跡あり |
| Worklog coverage | Steps 0〜8 before implementation handoff | implemented | `91_worklog.md` WL-001〜WL-019 | **pass** — implementation/repair/re-acceptance/final acceptanceを記録 |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-13 | Codex acceptance session | **Hold / not accepted** | 自動コマンドは全 pass。Direct stale guard、body allowlist、Proposal/Direct comparison、Relation UX、plan-defined E2E coverage に受入不一致あり |
| 2026-08-13 | Codex re-acceptance session | **Hold / not accepted** | 前回5指摘は修正済み。全自動検証pass。実UI multi-selectが`setActiveNode`で1件へ戻りCompare/Relationが開始不能 |
| 2026-08-13 | User acceptance session | **ACCEPTED / Go** | 修正後のF-2実装項目を実画面で確認。REQ-18をGo承認し、F2 core sliceを受入完了 |

## Acceptance Findings (2026-08-13)

1. **Direct Action stale overwrite**: `runDirectTransform` は backend await 前の `current` を保持し、その state に `applyDirectTransform` した結果を store へ投影する。待機中の edit / navigation / New / Discard を latest state と照合しない。
2. **Direct body allowlist mismatch**: backend `DirectTransformRequest.Validate` は `sourceNodeIds` の各 ID を自己申告 `sourceNodes` から探すだけで、余分な `sourceNodes` を拒否しない。`App.DirectTransform` は余分なものを含む全 `sourceNodes` を prompt / context body に連結する。
3. **Comparison / Proposal metadata missing**: `ToolCard` は transform output preview だけで source ごとの pre-apply comparison と required metadata を表示しない。Direct receipt は `diff` を保持するが `App.tsx` は表示しない。
4. **Relation collaboration incomplete**: manual create は kind=`supports`、reason=`created by user` 固定。Agent tool set に `propose_relation` がなく、AI Relation Proposal の accept/change/reject UI evidence もない。
5. **E2E evidence overclaims coverage**: `ce2e-f2.spec.ts` は2 test で、Direct bridge apply/undo と bridge relation/persistence を確認する。F2-02 Proposal lifecycle、F2-03 user UI、F2-05 comparison assertions は未実装。

## Re-Acceptance Findings (2026-08-13)

- 前回の Direct stale guard、body allowlist、comparison表示、Relation editor / AI proposal、F2 lifecycle E2E は修正を確認した。
- 新規 blocker: React Flow の複数選択後、`CanvasArea.onNodeClick` が `setActiveNode(node.id)` を呼び、`useAppStore.setActiveNode` が `selectedNodeIds: [id]` に上書きする。実画面で Ctrl/Shift+click 後の selected count は1、Compare は `compare requires at least 2 text nodes` で停止した。
- F2-01 / F2-03 E2E は `app.selectNodes([sourceA, sourceB])` で domain selection を直接注入しており、実UIの複数選択経路を検証していない。

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
