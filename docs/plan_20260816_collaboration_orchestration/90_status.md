# Status

state: done
worklog: enabled

tier: Full
plan: plan_20260816_collaboration_orchestration

## Planning Scope

- Implementation slice: F-6 Collaboration Orchestration core（manual Next Action Proposal + human-controlled single dispatch）
- Core E2E: in scope（F6-01〜F6-07）
- Worklog: enabled
- Initial allowlist: clarify / compare / counterpoint / web_search / suggest_relations / suggest_clusters
- Existing result surfaces: F2 Direct Transform、F3 Context Packet、F5 Relation / Cluster Proposal
- Deferred: summarize / image、AL-3 / Specialist subagent、multi-step、automatic trigger、provider/model cockpit、proposal persistence
- External API / dependency: existing LLM / Web Search only。新規 API / package / module なし

## Acceptance Table

`WP` は primary implementation owner。実装 session は Implementer state / Evidence のみ更新し、Acceptance は別 session / human が記入する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | ChatDrawerからの明示起動、no auto trigger、progress / local cancel | UI/store test、F6-01/05 | E1 | WP-4 | implemented | `frontend/src/components/collaboration/NextActionPanel.tsx`、`frontend/src/store/useAppStore.ts:requestNextActions/cancelNextActionRequest`、`mise run e2e` 40 passed | pass |
| REQ-02 | Focus / Dialogue / selection / Relation / Viewのbounded planner context、Image metadata-only | payload test、F6-01/05 | E1 | WP-1 | implemented | `frontend/src/domain/orchestration.ts:buildNextActionRequest` が既存 `boundedDialogueHistory(messages, 12)` を再利用、`frontend/src/tests/f6Orchestration.test.ts` の streaming/error/cancelled/empty除外・12件上限・bounded payload assertion、`backend/orchestration.go:NextActionRequest` | pass |
| REQ-03 | deterministic capability eligibilityとunavailable拒否 | Go/TS validator、F6-01/05 | E1 | WP-1 | implemented | `backend/orchestration.go:EligibleNextActionKinds/ParseNextActions`、`frontend/src/domain/orchestration.ts:eligibleNextActionKinds`、`f6Orchestration.test.ts` eligibility、`mise exec -- go test -count=1 ./...` pass | pass |
| REQ-04 | provider最大1 callのone-shot、真のno-contextだけclarify、no Tool / mutation / Dialogue side effect | backend call-count、F6-01/05/06 | E1 | WP-2/6 | implemented | `app.go:SuggestNextActions` は NodeHints を含む canvas context を provider-backed とし、空canvasだけ provider call なし deterministic clarify。`app_test.go:TestSuggestNextActionsCanvasHintsAreProviderBacked`、Go tests pass、F6-06 E2E pass | pass |
| REQ-05 | Action DTO、1〜3件、required/enum/target/arity/duplicate全体validation | Go/TS parser tests | E1 | WP-1/6 | implemented | `backend/orchestration.go:ParseNextActions` の kind別 shape（unknown field/trailing JSON/余計なquery・questionをreject）・whole-set strict validation、`backend/orchestration_test.go` matrix、frontend F6 domain test、Go/frontend tests pass | pass |
| REQ-06 | kind→role/AL/route/control固定mapping | contract fixture test | E1 | WP-1 | implemented | `backend/orchestration.go:nextActionMappings`、`backend/orchestration_test.go:TestParseNextActionsAssignsFixedMapping`、generated `frontend/wailsjs/go/models.ts`、Go tests exit 0 | pass |
| REQ-07 | cardsにrole/AL/target/reason/result/effect/control表示 | component、F6-01、UX | E1 / E4 | WP-4 | implemented | `frontend/src/domain/orchestration.ts:NEXT_ACTION_MAPPINGS` と `NextActionPanel.tsx` の質問者/比較者、AL-0（Ask）/AL-1（Suggest）/AL-2（Execute）、Dialogue/Direct/Web/Relation/Cluster表示、長文panel scroll、全E2E 41 passed。Human実機承認 | pass |
| REQ-08 | Close / re-suggest / reject / execute、target subset / query編集 | domain/UI、F6-01〜04 | E1 | WP-4 | implemented | `NextActionPanel.tsx` edit/reject/close/re-suggest controls、`ce2e-f6.spec.ts:F6-01〜04`、全E2E 40 passed | pass |
| REQ-09 | clarify一問、採用時だけDialogue追加・ChatInput focus | fixture/component、F6-05、UX | E1 / E4 | WP-4 | implemented | `frontend/src/store/useAppStore.ts:dispatchNextAction`、`ChatInput.tsx:fm:focus-chat-input`、`ce2e-f6.spec.ts:F6-05`、全E2E 41 passed。Human実機承認 | pass |
| REQ-10 | exact-target compare/counterpointを既存Direct Transformで一回実行、undo/stale維持 | dispatcher/store、F6-02 | E1 | WP-3 | implemented | `frontend/src/store/useAppStore.ts:runDirectTransform/dispatchNextAction`（既存 applyDirectTransform 再利用）、`ce2e-f6.spec.ts:F6-02`、全E2E 40 passed | pass |
| REQ-11 | edited queryを既存Web routeへ一回dispatchしContext Packetへ戻す | fake provider、F6-03 | E1 | WP-3 | implemented | `frontend/src/store/useAppStore.ts:dispatchNextAction` web_search route、`ce2e-f6.spec.ts:F6-03`、全E2E 40 passed | pass |
| REQ-12 | Relation / Cluster direct suggestionへdispatchしfeature Acceptと分離 | proposal integration、F6-04 | E1 | WP-3 | implemented | `frontend/src/store/useAppStore.ts:dispatchNextAction` relation/cluster routes、`ce2e-f6.spec.ts:F6-04` Relation/Cluster UI dispatch + existing proposal surfaces、全E2E 40 passed | pass |
| REQ-13 | single child action、double/concurrent dispatch拒否、no chaining | concurrency、F6-02〜04 | E1 | WP-3 | implemented | `frontend/src/store/useAppStore.ts:dispatchNextAction` dispatching guard、`NextActionPanel.tsx` の全card/target/query/re-suggest/Close/reject disabled と live status、`ce2e-f6.spec.ts:F6-02` disabled assertions + `Promise.all` concurrent dispatch assertion、全E2E 40 passed | pass |
| REQ-14 | existing result surfaceを主結果とし独自long answer/logを作らない | store/UI、F6-02〜04、UX | E1 / E4 | WP-3 | implemented | `frontend/src/store/useAppStore.ts:dispatchNextAction` が `NEXT_ACTION_MAPPINGS[item.kind].resultSurface` をreceiptへ保存、`ce2e-f6.spec.ts:F6-02〜04` existing Direct/Context/Proposal surfaces、全E2E 41 passed。Human実機承認 | pass |
| REQ-15 | orchestration state runtime-only、lifecycle clear、V1.3非保存 | lifecycle/persistence、F6-05 | E1 | WP-3 | implemented | `frontend/src/store/useAppStore.ts` runtime-only orchestration fields + New/navigation resets、`ce2e-f6.spec.ts:F6-05` の `expect(persisted).not.toContain("orchestration")` と New/Load/navigation assertions、全E2E 40 passed | pass |
| REQ-16 | request/scope/revision correlation、cancel / stale / late result no-op | concurrent/stale、F6-05 | E1 | WP-3 | implemented | `frontend/src/domain/orchestration.ts:revalidateNextActionScope` all source revisions/contextDigest/focus/selection、`ce2e-f6.spec.ts:F6-02/F6-05` revision/navigation/cancel-late、全E2E 40 passed | pass |
| REQ-17 | provider/JSON/action/target errorのno-opとactionable recovery、no fallback menu | fault tests、F6-05/06 | E1 / E4 | WP-1/2/3/4/6 | implemented | `app.go` typed orchestration error、NextActionPanel の「再提案/対象変更/通常Chat」回復文言、global banner除外。F6-06 pass、Human実機承認 | pass |
| REQ-18 | accessible names / keyboard / live regions、既存導線non-regression | browser、F6-01/05/07、UX | E1 / E2 / E4 | WP-4/5/6 | implemented | strict Gemini tool continuation fake、F6-07 Chat UI、長文panel scroll、Core E2E 41 passed。Human実機承認 | pass |
| REQ-19 | fake-only F6-01〜07、fixture ranking/fault/delay/dispatch/real-shape/tool continuation、F1〜F5 regression | harness、`mise run e2e` | E1 | WP-0/5/6 | implemented | `frontend/e2e/ce2e-f6.spec.ts:F6-06` synthetic 9-node Japanese Markdown/multi-URL/accepted relation/provenance/query、未選択/1件/2件の再提案とfault recovery、F6-07 Chat continuation。全Core E2E 40 passed | pass |
| REQ-20 | test/vet/frontend+Wails build/Core E2E pass、F6 test entry登録 | plan commands | E1 | WP-5/6 | implemented | `mise exec -- go test -count=1 ./...`, `mise exec -- go vet ./...`, frontend test/build、`mise run build` pass。`mise run e2e` 40 passed（runtime:ready warningのみ） | pass |
| REQ-21 | proposal layerと3 route familyの独立E4、proposal Go + 2/3 family Go + control Stopなし | task-based review | E4 | WP-5/6 | implemented | HumanがF6要素の実機動作を期待どおりとして一括承認。proposal layer、Transform / Research / Structure、Context / ControlをGo | pass |
| REQ-22 | Focus/selection無しでもCurrent Canvas bounded contextから助言 | resolver/backend、F6-06、UX | E1 / E4 | WP-6 | implemented | canvas-wide Text-bearing fallback、F6-06 pass、Human実機承認 | pass |
| REQ-23 | 通常Chatのread_canvas_node後provider continuationが400にならない | request-shape test、F6-07、実API | E1 / E2 | WP-6 | implemented | tool resultの`tool_call_id`/`name`とthought signature保持、strict HTTP 400 fake、F6-07 pass。Human実機承認 | pass |
| NFR-01 | 新規dependency/APIなし | package/go.mod/mise diff | E3 | WP-0/5 | implemented | `jj diff -- go.mod frontend/package.json mise.toml`: package script/test entryのみ、Go module/mise変更なし | pass |
| NFR-02 | planner read-only、child既存transaction、fault時partial stateなし | state snapshot/fault | E1 | WP-2/3 | implemented | `app.go:SuggestNextActions`、`useAppStore.ts:dispatchNextAction`、`ce2e-f6.spec.ts:F6-02〜05`、Go/frontend tests pass | pass |
| NFR-03 | secret/pixel/full body/raw logなし、bounded history/hints | payload/inspection | E1 / E3 | WP-1/2 | implemented | `frontend/src/domain/orchestration.ts:buildNextActionRequest` bounded hints + `boundedDialogueHistory`、`backend/orchestration.go:NextActionRequest/BuildNextActionPrompt`、`f6Orchestration.test.ts` incomplete history exclusion/12 limit/payload assertions | pass |
| NFR-04 | 最大3 actions / 40 nodes、上限超過no silent truncation | limit tests | E1 | WP-1 | implemented | `backend/orchestration.go` parser count/arity matrix、`frontend/src/domain/orchestration.ts:buildNextActionRequest` eligible planner IDs cap、`f6Orchestration.test.ts` 40 valid accepted/41 valid rejected assertions、`orchestration_test.go:TestParseNextActionsValidationMatrix` | pass |
| NFR-05 | runtime-only、V1.3不変、telemetry/raw history非保存 | roundtrip/inspection | E1 / E3 | WP-3/5 | implemented | `useAppStore.ts` runtime-only orchestration fields、`ce2e-f6.spec.ts:F6-05` の persisted JSON `not.toContain("orchestration")`、foundation V1.3 roundtrip E2E pass | pass |
| NFR-06 | pending/dispatch重複抑止、requestId一意correlation | concurrency tests | E1 | WP-3 | implemented | `useAppStore.ts:requestNextActions/dispatchNextAction` guards、`frontend/src/tests/f6Orchestration.test.ts` stale correlation、F6-02/F6-05 E2E | pass |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer / dependency / persistence inspection。
- E4: separate acceptance session / human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision conditionを記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` | implemented | `mise exec -- go test -count=1 ./...` exit 0（fm-doc-canvas/backend） | pass |
| Go vet | `mise exec -- go vet ./...` | implemented | `mise exec -- go vet ./...` exit 0 | pass |
| Frontend logic/domain | `mise exec -- npm --prefix frontend run test`（F6 test名を確認） | implemented | `test:f6` entryを実行、既存Sprint/Domain/Acceptance + F6 orchestration tests pass | pass |
| Frontend build | `mise exec -- npm --prefix frontend run build` | implemented | `mise exec -- npm --prefix frontend run build` exit 0 | pass |
| Wails production build | `mise run build` | implemented | `mise run build` exit 0、Wails v2.12.0 bindings/frontend/Windows build completed | pass |
| Core E2E | `mise run e2e`（F6-01〜07 + F1〜F5） | implemented | `mise run e2e` 40 passed。Wails `runtime:ready -> Unknown message from front end` warning は既存環境ノイズとして残るがテスト失敗なし | pass |
| Dependency / API diff | `package.json` / `go.mod` / `mise.toml` inspection | implemented | `git diff -- go.mod frontend/package.json mise.toml`、新規依存/API/moduleなし（package scriptのみ） | pass |
| Planner payload inspection | secret / pixel / full body / raw logなし | implemented | `frontend/src/domain/orchestration.ts:buildNextActionRequest`、`backend/orchestration.go:BuildNextActionPrompt` adopted read-only/1-3/available-only/selected-only/clarify contract、F6 history and bounded payload tests | pass |
| Persistence | V1.3 roundtrip、orchestration state非含入 | implemented | `useAppStore.ts` runtime-only state refs、`ce2e-f6.spec.ts:F6-05` の persisted JSON `not.toContain("orchestration")`、foundation V1.3 roundtripを含むE2E 40 passed | pass |
| Human UX / value Gate | 4 task protocol、proposal + route family別判定 | implemented | 2026-08-16 HumanがF6要素の動作確認を完了し、期待動作として承認 | pass |
| REQ traceability | Claim → REQ → Specification/WP → evidence | implemented | Functional 23件 + NFR 6件の29 IDsをSpecification/WP-6/status/evidenceへ対応付け | pass |
| Worklog coverage | Steps 0〜8 before implementation handoff | implemented | `91_worklog.md` WL-001〜WL-010 | pass |

## Acceptance Gate Matrix

| Gate area | Required status for F6 core Go | Current |
| --- | --- | --- |
| Contextual Proposal layer | Go | Go |
| Transform route | 3 family中の候補 | Go |
| Research route | 3 family中の候補 | Go |
| Structure route | 3 family中の候補 | Go |
| Context / Control safety | Stopなし | Go / Stopなし |
| Automated checks | all pass | pass — F6-01〜07とscroll回帰を含む41件pass |

F6 core `done` には、Contextual Proposal layer Go、Transform / Research / Structure のうち2 family以上 Go、Context / Control Stopなし、全automated row passが必要である。

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-16 | Planning session | planned | Full / Core E2E / worklog確認後、bounded core planを作成。実装未着手 |
| 2026-08-16 | Codex reader session | accepting | 全E1/E3を差分検査と再実行で受理。Go test/vet、frontend test/build、Wails build、Core E2E 38件 pass。REQ-07/09/14/18/21 のE4 Human Value Gate待ち |
| 2026-08-16 | Human user-side acceptance | fail / repair required | `canvas-2.json`で単一選択は常時、複数選択は間欠的に`next-actions-failed`。回復文言不適合、未選択canvas-wide助言不足、通常Chatの`read_canvas_node`後400を確認。REQ-05/17/18/19/20/21 fail、REQ-22/23追加、WP-6へ差し戻し |
| 2026-08-16 | Acceptance sub-agent round 3 | automated pass / human pending | WP-6第2修正を差分検査し、全plan commandsとCore E2E 40件を再実行。REQ-04/05/19/20とNFRはpass、REQ-17/18/21/22/23はE2/E4再確認待ち。stateはacceptingを維持 |
| 2026-08-16 | Human final acceptance | done | F6要素の実機動作が期待どおりであることを確認し承認。長文proposal scroll Patch後のCore E2E 41件passも最終証拠として採用。全REQ/NFR pass、Gate Go、stateをdoneへ更新 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
