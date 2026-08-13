# Status

state: done
worklog: enabled

tier: Full
plan: plan_20260813_web_context

## Planning Scope

- Implementation slice: F-3 Collaborative Web Context core slice（F-3A / F-3B Direct Tool / F-3D）
- Core E2E: in scope（`F3-01`〜`F3-05`）
- Worklog: enabled, inherited from the collaborative workspace plan series
- Follow-up candidates: F-3C Specialist subagent、routing、Tavily 第三 strategy、page extract / `web_fetch`
- Milestone boundary: F-3A / F-3B Direct Tool / F-3D core は受入済み。F-3C Specialist subagent と他の acquisition route は本受入で明示的に将来候補へdeferし、別計画で判断する
- External API: Ollama Cloud Search（既定）、Kagi Search v1、Brave Web Search は Conditional Go。Authenticated 200 は Core E2E の合格条件ではない

## Acceptance Table

`WP` は primary implementation owner。Acceptance は実装セッションとは別の session / human が実施する。

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | 明示 query と選択 hint だけを解決し、暗黙本文を送らない | resolver test + F3-01 | E1 | WP-1/3 | implemented | `f3ContextPacket.test.ts` allowlist; F3-01 `lastSearchRequest` は query + 選択 hint のみ、未選択本文なし | pass（2026-08-13 acceptance 再実行） |
| REQ-02 | 選択中 strategy が packet を返し、検索だけでは document を変えない | adapter test + F3-01 | E1 | WP-3 | implemented | `ExecuteWebSearch` + F3-01: packet 表示、`nodeCount`/`relationCount` 不変 | pass |
| REQ-03 | 観測ソースと推論 claim を分離し、source 引用を必須にする | packet invariant + F3-01 | E1 | WP-1 | implemented | `normalizeClaims` が source なし claim を拒否; F3-01 packet に sources + cited claims | pass |
| REQ-04 | packet は一時 Projected Context。自動 Node 化・自動保存しない | persistence / UI + F3-03 | E1 | WP-2/4 | implemented | `ProjectedContextPanel`; F3-03 JSON に `packetId` なし。Save は document のみ | pass |
| REQ-05 | 選択項目だけ atomic Promote。1 回最大 5 件、one undo | reducer + F3-02 | E1 | WP-2 | implemented | `promoteContextItems` + `f3Promote.test.ts` cap/undo; F3-02 one undo | pass |
| REQ-06 | 採用 Node は web provenance（url / domain / retrievedAt / query）を持つ | persistence + F3-02 | E1 | WP-2 | implemented | `f3Promote.test.ts` roundtrip; F3-02 `provenance.origin=web` + url | pass |
| REQ-07 | 机上素材への suggested Relation を採否でき、不正 endpoint を拒否する | relation test + F3-02 | E1 | WP-2/4 | implemented | missing endpoint fail; F3-02 accepted `supports` + undo | pass |
| REQ-08 | 未採用 packet を Active Context / Save から除外する | resolver + F3-03 | E1 | WP-2 | implemented | payload に packet URL なし; F3-03 Save/Load 後も `packetId` なし | pass |
| REQ-09 | packetId / generation / scope の stale Promote を no-op にする | stale test + F3-04 | E1 | WP-3 | implemented | `incomingPacketRejection` が runId/runEpoch/active run を必須検査。Promote は `packetId === packet.packetId`。F3-04 は Stop 遅着・Canvas移動・空query orphanなしを検証 | pass（2026-08-13 repair後再受入） |
| REQ-10 | 既知 https URL を scrape せずソース化し、不正 URL を拒否する | URL test + F3-05 | E1 | WP-1/4 | implemented | `TestExecuteWebSearchKnownURLIsMetadataOnly`; F3-05 known URL + http 拒否 | pass |
| REQ-11 | 同一 URL を畳み、同一 domain を独立意見として加算しない | normalize test + F3-01 | E1 | WP-1 | implemented | `normalizeSources` + `TestExecuteWebSearchFakeBuildsPacketWithoutMutationContract`; F3-01 unique URL=3 | pass |
| REQ-12 | unauthorized / timeout / empty / provider error で document を変えない | error test + F3-05 | E1 | WP-3 | implemented | `TestExecuteWebSearchErrorsDoNotInventSources`; F3-05はunauthorized / timeout / empty / invalid URLのdocument不変を確認 | pass |
| REQ-13 | Dialogue は packet event、Direct Action は Dialogue 非追加の一発検索 | route test + F3-01/04 | E1 | WP-3/4 | implemented | F3-01 Dialogue tool event; F3-04 Direct は session 数不変 | pass |
| REQ-14 | 検索 / Promote / Open URL / undo が理解でき、accessible である | browser + UX review | E1/E4 | WP-4/5 | implemented | E1: panel scroll + sticky Promote、個別checkbox、検索中status、packet間選択resetをF3-01/02b/04で確認。E4: 人間が各種検索導線、結果パネル、選択、Promote、Node作成の一連動作を確認 | pass（2026-08-13 human acceptance） |
| REQ-15 | Core E2E は fake search / fake LLM。実 key / 外部ネットワークなし | harness inspection | E1 | WP-0/5 | implemented | E2E `FixtureWebSearch` + `installNetworkGuard`; `mise run e2e` 23 passed | pass |
| REQ-16 | plan-defined test / vet / build / Core E2E が pass し F1/F2 を壊さない | command output | E1 | WP-5 | implemented | `mise run test` / `go vet` / `mise run build` pass。最終 `mise run e2e` 23 passed（F3-02bを含むF1/F2/F3 regression） | pass（2026-08-13 final acceptance） |
| REQ-17 | 実課題で転記減少・根拠利用・制御・掃除負担を評価し F3 core Gate を判定する | separate task-based review | E4 | WP-5 | implemented | 人間が実アプリで各種検索導線、Projected Contextの閲覧・個別選択、PromoteによるNode作成を一通り確認し、修復後の操作負担を含めF-3受入完了を宣言 | pass / Gate Go（2026-08-13 human acceptance） |
| REQ-18 | ollama / kagi / brave / fake を strategy 切替し、key を保持し、failover しない | config + registry unit test | E1 | WP-3/4 | implemented | 2026-08-13 `.env` 認証付き: Ollama POST Bearer 200、Kagi POST Bearer 200、Kagi GET+Bot 404。adapter は POST+Bearer。unit は GET ではなく POST を固定 | pass（ユーザー実測 E2 + request fixture E1。実測 POST JSON + Bearer を正とする） |
| NFR-01 | 新規 npm / Go module を追加しない | package / go.mod diff | E3 | WP-0/5 | implemented | `go.mod` / `frontend/package.json` 差分なし。HTTP は stdlib | pass |
| NFR-02 | 検索は非 mutation。Promote 失敗で部分更新しない | fault injection | E1 | WP-2/5 | implemented | F3-01 非 mutation; `promote-before-commit` fault で node 数不変 | pass |
| NFR-03 | 外部送信を query と allowlist hint、synthesis を packet + resolver に限定する | payload / DTO test | E1 | WP-3/5 | implemented | F3-01 `lastSearchRequest` に未選択本文なし; `WebSearchRequest` は query/hints/knownUrls | pass |
| NFR-04 | Web Search key を canvas / Dialogue / E2E / docs に書かない | config inspection | E3 | WP-3/5 | implemented | key は `config.webSearch.*.apiKey` のみ。packet / E2E fixture / cheatsheet に secret なし。`.env` は ignore + `jj file untrack` 済み | pass（`.env` はディスクに保持、`jj status` / `jj file list .env` から除外） |
| NFR-05 | backend はユーザー URL を fetch / scrape しない | adapter + negative test | E1/E3 | WP-3/5 | implemented | adapters は ollama/kagi/brave API のみ。known URL は metadata。`web_fetch`/`extract` なし | pass |

