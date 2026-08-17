# Light Plan: Markdown 外部リンクとチャット履歴の不具合修正

## Purpose

`00_report.md` に記録された次の不具合を修正する。

1. Node Editor の Preview と Artifact Node で Markdown の URL をクリックすると、Wails WebView 自体が遷移してアプリへ戻れなくなる。
2. Chat ペインから送信する agent request に同一 session の過去発言が渡らず、「ここまでの会話」の参照や会話内容を使った Canvas 文書作成ができない。

調査時点では、前者は `EditorDrawer.tsx` と `ArtifactNode.tsx` が `ReactMarkdown` の標準 anchor をそのまま描画していること、後者は Frontend の `ChatRequest.history` が Go の `ChatRequest` DTO に存在せず、`runAgent` の初期 message 列も system と現在 user request だけで構築されていることが直接原因である。

## Scope / Out of Scope

### Scope

- Markdown 内の `http://` / `https://` リンクを OS 標準ブラウザで開き、Wails WebView の現在 URL と Canvas 状態を維持する。
- Node Editor Preview と Artifact Node の Markdown 表示で同じリンク処理を使う。
- Chat の同一 session にある直近の完了済み user / assistant 発言を、時系列と role を保って agent request に渡す。
- 現在の user message を履歴と current request に二重投入しない。
- 履歴の既存上限 12 件と、cancelled / error / streaming / 空発言を除外する規則を維持する。
- ユーザーが明示した場合、会話内容をまとめた新規 Text Node を Chat agent から作成できるようにする。
- Go / Frontend のロジックテスト、Wails build、Playwright Core E2E を追加・実行する。

### Out of Scope

- Markdown 以外の URL 表示、アプリ内ブラウザ、リンク履歴・戻る機能の追加。
- `file:`, `javascript:`, 相対 URL、独自 scheme を外部アプリへ渡すこと。
- 12 件を超える長期会話メモリ、要約メモリ、token 数ベースの圧縮。
- session persistence 形式や Canvas context 選択規則の変更。
- 会話からの暗黙的な Node 作成、既存 Text / Artifact の編集契約変更。
- 新規外部 dependency の追加。

## Implementation Approach

### WP-1: Markdown 外部リンク

- `frontend/src/components/markdown/MarkdownContent.tsx` を追加し、`ReactMarkdown` + `remark-gfm` と anchor renderer を共通化する。
- anchor click では `preventDefault()` と必要な event propagation 抑止を行い、`http:` / `https:` の絶対 URL だけを `frontend/wailsjs/runtime` の `BrowserOpenURL` へ渡す。未許可 scheme は WebView へ遷移させず、外部起動もしない。
- `frontend/src/components/drawer/EditorDrawer.tsx` と `frontend/src/components/canvas/ArtifactNode.tsx` は共通 Markdown component を利用する。既存の preview truncation、GFM、prose style、node selection/edit 動作は維持する。
- Frontend test では URL 判定と click contract、Core E2E では両表示面から同じ URL が runtime hook に渡ること、クリック前後で `page.url()` と Canvas snapshot が変化しないことを確認する。E2E 中は OS ブラウザを実起動せず `window.runtime.BrowserOpenURL` を spy 化する。

### WP-2: Chat session 履歴

- `frontend/src/components/drawer/ChatDrawer.tsx` は現在 user message を append する前の session messages を履歴元として確保し、`buildChatRequest` へ渡す。これにより current prompt は `prompt` として一度だけ送る。
- `frontend/src/utils/chatContext.ts` の `boundedDialogueHistory(..., 12)` を履歴の唯一の Frontend 境界として維持し、role / content だけの transport DTO に変換する。
- `backend/canvas_snapshot.go` に履歴用 DTO と `ChatRequest.History` を追加する。Backend でも role が `user` / `assistant`、content が非空、最大 12 件であることを検証・正規化し、不正な request が provider message や tool role を注入できないようにする。
- `backend/agent_loop.go` は provider へ渡す初期列を `system → 過去の user/assistant 発言 → 現在の user request` の順で構成する。Canvas direct context と vision payload は現在 user request にだけ付与し、過去発言の本文や role を書き換えない。
- Wails 生成 binding/model は Go DTO 変更に追従させる。
- Backend test で順序、role、上限、不正履歴、current prompt 非重複を検証する。Frontend test で送信直前の current message が history に混ざらないことを検証する。Core E2E では同一 session の第2 turn が第1 turnの固有情報を参照できることを fixture LLM の観測値と UI で確認する。

### WP-3: 会話からの Text Node 作成

- 現行 `write_artifact` は新規 Artifact 専用であり、報告例の Text Node 作成には使えない。`backend/agent_loop.go` に明示的な新規 Text Node 作成 tool を追加し、既存の `create-text` proposal / acknowledgment / Undo 対応経路へ接続する。
- tool は `content` と `summary` を受け取り、現在 request が Text Node 作成を明示している場合だけ proposal を生成する。既存 node の上書きや暗黙作成には使わない。
- Backend の `ToolApplyProposal` と Frontend の chat/proposal transport に `text` / `artifact` の作成 role を保持し、role 未指定の既存 `write_artifact` event は後方互換として Artifact 扱いを維持する。
- `frontend/src/domain/proposal.ts` と適用処理は既存の `create-text` command を `role: "text"` で実行し、作成先 Canvas、run freshness、単一 Undo、acknowledgment の既存保証を維持する。
- tool contract / 明示作成 guard / role mapping の Go・Frontend test を追加し、Core E2E で「ここまでの会話をまとめて Text Node として Canvas に貼る」により実際の Text Node が1件作られ、内容に過去 turn の固有情報が含まれることを確認する。

