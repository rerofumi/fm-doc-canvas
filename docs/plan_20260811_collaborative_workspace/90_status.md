
# Status

state: done
worklog: enabled

tier: Full
plan: plan_20260811_collaborative_workspace

## Planning Scope

- Implementation slice: D-12 Text Node Contract + D-02 Workspace/Canvas boundary + F-1 Shared Workspace Contract
- Core E2E: in scope
- F-2 through F-6: separate plans after their Go gates

## Acceptance Table

`WP`はprimary implementation ownerを示す。WP-5は全REQのverification overlayであり、WP-5自身に実装作業があるrow以外へ重複記載しない。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | Blank Workspace start / New・Discard | store/component + CE2E-01 | E1 | WP-2 | implemented | App.tsx removes initial Artifact effect; Header `New Workspace` / `+ Text` / `+ Artifact`; domain `newWorkspace`/`discardWorkspace` clear document+runtime. Domain test `blank workspace has no nodes`. CE2E-01 automated in `ce2e-foundation.spec.ts` (受入再実行 pass). | pass — `mise run test`、Core E2E CE2E-01 pass |
| REQ-02 | One text-bearing node / reversible Text↔Artifact role | reducer/normalization + CE2E-02 | E1 | WP-1 | implemented | `frontend/src/domain/workspace.ts` TextBearingNode role; `switchTextRole` keeps id/content/filename; EditorDrawer role toggle; domain test `text/artifact role switch keeps identity and filename`. | pass — domain test、CE2E-02 pass |
| REQ-03 | Workspace/root/SubCanvas identity and Current Canvas scope | invariant + CE2E-03 | E1 | WP-1, WP-2 | implemented | Canvas tree invariants; FolderNode + breadcrumb; patch: structural `navigateParent` independent of mutation Undo/history, nested edit-retention domain test + CE2E parent hierarchy test. | pass — domain test、CE2E-03 pass |
| REQ-04 | Subtree move/dissolve/cycle guard/cross Relation/undo | reducer/roundtrip + CE2E-03 | E1 | WP-1, WP-2 | implemented | `createSubCanvas`/`dissolveSubCanvas`/`moveFolderSubtree` cycle reject; history undo; boundary aggregates in `projectToFlow.ts`. Domain test plus CE2E-03b verify down-folder and up-boundary projection for a cross-canvas Relation. | pass — domain test、CE2E-03/03b pass |
| REQ-05 | V1.3 persistence and V1.0〜V1.2 migration | fixture migration/roundtrip/failure | E1 | WP-1 | implemented | `workspacePersistence.ts` V1.3 serialize/load + V1.0-1.2 adapters; unknown version fails; domain test `V1.2 migration and V1.3 roundtrip` / `unknown version fails`. | pass — domain test、CE2E-02/05 pass |
| REQ-06 | Memory-only Dialogue and Save/Export/Discard lifetime | persistence assertions + CE2E-01/05 | E1 | WP-2, WP-3 | implemented | App.tsx removed Load/SaveChatSessions effects and beforeunload flush; `app.go` Load/SaveChatSessions no-op; Save uses V1.3 workspace JSON without Dialogue. CE2E-01 verifies New Workspace clears memory-only Dialogue; CE2E-04b exercises active-run Stop. Acceptance session additionally confirmed native app close → restart does not restore Dialogue session. | pass — native app終了・再起動で Dialogue session が消えることを確認 |
| REQ-07 | Bounded active Dialogue context only | request/mock LLM integration + CE2E-04 | E1 | WP-3 | implemented | `resolveContext` + `buildChatRequest` use the shared allowlist; `boundedDialogueHistory` excludes streaming/error/cancelled and caps history. Acceptance-gap test passes. | pass — bounded history test、Core E2E pass |
| REQ-08 | Complete Context Resolver/body allowlist and scope exclusion | resolver/Go validation + CE2E-03/04 | E1 | WP-3 | implemented | Pure resolver with exclusion, folder metadata-only, no child body via parent folder; Go DTO validates snapshot/edge/direct context/allowlist and complete scope envelope. Domain and backend scope tests pass. | pass — `mise run test`、CE2E-03/04 pass |
| REQ-09 | Context preview/exclusion and Direct Action boundary | payload + browser E2E | E1 | WP-3 | implemented | `ContextPreview.tsx` and PromptBar use the same resolver; Direct text/image payloads apply the allowlist, including image binary conversion only for allowlisted image nodes. CE2E context/exclusion and keyboard suites pass. | pass — `mise run test`、Core E2E 11/11 pass |
| REQ-10 | Proposal accept/modify/reject/Stop/undo | state integration + CE2E-04 | E1 | WP-4 | implemented | Domain proposal state machine plus store decision API; ToolCard exposes Accept/Modify/Reject, correlation-aware Resolve ack, revision conflict and stale handling. CE2E-04b performs Modify, Reject, Stop and stale-after-new-workspace. | pass — acceptance-gap test、CE2E-04b pass |
| REQ-11 | Workspace/Canvas/generation/revision correlation and stale rejection | concurrent/cancel integration + CE2E-04 | E1 | WP-3, WP-4 | implemented | Runtime has runtimeGeneration/scopeEpoch/asyncRuns; backend validates scope DTO and rejects Resolve correlation mismatch; frontend compare-and-apply rejects stale/conflict. Backend test and CE2E-04b pass. | pass — `mise run test`、CE2E-04b pass |
| REQ-12 | Import/Export role and filename contract | Backend/role tests + CE2E-02/05 | E1 | WP-1, WP-2 | implemented | Backend `ImportFileResult.Filename`; text drop imports Artifact role with basename; export uses role/filename via `exportNode`. | pass — domain test、CE2E-02/05 pass |
| REQ-13 | Transactional failure handling, including undo | fault injection + browser E2E assertion | E1 | WP-1, WP-2, WP-3, WP-4 | implemented | Domain undo fault seam `undo-before-commit` in commands; load failures keep prior state; CE2E-05b strictly asserts node count, command sequence, content, and actionable error remain correct. | pass — acceptance-gap test、CE2E-05b pass |
| REQ-14 | E2E temp isolation, fake providers, no credential/network | harness assertions/artifact inspection | E1 | WP-0, WP-5 | implemented | Ports tests pass; `mise run e2e` uses `FM_E2E=1` + temp root, strips provider env, loopback route deny in smoke, process-tree cleanup. Full CE2E scenario coverage still WP-5. | pass — `mise run e2e` pass、temp root removed、loopback guard active |
| REQ-15 | Keyboard/accessibility semantics | keyboard E2E + automated assertions | E1 | WP-2 | implemented | Accessible names/roles/pressed state exist on primary controls, dialogue Stop/Send, proposal decisions, and PromptBar mode/send controls. Keyboard smoke and proposal UI E2E pass. | pass — Core E2E keyboard suites、CE2E-04b pass |
| REQ-16 | All plan-defined test/build/E2E commands pass | command output | E1 | WP-0, WP-5 | implemented | Pass: Go test/vet, frontend test, Wails production build, and **`mise run e2e` CE2E-01〜05 + gap suites (11 passed)**. | pass — `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` を受入再実行して全て pass |
| REQ-17 | Windows WebView2 native smoke | documented native steps/result | E2 | WP-5 | implemented | User acceptance session confirmed native app launch, blank start, drag/drop, role switch, SubCanvas navigation, native Save/Load/Export dialogs, New Workspace, and Dialogue non-restoration after restart. | pass — native smoke 全項目 OK |
| REQ-18 | Explicit Canvas target and reserved Delegated/Projected contract | resolver/type/component fixture + CE2E-03/04 | E1 | WP-2, WP-3 | implemented | `Use this Canvas as context` command; types for DelegatedSessionRef/ProjectedContextRef; ContextPreview reserved sections when non-empty. | pass — CE2E-03/04 pass |
| REQ-19 | Human UX/predictability | review protocol + separate acceptance record | E4 | WP-5 | implemented | User acceptance session confirmed all required journeys and accepted minor UI behavior observations without blocking release. | pass — human UX acceptance OK; minor UI observations recorded as non-blocking |