## Evidence Class Notes

- E1: automated command and output。
- E2: runtime/manual observation steps and result。
- E3: implementation pointer (file + symbol/line/diff excerpt)。
- E4: acceptance-session or human judgment。
- EX: not directly verifiable。理由、fallback、residual risk、decision condition を記録する。

## Plan Checks

| Check | Required command / observation | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Go tests | `mise exec -- go test -count=1 ./...` or `mise run test` | implemented | 2026-08-13 `ok fm-doc-canvas/backend` | pass（acceptance 再実行） |
| Go vet | `mise exec -- go vet ./...` | implemented | 2026-08-13 exit 0 | pass（acceptance 再実行） |
| Frontend logic / domain | `mise exec -- npm --prefix frontend run test` | implemented | 2026-08-13 sprint-c / domain / acceptance-gaps pass | pass（acceptance 再実行） |
| Frontend build | `mise exec -- npm --prefix frontend run build` | implemented | 2026-08-13 `tsc && vite build` exit 0 | pass（`mise run build` 内） |
| Wails production build | `mise run build` | implemented | 2026-08-13 built `build/bin/fm-doc-canvas.exe` in 13.169s | pass（acceptance: 10.723s） |
| Core E2E | `mise run e2e` / F3-01〜05 and existing F1/F2 | implemented | 2026-08-13 final run 23 passed。F3-02b packet selection resetを含む | pass |
| Human UX review | packet UI、Promote、Open URL、error copy、Direct Action | implemented | 人間が各種検索導線、結果パネル、個別選択、Promote、Node作成を実機確認 | pass |
| F3 core value Gate | REQ-17 task-based E4: transfer / grounded use / control / friction | implemented | 修復を挟んだ実課題操作で一連の価値・制御・負担を確認し、ユーザーがF-3受入完了を宣言 | Go |
| Ollama / Kagi / Brave authenticated call | optional production adapter Go; not an E2E pass condition | implemented | 2026-08-13 Ollama 200 / Kagi POST 200。Brave 未実施。GET+Bot は 404 | pass for required evidence（Ollama/Kagi E2。Brave は計画どおり Conditional） |
| F-3 milestone disposition | F-3C and deferred routes remain open when this core plan closes | implemented | F-3A/B Direct Tool/D coreは受入完了。F-3Cは`specialist_agent_bridge`将来候補へ明示defer | pass（F-3 core完了。F-3Cは別計画） |
| REQ traceability | Claim → REQ → Spec/WP → evidence | implemented | `40_specification.md` trace + 本表 evidence | pass |
| Worklog coverage | Steps 0〜11 | implemented | `91_worklog.md` WL-001〜WL-020（修復、最終human acceptance、documentation feedbackを含む） | pass |

