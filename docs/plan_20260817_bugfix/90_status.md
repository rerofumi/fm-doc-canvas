# Status

state: done
worklog: disabled

tier: Light
plan: plan_20260817_bugfix
core_e2e: enabled

## Acceptance Table

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | Editor Preview / Artifact Node の HTTP(S) リンクを OS 標準ブラウザへ渡し、WebView と Canvas を維持する | Frontend test + Playwright runtime spy / URL・snapshot 比較 | E1/E2 | WP-1 | implemented | `frontend/src/components/markdown/MarkdownContent.tsx` の共通 `ReactMarkdown` renderer が `BrowserOpenURL` を利用。`EditorDrawer.tsx` と `ArtifactNode.tsx` が共通 component を使用。`mise x -- npm --prefix frontend run test` (pass)、`mise x -- npm --prefix frontend run build` (pass)。`FM_E2E_TEST_ARGS=ce2e-wp1-markdown-links.spec.ts mise x -- npm --prefix frontend run test:e2e` (pass): Artifact と Editor Preview の各 HTTP(S) クリックで runtime spy、page.url() 前後同値、Canvas snapshot 前後同値を確認。 | Pass (human verified 2026-08-17) |
| REQ-02 | 未許可 scheme を拒否し、既存 Markdown 表示・node 操作を維持する | Frontend test + Playwright negative case | E1/E2 | WP-1 | implemented | `frontend/src/components/markdown/markdownLinks.ts` が絶対 `http:` / `https:` のみ許可し、全クリックで `preventDefault` / `stopPropagation`。`markdownLinks.test.ts` で許可 URL・相対/未許可 scheme・click 契約を検証。`mise x -- npm --prefix frontend run test:markdown` (pass)、Frontend build (pass)。同 E2E の `javascript:` negative case (pass) で外部起動・URL遷移なしを確認。 | Pass |
| REQ-03 | 同一 session の直近完了履歴を role / 時系列どおり provider に渡し、current prompt を重複させない | Go / Frontend test + fixture observation E2E | E1/E2 | WP-2 | implemented | `ChatDrawer.tsx` が append 前の履歴 snapshot を `buildChatRequest` に渡す。`ChatRequest.History` / `ChatHistoryMessage` を Backend で user/assistant・非空・最大12件に検証し、provider 列を system→history→current user に構成。`chat_agent_test.go`、`sprintC.test.ts` 追加。`mise x -- go test -count=1 ./backend`、`mise x -- npm --prefix frontend run test`、`mise run build` pass。`FM_E2E_TEST_ARGS=ce2e-wp23-chat-history-text.spec.ts mise x -- npm --prefix frontend run test:e2e` pass（provider roles / contents と current prompt 非重複を確認）。 | Pass |
| REQ-04 | 同一 session の過去の会話を参照した応答が成功する | 2 turn Playwright scenario + fixture observation | E1/E2 | WP-2 | implemented | Fixture `FixtureAgentRequest.contents` と `history-first` / `history-second` 専用の自然言語応答分岐を追加。`FM_E2E_TEST_ARGS=ce2e-wp23-chat-history-text.spec.ts mise x -- npm --prefix frontend run test:e2e` pass（2 turn provider roles / first-turn 固有情報と assistant UI 応答 `I remember FIRST-TURN-UNIQUE from the earlier turn.` を確認）。Go/Frontend logic tests と Wails build pass。 | Pass |
| REQ-05 | 明示指示により会話内容を含む新規 Text Node が現在 Canvas に作成され、Undo できる | Tool contract test + Playwright Canvas snapshot / Undo | E1/E2 | WP-3 | implemented | `backend/agent_loop.go` の共通 `creationIntent` が新規 Text/Artifact の「書き込む・保存・反映」表現を認可し、既存 node の書き込み・追記と否定表現を拒否。`backend/chat_agent_test.go` に正確な Artifact/Text positive と既存/否定 negative、fixture current prompt 完全一致を追加。Backend/Frontend test、Wails buildがpass。専用E2E 3/3 passで、正確なArtifact promptのtool call→proposal→Accept→role=artifact→Undo、provider current prompt完全一致を確認。 | Pass (human verified 2026-08-17) |
| REQ-06 | 既存ロジックテスト、Wails build、Core E2E がすべて成功する | `mise run test`, `mise run build`, `mise run e2e` | E1 | WP-4 | implemented | `mise run test` pass（Go 2 packages、Frontend logic suites）。`mise run build` pass（Wails v2.12.0、bindings生成、Windows executable生成）。`mise run e2e` pass（73/73 tests、正確なArtifact書き込みとguard案内を含む）。 | Pass |
| REQ-07 | guard拒否時にrole別の再送定型文・current message要件・未適用状態を案内する | Go error contract test + Playwright ToolCard表示 | E1/E2 | WP-5 | implemented | `backend/agent_loop.go` の `creationGuardError` が Text / Artifact の正本定型文、現在メッセージへの明記・再送、未適用状態を guard 拒否時だけ付加。Go contract test、Frontend logic、Wails buildがpass。専用E2E 2/2とCore E2E 73/73で両roleのToolCard全文、Canvas不変、既存node編集errorへの案内非混入を確認。 | Pass |