## WP-0 Adoption Gate

status: GO — Playwright 1.62.1 + Wails binding smoke and product/gap suites passed (`mise run e2e`, 11 tests)

| Candidate | Confirmed evidence | Missing Go evidence | Decision |
| --- | --- | --- | --- |
| `@playwright/test` 1.62.1 | `mise run e2e` pass: msedge headless + `Greet` binding + CE2E product/gap suites + process cleanup + temp root | native WebView2 smoke is separately accepted by user session | **Go** |
| Backend/Frontend seams | `backend/ports.go` + `ports_test.go` pass; `NewAppWithOptions`; Frontend `runtimeEnvironment.tsx`; mise pin Go 1.26.1 / Node 24.14.1 | full E2E orchestration against Wails dev | PARTIAL Go for seams |

WP-0 runner is **Go**. CE2E-01〜05 and acceptance-gap scenarios are implemented and green on this harness; native REQ-17 was separately accepted by user session.

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise x -- go test -count=1 ./...` | implemented | 2026-08-11 impl: ok backend (ports tests); main package no tests | pass — 受入再実行 exit 0 |
| Go vet | `mise x -- go vet ./...` | implemented | 2026-08-11 impl: pass | pass — 受入再実行 exit 0 |
| Frontend logic | `mise x -- npm --prefix frontend run test` | implemented | sprint-c + domainFoundation pass | pass — 受入再実行 exit 0 |
| Frontend build | `mise x -- npm --prefix frontend run build` | implemented | tsc + vite build pass | pass — Wails production build内のFrontend compileも pass |
| Core E2E | `mise run e2e` / CE2E-01〜05 | implemented | 2026-08-12: `mise run e2e` 11 passed (WP0 + CE2E-01〜05 + cross-canvas/proposal/undo/keyboard acceptance gaps). Playwright 1.62.1 / msedge. | pass — 受入再実行 11 passed、temp root removed |
| Wails build | `mise run build` | todo | not re-run in impl session | pass — 受入再実行 exit 0、windows/amd64 exe生成 |
| Native smoke | REQ-17 steps on Windows 11 / WebView2 | implemented | User acceptance session: all native smoke steps pass | pass |
| Human UX review | REQ-19 separate acceptance-session review | implemented | User acceptance session: required journeys understood; minor UI observations accepted as non-blocking | pass |
| REQ traceability | Claim → REQ → Spec/WP → evidence rows | implemented | REQ-01〜19 set equality maintained | - |
| Worklog coverage | Steps 0〜8 before implementation handoff; Step 9 during impl; Step 10 acceptance | implemented | `91_worklog.md` WL-001〜WL-018 | - |

## Evidence Class Notes

- E1: automated command and output.
- E2: runtime/manual observation steps and result.
- E3: implementation pointer (file + symbol/line/diff excerpt).
- E4: acceptance-session or human judgment.
- E4 rowのimplementerはreview build / journey /観察項目をEvidenceへ置いた時だけ`implemented`にできる。合否は別sessionがAcceptanceへ記入する。
- EX: not directly verifiable; include reason, fallback verification, residual risk, and decision condition.

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-11 | Codex acceptance session | CONDITIONAL / NOT ACCEPTED | `mise run test`、`go vet`、`mise run build`、`mise run e2e`（7 passed）は pass。ただし REQ-04/06〜11/13/15/17/19 に未完了または受入証拠不足が残るため、F1 全体を `done` にはしない。 |
| 2026-08-12 | Codex acceptance session | CONDITIONAL / NOT ACCEPTED | 実装引き継ぎ後、`mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e`（11 passed）を再実行。REQ-06 は native app 終了→再起動で Dialogue session が復元されないことを確認し、受入済み。REQ-17 native WebView2 smoke、REQ-19 human UX review が未実施のため、F1 全体を `done` にはしない。 |
| 2026-08-12 | User acceptance session | ACCEPTED | REQ-17 native smoke の全項目、REQ-19 human UX journey を確認。細かい UI 挙動の指摘はあるが、現時点で修正不要として受入。F1 を `done` とする。 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.