## Acceptance Findings (2026-08-13)

1. **A-01 / REQ-18 / fail — Kagi production adapter contract mismatch**
   - `backend/web_search.go:151` は `POST https://kagi.com/api/v1/search` と JSON body、同 `:155` は `Authorization: Bearer` を使用する。
   - 2026-08-13 時点の Kagi 公式 Search API 例は `GET https://kagi.com/api/v1/search?q=...` と `Authorization: Bot`。現行 adapter は実 API で成功する証拠になっていない。
   - 修復条件: 現行 OpenAPI/公式例へ request/response mapping を合わせ、HTTP fixture test と可能なら認証付き 200 を記録する。cheatsheet の旧判断も訂正する。
2. **A-02 / REQ-09 / fail — Stop と packetId の stale guard が不足**
   - `frontend/src/domain/workspaceCommands.ts:422` は packetId の非空だけを検査し、Promote payload の packet と packetId の同一性を検査しない。
   - `frontend/src/components/drawer/ChatDrawer.tsx:57` の packet event は workspace/canvas/generation/scope のみで受理される。Stop (`:158`〜`:163`) は async run を cancelled にするだけで scope を変えず、packet 側にも runEpoch がないため、Stop 後にキューへ遅着した同 scope の packet を拒否できない。
   - 修復条件: packetId を packet envelope と結び、Dialogue packet は runId/runEpoch と active run status を検証する。Stop 遅着の unit/E2E を追加する。
3. **A-03 / REQ-16 / fail — Core E2E のシナリオ網羅不足**
   - `frontend/e2e/ce2e-f3.spec.ts:84` の F3-04 は Direct Action と New 後 Promote だけで、計画にある Canvas 移動・Stop 後の遅着 packet を検証しない。
   - 同 `:103` の F3-05 は known URL と不正 http URL だけで、計画にある unauthorized / timeout / empty の UI エラーと document 不変を検証しない。
   - 修復条件: fake provider に遅延・unauthorized・timeout・empty fault を用意し、UI の次操作と no mutation を E2E で固定する。
4. **A-04 / REQ-14・17 / hold — E4 未完了**
   - Wails production build と 22 本の Wails/Playwright E2E は成功した。ARIA 名もコード/E2E で確認した。
   - ただし代表的実課題で transfer / grounded use / control / friction を評価する task-based review と、独立した Wails 実画面 UX 観察は未実施。自動テストだけでは Gate を Go にしない。

## Re-acceptance Findings (2026-08-13)

1. **A-01 / REQ-18 / repaired — Kagi adapter**
   - ユーザーが local `.env` の実キーで確認し、POST JSON + Bearer は HTTP 200、GET + Bot は HTTP 404。値は受入セッションで読み出し・記録していない。
   - `backend/web_search_test.go` は POST、`/api/v1/search`、Bearer と `data.search[]` mapping を固定。実測契約を正として pass。
2. **A-02 / REQ-09 / partially repaired — stale guard に残件**
   - packetId binding、active run、runId、runEpoch mismatch、Stop 後遅着、Canvas 移動は実装・unit/E2E とも確認できた。
   - 残件: `incomingPacketRejection` は Dialogue packet の runEpoch 欠落を拒否しない。また `runWebSearch` は async run 開始後、空 query と backend throw の経路で cancel せず active run を残す。
