# Status

state: planned
worklog: enabled

tier: Full
plan: plan_20260815_generated_views

## Planning Scope

- Implementation slice: F-5B Generated Structures core slice（Relation batch suggestion + Cluster View + Cluster→SubCanvas 変換 + viewHints）
- Core E2E: in scope（`F5-01`〜`F5-05`）
- Worklog: enabled, inherited from the collaborative workspace plan series
- Follow-up candidates: Library View、Layout suggestion / auto-layout、View 永続化、複数 View 同時保持、batch 項目の行内編集、新規cluster作成 / split / merge / ungrouped追加
- Collaboration boundary: coreのView-local共同編集はrename / 既存cluster間member移動 / 除外 / 削除の部分実装
- Milestone boundary: この plan は F-5B core のみ閉じられる。ロードマップ F-5B は Library View / Layout suggestion の disposition まで open
- External API: 既存 LLM Chat Completions のみ。新規 API / 新規 dependency なし

## Acceptance Table

`WP` は primary implementation owner。Acceptance は実装セッションとは別の session / human が実施する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | Relation batch の対象 scope と body / F4 Vision allowlist、metadata fallback | Resolver / request / Vision fallback test、F5-01/05 | E1 | WP-1/2 | - | - | - |
| REQ-02 | Direct `SuggestRelations` one-shot と構造化 validation | Backend DTO / validation test、F5-01 | E1 | WP-2 | - | - | - |
| REQ-03 | Dialogue `propose_relation_batch` tool、既存 pairwise 維持 | Agent tool test、F5-02 | E1 | WP-2 | - | - | - |
| REQ-04 | Batch Proposal UI（項目除外 / Accept selected / Reject / Stop）と atomic one undo | Proposal / reducer test、F5-01 | E1 | WP-1/3/4 | - | - | - |
| REQ-05 | Batch invariant と既存 RelationRecord 保存、provenance | Invariant / persistence test、F5-01 | E1 | WP-1 | - | - | - |
| REQ-06 | Cluster View draft の構成・上限・Folder除外・Image入力 validation | Backend DTO / Vision fallback test、F5-02/05 | E1 | WP-1/2 | - | - | - |
| REQ-07 | Cluster View proposal の二経路と部分共同編集 / decision | Proposal test、F5-02/03 | E1 | WP-2/3/4 | - | - | - |
| REQ-08 | Active View の非破壊 overlay（hull / label / 色 / 追従 / Close） | Renderer / projection test、F5-03 | E1 | WP-4 | - | - | - |
| REQ-09 | View lifecycle（Save非含入、navigation等で破棄、Stopでaccepted View維持、縮退） | Persistence / lifecycle / Stop test、F5-04 | E1 | WP-3 | - | - | - |
| REQ-10 | Cluster → SubCanvas変換（document + View composite undo / 境界Relation維持） | Command / history / UI test、F5-03 | E1 | WP-1/3/4 | - | - | - |
| REQ-11 | View / batch のsource revision / run stale guard | Concurrent / revision stale / Stop test、F5-04 | E1 | WP-1/2/3 | - | - | - |
| REQ-12 | Resolver `viewHints`（観測情報、限定 scope） | Resolver payload test、F5-03 | E1 | WP-1 | - | - | - |
| REQ-13 | 失敗時 no-op と actionable error、Direct の Dialogue 非追加 | Backend / frontend error test、F5-05 | E1 | WP-2/3 | - | - | - |
| REQ-14 | system prompt の batch / view 使い方と無断確定禁止 | Prompt / agent test | E1 / E3 | WP-2 | - | - | - |
| REQ-15 | accessible name / keyboard、既存導線 non-regression | Browser assertions + UX review、F5-05 | E1 / E4 | WP-4/5 | - | - | - |
| REQ-16 | F5 test entry登録、build / unit / Go / vet / Core E2E pass、F1〜F4回帰なし | `mise run test`（F5 test出力確認）、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 | WP-5 | - | - | - |
| REQ-17 | 実課題 E4 で Relation batch と Cluster View を独立に Go / Hold / Stop 判定 | Plan-defined task-based review note | E4 | WP-5 | - | - | - |

| ID | NFR summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-01 | 新規 npm / Go module を追加しない | package / go.mod diff | E3 | WP-0/5 | - | - | - |
| NFR-02 | batch適用とSubCanvas変換の単一/composite transaction、document + View部分更新なし | fault injection / composite undo | E1 | WP-1/3/5 | - | - | - |
| NFR-03 | LLM送信はbody / F4 Vision allowlistのみ、fallback安全、key / data URLを証跡へ書かない | payload / Vision fallback / inspection | E1 / E3 | WP-2/5 | - | - | - |
| NFR-04 | Generated View は Save file / document 非含入、V1.3 不変 | persistence roundtrip | E1 | WP-1/3/5 | - | - | - |
| NFR-05 | 提案上限の UI / backend 双方での強制 | validation test | E1 | WP-2/4 | - | - | - |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | - | - | - |
| Go vet | `mise exec -- go vet ./...` | - | - | - |
| Frontend logic / domain | `mise exec -- npm --prefix frontend run test`（F5 test名の出力を含む） | - | - | - |
| Frontend build | `mise exec -- npm --prefix frontend run build` | - | - | - |
| Wails production build | `mise run build` | - | - | - |
| Core E2E | `mise run e2e` / F5-01〜05 and existing F1〜F4 | - | - | - |
| Human UX review | batch proposal card、View overlay / banner、変換 dialog、error copy | - | - | - |
| F-5B core value Gate | REQ-17 task-based E4: discovery / control / friction を項目別に判定 | - | - | - |
| F-5B milestone disposition | Library View / Layout suggestion は後続候補として記録 | - | - | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence | - | - | - |
| Worklog coverage | Steps 0〜9 before implementation handoff | - | - | - |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-15 | Planning session | planned | Full 新規 plan を作成。実装未着手 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
