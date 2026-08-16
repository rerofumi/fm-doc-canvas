# Status

state: planned
worklog: enabled

tier: Full
plan: plan_20260816_collaboration_orchestration

## Planning Scope

- Implementation slice: F-6 Collaboration Orchestration core（manual Next Action Proposal + human-controlled single dispatch）
- Core E2E: in scope（F6-01〜F6-05）
- Worklog: enabled
- Initial allowlist: clarify / compare / counterpoint / web_search / suggest_relations / suggest_clusters
- Existing result surfaces: F2 Direct Transform、F3 Context Packet、F5 Relation / Cluster Proposal
- Deferred: summarize / image、AL-3 / Specialist subagent、multi-step、automatic trigger、provider/model cockpit、proposal persistence
- External API / dependency: existing LLM / Web Search only。新規 API / package / module なし

## Acceptance Table

`WP` は primary implementation owner。実装 session は Implementer state / Evidence のみ更新し、Acceptance は別 session / human が記入する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | ChatDrawerからの明示起動、no auto trigger、progress / local cancel | UI/store test、F6-01/05 | E1 | WP-4 | todo | - | - |
| REQ-02 | Focus / Dialogue / selection / Relation / Viewのbounded planner context、Image metadata-only | payload test、F6-01/05 | E1 | WP-1 | todo | - | - |
| REQ-03 | deterministic capability eligibilityとunavailable拒否 | Go/TS validator、F6-01/05 | E1 | WP-1 | todo | - | - |
| REQ-04 | provider最大1 callのone-shot、no-context clarify、no Tool / mutation / Dialogue side effect | backend call-count、F6-01/05 | E1 | WP-2 | todo | - | - |
| REQ-05 | Action DTO、1〜3件、required/enum/target/arity/duplicate全体validation | Go/TS parser tests | E1 | WP-1 | todo | - | - |
| REQ-06 | kind→role/AL/route/control固定mapping | contract fixture test | E1 | WP-1 | todo | - | - |
| REQ-07 | cardsにrole/AL/target/reason/result/effect/control表示 | component、F6-01、UX | E1 / E4 | WP-4 | todo | - | - |
| REQ-08 | Close / re-suggest / reject / execute、target subset / query編集 | domain/UI、F6-01〜04 | E1 | WP-4 | todo | - | - |
| REQ-09 | clarify一問、採用時だけDialogue追加・ChatInput focus | fixture/component、F6-05、UX | E1 / E4 | WP-4 | todo | - | - |
| REQ-10 | exact-target compare/counterpointを既存Direct Transformで一回実行、undo/stale維持 | dispatcher/store、F6-02 | E1 | WP-3 | todo | - | - |
| REQ-11 | edited queryを既存Web routeへ一回dispatchしContext Packetへ戻す | fake provider、F6-03 | E1 | WP-3 | todo | - | - |
| REQ-12 | Relation / Cluster direct suggestionへdispatchしfeature Acceptと分離 | proposal integration、F6-04 | E1 | WP-3 | todo | - | - |
| REQ-13 | single child action、double/concurrent dispatch拒否、no chaining | concurrency、F6-02〜04 | E1 | WP-3 | todo | - | - |
| REQ-14 | existing result surfaceを主結果とし独自long answer/logを作らない | store/UI、F6-02〜04、UX | E1 / E4 | WP-3 | todo | - | - |
| REQ-15 | orchestration state runtime-only、lifecycle clear、V1.3非保存 | lifecycle/persistence、F6-05 | E1 | WP-3 | todo | - | - |
| REQ-16 | request/scope/revision correlation、cancel / stale / late result no-op | concurrent/stale、F6-05 | E1 | WP-3 | todo | - | - |
| REQ-17 | provider/JSON/action/target errorのno-opとactionable recovery、no fallback menu | fault tests、F6-05 | E1 | WP-1/2/3/4 | todo | - | - |
| REQ-18 | accessible names / keyboard / live regions、既存導線non-regression | browser、F6-01/05、UX | E1 / E4 | WP-4/5 | todo | - | - |
| REQ-19 | fake-only F6-01〜05、fixture ranking/fault/delay/dispatch、F1〜F5 regression | harness、`mise run e2e` | E1 | WP-0/5 | todo | - | - |
| REQ-20 | test/vet/frontend+Wails build/Core E2E pass、F6 test entry登録 | plan commands | E1 | WP-5 | todo | - | - |
| REQ-21 | proposal layerと3 route familyの独立E4、proposal Go + 2/3 family Go + control Stopなし | task-based review | E4 | WP-5 | todo | - | - |
| NFR-01 | 新規dependency/APIなし | package/go.mod/mise diff | E3 | WP-0/5 | todo | - | - |
| NFR-02 | planner read-only、child既存transaction、fault時partial stateなし | state snapshot/fault | E1 | WP-2/3 | todo | - | - |
| NFR-03 | secret/pixel/full body/raw logなし、bounded history/hints | payload/inspection | E1 / E3 | WP-1/2 | todo | - | - |
| NFR-04 | 最大3 actions / 40 nodes、上限超過no silent truncation | limit tests | E1 | WP-1 | todo | - | - |
| NFR-05 | runtime-only、V1.3不変、telemetry/raw history非保存 | roundtrip/inspection | E1 / E3 | WP-3/5 | todo | - | - |
| NFR-06 | pending/dispatch重複抑止、requestId一意correlation | concurrency tests | E1 | WP-3 | todo | - | - |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer / dependency / persistence inspection。
- E4: separate acceptance session / human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision conditionを記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` | todo | - | - |
| Go vet | `mise exec -- go vet ./...` | todo | - | - |
| Frontend logic/domain | `mise exec -- npm --prefix frontend run test`（F6 test名を確認） | todo | - | - |
| Frontend build | `mise exec -- npm --prefix frontend run build` | todo | - | - |
| Wails production build | `mise run build` | todo | - | - |
| Core E2E | `mise run e2e`（F6-01〜05 + F1〜F5） | todo | - | - |
| Dependency / API diff | `package.json` / `go.mod` / `mise.toml` inspection | todo | - | - |
| Planner payload inspection | secret / pixel / full body / raw logなし | todo | - | - |
| Persistence | V1.3 roundtrip、orchestration state非含入 | todo | - | - |
| Human UX / value Gate | 4 task protocol、proposal + route family別判定 | todo | - | - |
| REQ traceability | Claim → REQ → Specification/WP → evidence | implemented | `30_requirement.md` と `90_status.md` の27 IDs一致、`40_specification.md` traceability table | - |
| Worklog coverage | Steps 0〜8 before implementation handoff | implemented | `91_worklog.md` WL-001〜WL-010 | - |

## Acceptance Gate Matrix

| Gate area | Required status for F6 core Go | Current |
| --- | --- | --- |
| Contextual Proposal layer | Go | untested |
| Transform route | 3 family中の候補 | untested |
| Research route | 3 family中の候補 | untested |
| Structure route | 3 family中の候補 | untested |
| Context / Control safety | Stopなし | untested |
| Automated checks | all pass | todo |

F6 core `done` には、Contextual Proposal layer Go、Transform / Research / Structure のうち2 family以上 Go、Context / Control Stopなし、全automated row passが必要である。

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-16 | Planning session | planned | Full / Core E2E / worklog確認後、bounded core planを作成。実装未着手 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
