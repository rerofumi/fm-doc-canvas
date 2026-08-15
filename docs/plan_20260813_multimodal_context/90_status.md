# Status

state: done
worklog: enabled

tier: Full
plan: plan_20260813_multimodal_context

## Planning Scope

- Implementation slice: F-4 Multimodal Transform core slice（F-4A + Vision Context / intent-vs-result）
- Core E2E: in scope（`F4-01`〜`F4-05`）
- Worklog: enabled, inherited from the collaborative workspace plan series
- Follow-up candidates: 確認付き再生成、AL-3、`fm-image-assistant`
- Milestone boundary: この plan は F4 core のみ閉じられる。ロードマップ F-4 は後続候補の disposition まで open
- External API: 既存 Image Provider / LLM Vision。新規 API なし。実画質は Conditional であり Core E2E の合格条件ではない

## Acceptance Table

`WP` は primary implementation owner。Acceptance は実装セッションとは別の session / human が実施する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | 明示 prompt と選択 context / 参照画像だけを解決する | resolver test + F4-01/02 | E1 | WP-1 | implemented | `contextResolver.ts`, `f4VisionContext.test.ts`, `ce2e-f4.spec.ts` F4-01/02 | - |
| REQ-02 | `generate_image` は選択 ImagePort を一度呼び、document を変えない | tool test + F4-01 | E1 | WP-3 | implemented | `agent_loop.go`, `f4_image_tool_test.go` (`TestGenerateImageToolIsProposalNotMutation`), `ce2e-f4.spec.ts` F4-01 | - |
| REQ-03 | PromptBar Direct Action は Dialogue 非追加で同じ Variant 契約 | route test + F4-02 | E1 | WP-4 | implemented | `PromptBar.tsx`, `useAppStore.ts` `applyDirectImageVariant`, `ce2e-f4.spec.ts` F4-02 | - |
| REQ-04 | Dialogue 結果は Proposal。accept 前に Node 化しない | proposal test + F4-01 | E1 | WP-2 | implemented | `agent_types.go`, `useAppStore.ts` `createToolProposalDecider`, `ToolCard.tsx`, `ce2e-f4.spec.ts` F4-01 | - |
| REQ-05 | Image Variant は atomic Node + derived + one undo | reducer + F4-01/02 | E1 | WP-2 | implemented | `workspaceCommands.ts` (`applyImageVariant`), `f4ImageVariant.test.ts`, `ce2e-f4.spec.ts` F4-01/02 | - |
| REQ-06 | provenance `origin=image` を Save/Load する | persistence + F4-01 | E1 | WP-2 | implemented | `workspace.ts`, `workspaceCommands.ts`, `workspacePersistence.ts`, `f4ImageVariant.test.ts`, `ce2e-f4.spec.ts` F4-01 | - |
| REQ-07 | Dialogue Vision は明示 Image 最大 3 枚の `image-binary` | resolver + F4-03 | E1 | WP-1 | implemented | `contextResolver.ts` (`VISION_CAP=3`), `f4VisionContext.test.ts`, `ce2e-f4.spec.ts` F4-03 | - |
| REQ-08 | Agent は allowlist pixel を送り、外は metadata only | payload test + F4-03 | E1 | WP-3 | implemented | `chatContext.ts`, `agent_loop.go` (`runAgent` / `read_canvas_node`), `f4_image_tool_test.go`, `ce2e-f4.spec.ts` F4-03 | - |
| REQ-09 | 意図と結果の差分を AL-0/1 で説明し、自動再生成しない | fixture + F4-03 / E4 | E1/E4 | WP-3/5 | implemented | `system_prompt.go` rule 15, `ce2e-f4.spec.ts` F4-03 | - |
| REQ-10 | 未採用 Proposal を Save / 次 Context から除外する | persistence + F4-01 | E1 | WP-1/2 | implemented | `workspacePersistence.ts`, `contextResolver.ts`, `ce2e-f4.spec.ts` F4-01 | - |
| REQ-11 | stale / Stop / navigation 後の遅着配置を no-op にする | stale test + F4-04 | E1 | WP-3 | implemented | `workspaceCommands.ts`, `useAppStore.ts`, `ce2e-f4.spec.ts` F4-04 | - |
| REQ-12 | unauthorized / timeout / empty で document 不変 | error test + F4-05 | E1 | WP-3 | implemented | `agent_loop.go`, `f4_image_tool_test.go`, `ce2e-f4.spec.ts` F4-05 | - |
| REQ-13 | 主要操作が accessible で、PromptBar Image が退行しない | browser + UX review | E1/E4 | WP-4/5 | implemented | `PromptBar.tsx`, `App.tsx` (`direct-action-receipt`), `ce2e-f4.spec.ts` F4-02/05 | - |
| REQ-14 | Core E2E は fake image / fake LLM。実 key / 外部ネットワークなし | harness inspection | E1 | WP-0/5 | implemented | `app.go` (`NewE2EAppFromEnv`), `helpers.ts` (`installNetworkGuard`), `ports.go` (`FixtureImage`, `FixtureLLM`) | - |
| REQ-15 | plan-defined test / vet / build / Core E2E が pass し F1〜F3 を壊さない | command output | E1 | WP-5 | implemented | Go / Frontend / vet / Wails build pass、Core E2E 28/28 pass（F1〜F4） | - |
| REQ-16 | 実課題で再入力減少・差分共有・Direct 非劣化・負担を評価し F4 core Gate を判定する | separate task-based review | E4 | WP-5 | implemented | Dialogue / Direct の生成指示、コンテキスト画像指定、参照画像を使った編集、image_gen 周辺を実課題で確認し、期待通りの動作を確認 | Go |
| NFR-01 | 新規 npm / Go module を追加しない | package / go.mod diff | E3 | WP-0/5 | implemented | `git status` / `git diff` shows no changes to `package.json` dependencies or `go.mod` | - |
| NFR-02 | tool は非 mutation。配置失敗で部分更新しない | fault injection | E1 | WP-2/5 | implemented | `workspaceCommands.ts` atomic failure, `f4ImageVariant.test.ts` | - |
| NFR-03 | 外部送信を allowlist に限定し、data URL を persist しない | payload / JSON inspection | E1/E3 | WP-3/5 | implemented | `contextResolver.ts`, `workspacePersistence.ts`, `chatContext.ts` | - |
| NFR-04 | Image / LLM key を canvas / Dialogue / E2E / docs に書かない | config inspection | E3 | WP-3/5 | implemented | Keys remain in `config.json` only | - |
| NFR-05 | undo / reject は物理ファイルを消さない | file inspection | E2/E3 | WP-2/5 | implemented | `workspaceCommands.ts` undo removes Node/Relation only, physical files persist in download dir | - |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | done | `mise x -- go test -count=1 ./...` pass（root + backend） | - |
| Go vet | `mise exec -- go vet ./...` | done | `mise x -- go vet ./...` exit 0 (clean) | - |
| Frontend logic / domain | `mise exec -- npm --prefix frontend run test` | done | `mise x -- npm --prefix frontend test` passed (all 20+ tests ok) | - |
| Frontend build | `mise exec -- npm --prefix frontend run build` | done | `mise x -- npm --prefix frontend run build` exit 0 (tsc & vite build clean) | - |
| Wails production build | `mise run build` | done | Wails 2.12.0 / Go 1.24.4 windows-arm64 build exit 0 | - |
| Core E2E | `mise run e2e` / F4-01〜05 and existing F1/F2/F3 | done | Playwright Core E2E 28/28 pass。F4-01〜05 は実 Dialogue / Vision / Stop / provider error 経路を検証 | - |
| Human UX review | Proposal preview、Direct receipt、Vision preview、error copy | done | ToolCard preview, PromptBar receipt with Undo, ContextPreview vision badge | - |
| F4 core value Gate | REQ-16 task-based E4: transfer / grounded use / control / friction | done | 修正版を実課題で再確認し、ユーザーが REQ-16 確認完了と OK state を宣言 | Go |
| F-4 milestone disposition | 再生成ループ等は本受入で将来候補へ残す | done | Documented in planning scope | - |
| REQ traceability | Claim → REQ → Spec/WP → evidence | done | Traceability verified across 10-60 docs and code | - |
| Worklog coverage | Steps 0〜9 before implementation handoff | done | WL-001〜WL-009 documented in `91_worklog.md` | - |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-13 | Planning session | planned | Full 新規 plan を作成。実装未着手 |
| 2026-08-14 | Implementation session | implemented | F4ブロッカー4件の修正完了（Vision実送信接続、PromptBar Direct Image Variant契約接続、E2E実効性強化、90_status/91_worklog更新） |
| 2026-08-14 | Repair verification session | implemented | 遅延イベント順序、Stop後の画像遅着、provider error、E2E fixture配線、Go/Wails version不整合を修正。Core E2E 28/28 pass |
| 2026-08-15 | REQ-16 feedback repair | Hold / repaired | Proposal 実画像 preview、Dialogue provider 選択、参照画像の data URL 解決を実装。自動検証 28/28 pass、human 再受入待ち |
| 2026-08-15 | REQ-16 human acceptance | Go | Dialogue / Direct 生成、コンテキスト画像指定、参照編集、image_gen 周辺を一通り確認。期待通りに動作し、ユーザーが確認完了・OK state を宣言 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