## Required Verification Evidence

| Check | Command / steps | Expected |
| --- | --- | --- |
| Logic / unit | `mise run test` | Go と Frontend の全テストが exit 0 |
| Build | `mise run build` | Wails build が exit 0、生成 binding が Go DTO と一致 |
| Core E2E | `mise run e2e` | 既存ケースと本計画のリンク / 2 turn Chat ケースが全件 pass |
| Manual external-open | Wails 実機で Preview / Artifact の HTTPS link を各1回クリック | OS 標準ブラウザが開き、アプリの WebView / Canvas が維持される |

## Evidence Class Notes

- E1: automated command and output.
- E2: runtime/manual observation steps and result.
- E3: implementation pointer (file + symbol/line/diff excerpt).
- E4: acceptance-session or human judgment.
- EX: not directly verifiable; include reason, fallback verification, residual risk, and decision condition.

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-17 | leader | implementation started | 承認済み Tier Lite plan に対し、WP-1 と WP-2/3 を分離した worker 実装を開始。 |
| 2026-08-17 | acceptance sub-agent | automatic acceptance pass | 4 roundsでREQ-01〜06を受入。`mise run test` / `mise run build` / Core E2E 69/69 pass。REQ-01のOS実機確認のみ人間確認待ち。 |
| 2026-08-17 | human runtime | partial pass / REQ-05 fail | URL外部起動は期待どおり。ChatからのText/Artifact新規作成は双方ともexplicit request guard errorで失敗。 |
| 2026-08-17 | acceptance sub-agent | REQ-05 runtime fix automatic pass | creation intent修正を受入。`mise run test` / `mise run build` / Core E2E 70/70 pass。人間実機再確認待ち。 |
| 2026-08-17 | human runtime | REQ-05 fail round 2 | `Artifact Node として canvas に書き込んでください` が explicit request guard error。正確なpromptを回帰ケースとして追加する。 |
| 2026-08-17 | acceptance sub-agent | REQ-05 round 2 fix automatic pass | 正確な人間promptを含むCore E2E 71/71 pass。否定・既存node編集の拒否も確認。人間実機再確認待ち。 |
| 2026-08-17 | human amend | REQ-07 added | 既存の作成許可表現を維持し、guard拒否時のrole別再送案内を本planへ追加。 |
| 2026-08-17 | acceptance sub-agent | REQ-07 pass | role別案内とerror限定を受入。`mise run test` / `mise run build` / Core E2E 73/73 pass。 |
| 2026-08-17 | human | final acceptance | URL外部起動、Chatからの新規Node作成、guard案内を実機確認して承認。全REQを受理しplanをdoneとする。 |

## State Rule

`state: done` は全 REQ が別セッションまたは人間による受理で Pass した場合のみ設定する。

## Abandoned / No-Go Reason

`state: abandoned` の場合のみ記載する。
