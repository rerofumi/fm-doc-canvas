# Status

state: planned
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
| REQ-01 | Blank Workspace start / New・Discard | store/component + CE2E-01 | E1 | WP-2 | todo | - | - |
| REQ-02 | One text-bearing node / reversible Text↔Artifact role | reducer/normalization + CE2E-02 | E1 | WP-1 | todo | - | - |
| REQ-03 | Workspace/root/SubCanvas identity and Current Canvas scope | invariant + CE2E-03 | E1 | WP-1, WP-2 | todo | - | - |
| REQ-04 | Subtree move/dissolve/cycle guard/cross Relation/undo | reducer/roundtrip + CE2E-03 | E1 | WP-1, WP-2 | todo | - | - |
| REQ-05 | V1.3 persistence and V1.0〜V1.2 migration | fixture migration/roundtrip/failure | E1 | WP-1 | todo | - | - |
| REQ-06 | Memory-only Dialogue and Save/Export/Discard lifetime | persistence assertions + CE2E-01/05 | E1 | WP-2, WP-3 | todo | - | - |
| REQ-07 | Bounded active Dialogue context only | request/mock LLM integration + CE2E-04 | E1 | WP-3 | todo | - | - |
| REQ-08 | Complete Context Resolver/body allowlist and scope exclusion | resolver/Go validation + CE2E-03/04 | E1 | WP-3 | todo | - | - |
| REQ-09 | Context preview/exclusion and Direct Action boundary | payload + browser E2E | E1 | WP-3 | todo | - | - |
| REQ-10 | Proposal accept/modify/reject/Stop/undo | state integration + CE2E-04 | E1 | WP-4 | todo | - | - |
| REQ-11 | Workspace/Canvas/generation/revision correlation and stale rejection | concurrent/cancel integration + CE2E-04 | E1 | WP-3, WP-4 | todo | - | - |
| REQ-12 | Import/Export role and filename contract | Backend/role tests + CE2E-02/05 | E1 | WP-1, WP-2 | todo | - | - |
| REQ-13 | Transactional failure handling, including undo | fault injection + browser E2E assertion | E1 | WP-1, WP-2, WP-3, WP-4 | todo | - | - |
| REQ-14 | E2E temp isolation, fake providers, no credential/network | harness assertions/artifact inspection | E1 | WP-0, WP-5 | todo | - | - |
| REQ-15 | Keyboard/accessibility semantics | keyboard E2E + automated assertions | E1 | WP-2 | todo | - | - |
| REQ-16 | All plan-defined test/build/E2E commands pass | command output | E1 | WP-0, WP-5 | todo | - | - |
| REQ-17 | Windows WebView2 native smoke | documented native steps/result | E2 | WP-5 | todo | - | - |
| REQ-18 | Explicit Canvas target and reserved Delegated/Projected contract | resolver/type/component fixture + CE2E-03/04 | E1 | WP-2, WP-3 | todo | - | - |
| REQ-19 | Human UX/predictability | review protocol + separate acceptance record | E4 | WP-5 | todo | - | - |

## WP-0 Adoption Gate

status: HOLD — candidate verification pending

| Candidate | Confirmed evidence | Missing Go evidence | Decision |
| --- | --- | --- | --- |
| `@playwright/test` 1.62.1 | npm current version and CLI `Version 1.62.1` | real browser + Wails binding smoke、temp isolation、success/failure cleanup | HOLD |

WP-0 が No-Go の場合、WP-1 以降へ進まない。実行済み vertical smoke を持つ代替 runner を調査し、`40_specification.md`、cheatsheet、status を amend する。

## Plan Checks

Baseline は 2026-08-11 の planning session で成功済みだが、実装後 evidence の代わりにはしない。

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise x -- go test -count=1 ./...` | todo | Baseline pass; post-change run required | - |
| Go vet | `mise x -- go vet ./...` | todo | Baseline pass; post-change run required | - |
| Frontend logic | `mise x -- npm --prefix frontend run test:sprint-c` or documented successor | todo | Baseline pass; post-change run required | - |
| Frontend build | `mise x -- npm --prefix frontend run build` | todo | Baseline pass; post-change run required | - |
| Core E2E | `mise run e2e` / CE2E-01〜05 | todo | Task not yet implemented | - |
| Wails build | `mise run build` | todo | Baseline Wails v2.12.0 windows/amd64 pass; post-change run required | - |
| Native smoke | REQ-17 steps on Windows 11 / WebView2 | todo | - | - |
| Human UX review | REQ-19 separate acceptance-session review | todo | - | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence rows | implemented | REQ-01〜19 set equality + independent trace audit; see `30_requirement.md` / `40_specification.md` / this table | - |
| Worklog coverage | Steps 0〜8 before implementation handoff | implemented | `91_worklog.md` WL-001〜WL-012 | - |

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

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
