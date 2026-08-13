# Status

state: planned
worklog: enabled

tier: Full
plan: plan_20260813_multimodal_context

## Planning Scope

- Implementation slice: F-4 Multimodal Transform core slice（F-4A + Vision Context / intent-vs-result）
- Core E2E: in scope（`F4-01`〜`F4-05`）
- Worklog: enabled, inherited from the collaborative workspace plan series
- Follow-up candidates: 確認付き再生成、AL-3、`fm-image-assistant`、Dialogue provider picker
- Milestone boundary: この plan は F4 core のみ閉じられる。ロードマップ F-4 は後続候補の disposition まで open
- External API: 既存 Image Provider / LLM Vision。新規 API なし。実画質は Conditional であり Core E2E の合格条件ではない

## Acceptance Table

`WP` は primary implementation owner。Acceptance は実装セッションとは別の session / human が実施する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | 明示 prompt と選択 context / 参照画像だけを解決する | resolver test + F4-01/02 | E1 | WP-1 | todo | - | - |
| REQ-02 | `generate_image` は既定 ImagePort を一度呼び、document を変えない | tool test + F4-01 | E1 | WP-3 | todo | - | - |
| REQ-03 | PromptBar Direct Action は Dialogue 非追加で同じ Variant 契約 | route test + F4-02 | E1 | WP-4 | todo | - | - |
| REQ-04 | Dialogue 結果は Proposal。accept 前に Node 化しない | proposal test + F4-01 | E1 | WP-2 | todo | - | - |
| REQ-05 | Image Variant は atomic Node + derived + one undo | reducer + F4-01/02 | E1 | WP-2 | todo | - | - |
| REQ-06 | provenance `origin=image` を Save/Load する | persistence + F4-01 | E1 | WP-2 | todo | - | - |
| REQ-07 | Dialogue Vision は明示 Image 最大 3 枚の `image-binary` | resolver + F4-03 | E1 | WP-1 | todo | - | - |
| REQ-08 | Agent は allowlist pixel を送り、外は metadata only | payload test + F4-03 | E1 | WP-3 | todo | - | - |
| REQ-09 | 意図と結果の差分を AL-0/1 で説明し、自動再生成しない | fixture + F4-03 / E4 | E1/E4 | WP-3/5 | todo | - | - |
| REQ-10 | 未採用 Proposal を Save / 次 Context から除外する | persistence + F4-01 | E1 | WP-1/2 | todo | - | - |
| REQ-11 | stale / Stop / navigation 後の遅着配置を no-op にする | stale test + F4-04 | E1 | WP-3 | todo | - | - |
| REQ-12 | unauthorized / timeout / empty で document 不変 | error test + F4-05 | E1 | WP-3 | todo | - | - |
| REQ-13 | 主要操作が accessible で、PromptBar Image が退行しない | browser + UX review | E1/E4 | WP-4/5 | todo | - | - |
| REQ-14 | Core E2E は fake image / fake LLM。実 key / 外部ネットワークなし | harness inspection | E1 | WP-0/5 | todo | - | - |
| REQ-15 | plan-defined test / vet / build / Core E2E が pass し F1〜F3 を壊さない | command output | E1 | WP-5 | todo | - | - |
| REQ-16 | 実課題で再入力減少・差分共有・Direct 非劣化・負担を評価し F4 core Gate を判定する | separate task-based review | E4 | WP-5 | todo | - | - |
| NFR-01 | 新規 npm / Go module を追加しない | package / go.mod diff | E3 | WP-0/5 | todo | - | - |
| NFR-02 | tool は非 mutation。配置失敗で部分更新しない | fault injection | E1 | WP-2/5 | todo | - | - |
| NFR-03 | 外部送信を allowlist に限定し、data URL を persist しない | payload / JSON inspection | E1/E3 | WP-3/5 | todo | - | - |
| NFR-04 | Image / LLM key を canvas / Dialogue / E2E / docs に書かない | config inspection | E3 | WP-3/5 | todo | - | - |
| NFR-05 | undo / reject は物理ファイルを消さない | file inspection | E2/E3 | WP-2/5 | todo | - | - |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | todo | - | - |
| Go vet | `mise exec -- go vet ./...` | todo | - | - |
| Frontend logic / domain | `mise exec -- npm --prefix frontend run test` | todo | - | - |
| Frontend build | `mise exec -- npm --prefix frontend run build` | todo | - | - |
| Wails production build | `mise run build` | todo | - | - |
| Core E2E | `mise run e2e` / F4-01〜05 and existing F1/F2/F3 | todo | - | - |
| Human UX review | Proposal preview、Direct receipt、Vision preview、error copy | todo | - | - |
| F4 core value Gate | REQ-16 task-based E4: transfer / grounded use / control / friction | todo | - | - |
| F-4 milestone disposition | 再生成ループ等は本受入で将来候補へ残す | todo | - | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence | todo | - | - |
| Worklog coverage | Steps 0〜8 before implementation handoff | todo | - | - |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-13 | Planning session | planned | Full 新規 plan を作成。実装未着手 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
