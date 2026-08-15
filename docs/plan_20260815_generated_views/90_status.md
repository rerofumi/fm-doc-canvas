# Status

state: done
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
| REQ-01 | Relation batch の対象 scope と body / F4 Vision allowlist、metadata fallback | Resolver / request / Vision fallback test、F5-01/05 | E1 | WP-1/2 | done | E1: 選択2 Node限定を含む automated test passed | accepted |
| REQ-02 | Direct `SuggestRelations` one-shot と構造化 validation | Backend DTO / validation test、F5-01 | E1 | WP-2 | done | E1: automated test passed | - |
| REQ-03 | Dialogue `propose_relation_batch` tool、既存 pairwise 維持 | Agent tool test、F5-02 | E1 | WP-2 | done | E1: automated test passed | - |
| REQ-04 | Batch Proposal UI（項目除外 / Accept selected / Reject / Stop）と atomic one undo | Proposal / reducer test、F5-01 | E1 | WP-1/3/4 | done | E1: modified Accept修正、atomic apply / one undo passed | accepted |
| REQ-05 | Batch invariant と既存 RelationRecord 保存、provenance | Invariant / persistence test、F5-01 | E1 | WP-1 | done | E1: automated test passed | - |
| REQ-06 | Cluster View draft の構成・上限・Folder除外・Image入力 validation | Backend DTO / Vision fallback test、F5-02/05 | E1 | WP-1/2 | done | E1: automated test passed | - |
| REQ-07 | Cluster View proposal の二経路と部分共同編集 / decision | Proposal test、F5-02/03 | E1 | WP-2/3/4 | done | E1: automated test passed | - |
| REQ-08 | Active View の非破壊 overlay（hull / label / 色 / 追従 / Close） | Renderer / projection test、F5-03 | E1 | WP-4 | done | E1: automated test passed | - |
| REQ-09 | View lifecycle（Save非含入、navigation等で破棄、Stopでaccepted View維持、縮退） | Persistence / lifecycle / Stop test、F5-04 | E1 | WP-3 | done | E1: automated test passed | - |
| REQ-10 | Cluster → SubCanvas変換（document + View composite undo / 境界Relation維持） | Command / history / UI test、F5-03 | E1 | WP-1/3/4 | done | E1: automated test passed | - |
| REQ-11 | View / batch のsource revision / run stale guard | Concurrent / revision stale / Stop test、F5-04 | E1 | WP-1/2/3 | done | E1: automated test passed | - |
| REQ-12 | Resolver `viewHints`（観測情報、限定 scope） | Resolver payload test、F5-03 | E1 | WP-1 | done | E1: automated test passed | - |
| REQ-13 | 失敗時 no-op と actionable error、Direct の Dialogue 非追加 | Backend / frontend error test、F5-05 | E1 | WP-2/3 | done | E1: automated test passed | - |
| REQ-14 | system prompt の batch / view 使い方と無断確定禁止 | Prompt / agent test | E1 / E3 | WP-2 | done | E1: automated test passed | - |
| REQ-15 | accessible name / keyboard、既存導線 non-regression | Browser assertions + UX review、F5-05 | E1 / E4 | WP-4/5 | done | E1: accessible names +解析中status、Core E2E passed | accepted |
| REQ-16 | F5 test entry登録、build / unit / Go / vet / Core E2E pass、F1〜F4回帰なし | `mise run test`（F5 test出力確認）、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 | WP-5 | done | E1: Go test / vet / npm test / npm build / Wails build / Core E2E 33 passed | automated acceptance passed |
| REQ-17 | 実課題 E4 で Relation batch と Cluster View を独立に Go / Hold / Stop 判定 | Plan-defined task-based review note | E4 | WP-5 | done | E4: 2026-08-15 task review + repair recheck | Cluster View + SubCanvas: Go、Relation batch: Go |

| ID | NFR summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-01 | 新規 npm / Go module を追加しない | package / go.mod diff | E3 | WP-0/5 | done | E3: package.json / go.mod 無変更 | - |
| NFR-02 | batch適用とSubCanvas変換の単一/composite transaction、document + View部分更新なし | fault injection / composite undo | E1 | WP-1/3/5 | done | E1: automated test passed | - |
| NFR-03 | LLM送信はbody / F4 Vision allowlistのみ、fallback安全、key / data URLを証跡へ書かない | payload / Vision fallback / inspection | E1 / E3 | WP-2/5 | done | E1/E3: automated | - |
| NFR-04 | Generated View は Save file / document 非含入、V1.3 不変 | persistence roundtrip | E1 | WP-1/3/5 | done | E1: automated test passed | - |
| NFR-05 | 提案上限の UI / backend 双方での強制 | validation test | E1 | WP-2/4 | done | E1: automated test passed | - |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | done | `go test -count=1 ./...` exit 0 | - |
| Go vet | `mise exec -- go vet ./...` | done | `go vet ./...` exit 0 | - |
| Frontend logic / domain | `mise exec -- npm --prefix frontend run test`（F5 test名の出力を含む） | done | F5 relation batch / generated view tests passed | - |
| Frontend build | `mise exec -- npm --prefix frontend run build` | done | `npm run build`（tsc + vite）exit 0 | - |
| Wails production build | `mise run build` | done | exit 0、`build/bin/fm-doc-canvas.exe` generated | automated acceptance passed |
| Core E2E | `mise run e2e` / F5-01〜05 and existing F1〜F4 | done | 33 passed（F5-01は選択2 Node限定、F5-04は解析中表示を含む） | automated acceptance passed |
| Human UX review | batch proposal card、View overlay / banner、変換 dialog、error copy | done | E4 acceptance実施、指摘修正後に再確認完了 | accepted |
| F-5B core value Gate | REQ-17 task-based E4: discovery / control / friction を項目別に判定 | done | Cluster View + SubCanvas: Go、Relation batch: Go | Go |
| F-5B milestone disposition | Library View / Layout suggestion は後続候補として記録 | done | 50_review_notes.md に記録済み | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence | done | 40_specification.md traceability table | - |
| Worklog coverage | Steps 0〜9 before implementation handoff | done | WL-001〜WL-010 | - |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-15 | Planning session | planned | Full 新規 plan を作成。実装未着手 |
| 2026-08-15 | Implementation session | implementing | WP-0〜4 を実装。Go / vet / npm test / npm build pass。Core E2E と E4 は未実施 |
| 2026-08-15 | User acceptance session | partial | Cluster View / SubCanvas は期待どおりで Go。Relation batch は選択scope不具合とAccept時エラー、Relation / Cluster解析中表示不足により Hold |
| 2026-08-15 | Acceptance fix session | awaiting recheck | 選択Node IDsの固定、modified Accept、Accept時revision guard、Relation / Cluster解析中statusを修正。frontend test / build、Core E2E 33件 pass |
| 2026-08-15 | Final human acceptance | Go | 修正版をユーザーが再確認し「良さそう」「確認完了」「受け入れ了承」と宣言。Relation batch / Cluster View + SubCanvasをともにGoとしてcore planを受理 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