### WP-4: 回帰確認とドキュメント反映

- `frontend/e2e/ce2e-bugfix.spec.ts`（名称は実装時に既存配置へ合わせて調整可）に本計画固有の回帰ケースを追加する。
- `mise run test`、`mise run build`、`mise run e2e` を実行する。
- 受理後、確定したリンク処理と Chat 履歴境界を `docs/requirement.md` / `docs/specification.md` に反映し、`docs/plan_index.md` と `90_status.md` を `done` に更新する。

### WP-5: 新規 Node 作成 guard のエラー案内

- 既存の Text / Artifact 作成許可表現は維持し、未知の表記を許可語へ際限なく追加しない。
- `create_text_node` / node_id なし `write_artifact` が明示作成 guard に拒否された場合、role 別の再送用定型文と「現在のメッセージに明記する」必要性をエラーへ含める。
- Text の案内は `新しい Text Node を作成してください`、Artifact は `新しい Artifact Node を作成してください` を正本とする。変更が未適用であることも明記する。
- ToolCard の既存 error surface で案内全文が確認でき、通常の provider/tool error や既存node編集errorの意味を変更しない。
- Go test と Playwright で両 role の guard error、定型文、未適用状態を確認する。

## Acceptance Conditions

詳細な進捗と証拠は `90_status.md` を正本とする。

| REQ ID | Requirement summary | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | Editor Preview と Artifact Node の HTTP(S) リンクは OS 標準ブラウザへ渡され、WebView と Canvas はその場に残る | Frontend test + 両表示面の Playwright runtime spy / URL・snapshot 比較 | E1/E2 |
| REQ-02 | 未許可 scheme は WebView 遷移も外部起動もせず、既存 Markdown 表示・node 操作を壊さない | Frontend test + Playwright negative case | E1/E2 |
| REQ-03 | 同一 Chat session の直近完了履歴が role と順序を保って provider へ渡り、現在 prompt は重複しない | Go / Frontend test + fixture observation E2E | E1/E2 |
| REQ-04 | 同一 session の過去の会話を参照した応答が成功する | 2 turn Playwright scenario + fixture observation | E1/E2 |
| REQ-05 | 明示指示により会話内容を含む新規 Text Node が現在 Canvas に作成され、Undo できる | Tool contract test + Playwright Canvas snapshot / Undo | E1/E2 |
| REQ-06 | 全既存ロジックテスト、Wails build、Core E2E が成功する | `mise run test`, `mise run build`, `mise run e2e` | E1 |
| REQ-07 | 新規Node作成guardの拒否時、role別の再送定型文・current message要件・未適用状態を案内する | Go error contract test + Playwright ToolCard表示 | E1/E2 |

## Risks / Constraints

- E2E で `BrowserOpenURL` を実呼び出しすると OS 側へ副作用が出るため、runtime spy で引数だけを観測する。実機受理時のみ OS 標準ブラウザ起動を手動確認する。
- `history` の末尾に現在 user message を含めたまま Backend へ渡すと prompt が二重化する。履歴 snapshot の取得タイミングと Backend test の message 列完全一致を completion condition とする。
- Frontend の 12 件制限だけに依存せず Backend でも上限と role を防御し、Wails API の直接呼び出しでも provider request を汚染させない。
- `BrowserOpenURL` に任意 scheme を渡さない。対象は明示的に `http:` / `https:` の絶対 URL に限定する。
- 新規 Text Node 作成は既存 `write_artifact` の意味を変更せず別 tool とし、作成 role を transport 上で明示する。既存 event の role 欠落は Artifact として後方互換に処理する。

## Notes / Review / Amend History

- 採用: 2つの `ReactMarkdown` 利用箇所に個別 handler を複製せず、共通 Markdown component に集約する。
- 採用: 履歴は整形済み transcript 文字列ではなく role 付き provider messages として渡す。会話構造を保ち、system/current request と混同しないため。
- 採用: 会話由来 Text Node は既存 transform の source revision を捏造せず、明示作成専用 tool から既存 `create-text` domain command へ接続する。
- 却下: WebView 内で `target="_blank"` だけを指定する案。Wails WebView で OS 標準ブラウザ起動を保証せず、期待値を満たさないため。
- 却下: Chat session JSON を Backend が再ロードして履歴を組み立てる案。Frontend が active session と未保存の最新 message の正本であり、保存タイミング競合を増やすため。
- E2E: enabled。
- worklog: disabled。`91_worklog.md` は作成しない。
- 2026-08-17: `00_report.md` を起点に Tier Lite として作成。
- 2026-08-17: 人間判断により、既存許可表現を維持したまま guard error の再送案内を WP-5 / REQ-07 として追加。