3. **A-03 / REQ-16 / repaired — Core E2E coverage**
   - F3-04 に Stop 後遅着と Canvas 移動、F3-05 に unauthorized / timeout / empty と no mutation / error action を確認。再実行 22 passed。
4. **A-05 / NFR-04 / fail — `.env` が追跡対象**
   - `.gitignore` には `.env` が追加されたが、`jj status` と `jj file list .env` は `A .env` を示す。ignore 前に追跡されたため、実キーを含むファイルがコミット候補に残っている。
   - 修復条件: ファイルを削除せず VCS から untrack し、`jj status` / `jj file list` で対象外を確認する。既に外部へ共有した場合はキーをrotateする。

## Repair Completion (2026-08-13)

- Dialogue packet の `runEpoch` を必須化し、欠落・不一致を `promote-stale` として拒否するunitを追加。
- query validation を `startAsyncRun` より前へ移動。backend例外のcatchでも開始済みrunをcancelする。
- F3-04 に空Dialogue query後のactive run不在とエラーコードを追加。
- `.env` を削除せず `jj file untrack .env`。`.gitignore` の `.env` と、`jj status` / `jj file list .env` で追跡対象外を確認。
- 修復後: `mise run test`、`mise exec -- go vet ./...`、`mise run build` はexit 0。`mise run e2e` は22 passed。

## Human E4 Finding Repair (2026-08-13)

- 結果パネルを`max-height`付き縦スクロール領域にし、Promote操作を下端sticky表示。
- production source IDを乱数化し、LLMが省略・重複したClaim IDも一意に補完。F3-01で1件のcheckが他itemへ波及しないことを確認。
- Promote成功後はpacketを閉じ、生成済みCanvas Nodeへ戻る。既存F3-02でNode作成とone undoを確認。
- 400文字を超えるDirect Action queryは選択Node summaryを優先し、無い場合は400文字へ制限。空のDirect Actionも選択summaryから解決するが、Dialogueの空queryは拒否を維持。
- Claim参照元をsource titleで表示。synthesis失敗時はClaimを捏造せず、SourcesだけPromote可能なpartial状態を説明する。
- 検索開始からpacket表示まで、全体statusとSearch Webボタンにspinnerを表示。
- `list_canvas_nodesweb_search` + 連結JSONは最終tool/JSON objectを境界で復旧し、unitで実検索packetまで確認。
- 修復後検証: `mise run test` exit 0、`mise exec -- go vet ./...` exit 0、`mise run build` exit 0、`mise run e2e` 22 passed（28.0s）。
- 追加修復: packetが閉じてもReact componentはmountedのままなので、`packetId`切替時にclaim/source/relationのローカル選択を同期リセットする。F3-02bでPromote後の2回目検索が`0 / 5 selected`、全checkbox off、Promote disabledから始まることを固定。
- 追加修復後検証: `mise run e2e` 23 passed（29.4s）。F3-02bを含む全F1/F2/F3 regressionがpass。

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-13 | Planning session | planned | Full 新規 plan を作成。実装未着手 |
| 2026-08-13 | Implementation session | implementing | WP-0〜5 実装。plan checks の自動系は green。acceptance 未実施 |
| 2026-08-13 | Codex acceptance session | **Hold / accepting** | 自動コマンドは全 green。A-01 Kagi 契約、A-02 stale guard、A-03 E2E 網羅を fail、REQ-14/17 E4 を hold。修復後に再受入する |
| 2026-08-13 | Codex re-acceptance session | **Hold / accepting** | A-01/A-03 pass。A-02 に runEpoch欠落・orphan async run、A-05 に tracked `.env`。REQ-14/17 E4 も未完了 |
| 2026-08-13 | Codex repair session | technical pass / accepting | A-02/A-05を修復し全自動チェックpass。残りはREQ-14/17の人間によるE4のみ |
| 2026-08-13 | Codex E4 finding repair session | technical pass / accepting | 実機報告8件を修復。unit/vet/build pass、Wails Core E2E 22 passed。REQ-14/17は修正版の人間再確認待ち |
| 2026-08-13 | Codex packet selection repair session | technical pass / accepting | 2回目検索へのUI選択state持越しを修復。F3-02bを含むWails Core E2E 23 passed。人間再確認へ戻す |
| 2026-08-13 | Human final acceptance | **Go / done** | 各種検索導線、検索結果パネル、検索結果の個別選択、Promote、Node作成が一通り動作することを実機確認。REQ-14/17 pass、F-3 core受入完了 |

## Abandoned / No-Go Reason

Use only when `state: abandoned`.
