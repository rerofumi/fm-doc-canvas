# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and plan start

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F2 完了後の F-3 を新規 Full plan として開始する。
- Sources and checks: user request（Full 新規 plan）、`05_roadmap.md` F-3 / D-07 / D-10 / D-11、`plan_index.md`、F2 `90_status.md`。
- Actions: 既存 plan の amend ではなく `plan_20260813_web_context` を新規作成。Core E2E と worklog は F1/F2 系列を継承。
- Decision: Full。外部 API と Context 契約・Agent・UI・E2E に広い影響がある。suffix はロードマップ候補名 `web_context`。
- Alternatives rejected or deferred: 親 plan amend はユーザーが新規 Full を指定したため不採用。Light は不足。
- Artifacts updated: plan directory start、`90_status.md`。
- Open questions / risks: E2E / worklog の明示回答は無かったが、同一系列の継承として記録。
- Handoff: Claim と調査範囲を定義する。

## WL-002 — Step 1: Claim

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F3 の価値仮説と core / 非対象を分ける。
- Sources and checks: F-3A/B/C/D、Gate F-3、`08_glossary.md`、F2 acceptance boundary。
- Actions: core を Context Packet + Direct Tool Web 取得 + 明示 Promote と定義。F-3C は対象外。
- Decision: 検索は共同材料の入口であり、回答アプリ化しない。plan `done` は core のみ。
- Deferred: Specialist subagent、routing、MCP。
- Artifacts updated: `10_claim.md`。
- Handoff: MVP UX を定義する。

## WL-003 — Step 2: App Requirements

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: ユーザーが価値を確認できる最小体験を定義する。
- Sources and checks: CW-3A、consultant §8、F2 entry separation。
- Actions: packet UI、Promote cap、Direct Action 一発検索、known URL 非 fetch を MVP にした。
- Decision: 未採用項目は机上の確定材料にしない。
- Artifacts updated: `20_app_requirement.md`。
- Handoff: REQ と verification を割り当てる。

## WL-004 — Step 3/4: Domain primer and pre-implementation research

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 既存土台と検索 API 候補を検証し、未確認を adopted にしない。
- Sources and checks: `domain_primer.md`、`workspace.ts` Provenance、`agent_loop.go` tools、`config.go`、`app.go` E2E composition、Brave / Tavily / xAI 公式 docs、未認証 HTTP probe。
- Actions: cheatsheet `web_context_providers.md` を作成。Brave 422（token 必須）、Tavily 401 を確認。xAI `web_search` は Responses / 回答一体のため第一経路から除外。
- Decision: `WebSearchPort` + fake は Go。Brave 本番 adapter は Conditional Go。新規 npm / Go module は不要。
- Alternatives rejected or deferred: LLM 内蔵検索を第一経路にする案、Tavily を第一にする案、ページ scrape。
- Artifacts updated: `docs/cheatsheet/web_context_providers.md`、`index.md`、`link.md`。
- Residual risk: 認証付き 200 と日本語品質は未確認。
- Handoff: REQ / Spec に Conditional を明記する。

## WL-005 — Step 5: Requirements

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F3 Gate を検証可能な REQ に分解する。
- Actions: REQ-01〜17、NFR-01〜05、F3-01〜05、completion commands を定義。
- Decision: 検索非 mutation、Promote atomic、allowlist、stale、SSRF 禁止、E4 Gate を必須にした。
- Artifacts updated: `30_requirement.md`、`90_status.md`。
- Handoff: 実装構造と WP を確定する。

## WL-006 — Step 6: Specification

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 実装者が迷わない契約と順序を書く。
- Actions: packet / request / provenance / config、Promote transaction、Agent tool、UI、WP-0〜5、E2E シナリオを記載。
- Decision: V1.3 optional provenance。`cites` kind は作らない。caps は source 8 / promote 5 / timeout 15s。
- Risks: Brave 200 待ちで WP-3 production path だけ止まる。domain/UI/E2E は止めない。
- Artifacts updated: `40_specification.md`。
- Handoff: review notes / packet で棄却と Open Questions を残す。

## WL-007 — Step 7: Review Notes and Status

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 採用・棄却・保留を plan 内に残し、受入表を初期化する。
- Actions: R-01〜07、Fixed Decisions、status 全 REQ/NFR 行を todo で作成。
- Decision: 未採用 packet は document / Save / Active Context に漏らさない。
- Artifacts updated: `50_review_notes.md`、`90_status.md`。
- Handoff: reviewer packet を書く。

## WL-008 — Step 8: Reviewer material and index

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 判断点と traceability を短くレビュー可能にし、index を同期する。
- Actions: `60_review_packet.md` を作成。`docs/plan_index.md` に planned 行を追加。roadmap F-3 に個別計画ポインタを追加。
- Decision: split review は不要。default packet のみ。
- Artifacts updated: `60_review_packet.md`、`docs/plan_index.md`、`05_roadmap.md`。
- Handoff: 実装セッションは requirements / specification / cheatsheet を読み、`90_status.md` の implementer evidence のみ更新する。

## WL-009 — Amend: Ollama Cloud Search + provider strategy

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: ユーザー保有の Ollama Cloud Search を採用し、検索 provider を strategy 切替にする。
- Sources and checks: https://docs.ollama.com/capabilities/web-search、未認証 `POST https://ollama.com/api/web_search` → HTTP 401 `{"error":"Unauthorized"}`、`OLLAMA_API_KEY` unset in planning shell、imageGen の per-provider config。
- Actions: cheatsheet に Ollama を追加。REQ-18 を新設。REQ-02 は「選択中 strategy を一度呼ぶ」に限定して維持。Settings 切替・key 保持・no failover・`web_fetch` 除外を spec / review / status に反映。
- Decision: 既定 `ollama`、切替 `brave`、E2E `fake`。Ollama / Brave は Conditional Go。自動 failover と検索ごとの picker は棄却。
- Alternatives rejected or deferred: Tavily 第三 strategy、Ollama `web_fetch`、失敗時の暗黙切替。
- Artifacts updated: `10_claim.md`、`20_app_requirement.md`、`30_requirement.md`、`40_specification.md`、`50_review_notes.md`、`60_review_packet.md`、`90_status.md`、cheatsheet、`docs/plan_index.md`。
- Residual risk: 認証付き 200 は未実施。実装時にユーザー key で確認する。
- Handoff: 実装は registry + fake から始め、Ollama adapter を最初の本番 path とする。

## WL-010 — Amend: Kagi Search API v1 strategy

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: ユーザー保有の Kagi Search API を切替可能な strategy に加える。
- Sources and checks: https://kagi.com/api/docs/openapi/search/search、https://kagi.com/api/docs（server `https://kagi.com/api/v1`, bearer）。live `POST /api/v1/search` + invalid Bearer → HTTP 400 `general.invalid_token`。legacy `GET /api/v0/search` は別 envelope。`KAGI_API_KEY` unset。
- Actions: cheatsheet に Kagi v1 を追加。REQ-18 の必須 ID に `kagi` を追加。config / Settings / mapping / `extract` 禁止を spec / review / status に反映。
- Decision: `kagi` は品質候補の本番 strategy。既定は `ollama` のまま。`workflow=search` のみ。`extract` と v0 API は使わない。公式 generated SDK は追加しない。
- Alternatives rejected or deferred: Kagi を既定にする、`extract` で snippet を置換する、v0 `Bot` token API を併用する。
- Artifacts updated: cheatsheet、`10_claim.md`〜`60_review_packet.md`、`90_status.md`、`docs/plan_index.md`。
- Residual risk: 認証付き 200 と課金単位は未実施。実装時にユーザー key で確認する。
- Handoff: WP-3 の Kagi adapter は v1 JSON の `data.search[]` だけを正規化する。

## WL-011 — Step 9: Implementation start

- Date/time: 2026-08-13
- Actor/session: Grok implementation session
- Purpose: 承認済み F3 core slice を WP-0〜5 の順で実装する。
- Inputs: `30_requirement.md`, `40_specification.md`, `90_status.md`, `docs/cheatsheet/web_context_providers.md`。
- Actions: `state` を `implementing` に更新。WP-0 から fake port / packet contract を先行する。
- Decision: 実装セッションは implementer state / evidence のみ更新し、acceptance は書かない。
- Handoff: WP-0 harness と WP-1 packet contract。

## WL-012 — Step 9: Implementation complete (awaiting acceptance)

- Date/time: 2026-08-13
- Actor/session: Grok implementation session
- Purpose: F3 core slice を実装し、implementer evidence を残す。
- Checks: `mise exec -- go test -count=1 ./...` ok; `go vet` ok; frontend test/build ok; `mise run build` ok; `mise run e2e` 22 passed（F3-01〜05 + F1/F2）。
- Actions: packet / Promote / WebSearchPort / Ollama・Kagi・Brave adapter / Settings / Projected Context Panel / Core E2E を追加。acceptance 列は未記入。
- Decision: 本番 adapter の認証付き 200 は Conditional のまま。REQ-17 Gate は別 session。
- Artifacts updated: domain / backend / UI / `ce2e-f3.spec.ts` / `90_status.md`。
- Residual risk: 実 key での Ollama / Kagi / Brave 200 と日本語品質は未確認。
- Handoff: 別 session が `90_status.md` の acceptance を実施する。

## WL-013 — Step 10: Acceptance Hold

- Date/time: 2026-08-13
- Actor/session: Codex acceptance session
- Purpose: `90_status.md` の E1/E3 を再実行・再点検し、E4 と F3 core Gate を独立判定する。
- Checks: `mise run test` exit 0、`mise exec -- go vet ./...` exit 0、`mise run build` exit 0（10.723s）、`mise run e2e` 22 passed。実装差分、packet/Promote stale guard、provider request mapping、F3-01〜05 本文を点検。Ollama/Kagi/Brave の現行公式 docs を再照合。
- Result: **Hold**。REQ-09、REQ-16、REQ-18 は fail。REQ-14、REQ-17 は E4 未完了で hold。他の REQ/NFR は pass。
- Findings: Kagi v1 adapter が現行公式 GET + query + `Authorization: Bot` と不一致。Stop 後 packet の run status/runEpoch guard と packetId binding がない。F3-04/F3-05 が plan-defined stale/error cases を網羅しない。
- Browser observation: Wails binding のない Vite 単体ページは runtime API 不在で描画不能だったため、独立 UI E4 の代替証拠には採用しなかった。Wails/Playwright E2E の成功だけを E1/E2 証拠として採用。
- Artifacts updated: `90_status.md`、`91_worklog.md`、`docs/plan_index.md`、`docs/cheatsheet/web_context_providers.md`、`docs/cheatsheet/link.md`。
- Handoff: A-01〜A-03 を修復し、Wails 実画面で REQ-14 と代表実課題の REQ-17 を実施して再受入する。Step 11 documentation feedback と `state: done` はそれまで行わない。

## WL-014 — Step 9: Acceptance repair A-01/A-02/A-03

- Date/time: 2026-08-13
- Actor/session: Grok implementation session
- Purpose: 受入 fail 3 件を修復する。acceptance 列は触らない。
- Checks: live `GET /api/v1/search` + Bot invalid → 404 HTML。`POST /api/v1/search` + Bearer invalid → 400。`GET /api/v0/search` + Bot invalid → 401。help.kagi.com 例は GET + Bot。
- Actions: Kagi adapter を GET + `Authorization: Bot` + `q`/`limit` に変更し object/array envelope を両方読む。Promote は packetId を packet 本体と一致させる。Dialogue packet は runId/runEpoch/active run を検証。F3-04 に Stop 遅着と Canvas 移動、F3-05 に unauthorized/timeout/empty を追加。
- Decision: adapter request は acceptance が要求した公式例（GET + Bot）に合わせる。未認証 GET v1 404 と認証付き 200 未実施は residual。
- Artifacts: `backend/web_search.go`、packet/Promote/ChatDrawer、`ce2e-f3.spec.ts`、cheatsheet、`40_specification.md`、`90_status.md` implementer evidence。
- Handoff: 自動テスト再実行後、別 session が acceptance を再判定する。

## WL-015 — Authenticated Ollama / Kagi probe

- Date/time: 2026-08-13
- Actor/session: Grok implementation session
- Purpose: ユーザーが置いた `.env` の `OLLAMA_API_KEY` / `KAGI_API_KEY` で本番 adapter 契約を確認する。secret は記録しない。
- Checks: disposable Go probe。Ollama POST Bearer → 200 `results[]`。Kagi GET v1 Bot → 404。Kagi POST v1 Bearer → 200 `data.search[]`。Kagi GET v0 Bot（同一 key）→ 401。日本語クエリも両 POST 200。
- Decision: Ollama / Kagi は **Go**。Kagi adapter を POST JSON + Bearer に戻す。help.kagi.com GET + Bot は No-Go。
- Artifacts: `docs/cheatsheet/web_context_providers.md`、`backend/web_search.go`、`40_specification.md`。
- Residual: Brave は未確認。Kagi GET v1 は公式例と live が不一致。

## WL-016 — Step 10: Re-acceptance Hold

- Date/time: 2026-08-13
- Actor/session: Codex re-acceptance session
- Purpose: A-01〜A-03 の修復と全受入条件を再確認する。
- Checks: `mise run test` exit 0、`mise exec -- go vet ./...` exit 0、`mise run build` exit 0（11.208s）、`mise run e2e` 22 passed。packetId/run correlation、F3-04/F3-05、Kagi request fixture、secret tracking、文書整合を点検。
- Result: **Hold**。A-01 Kagi と A-03 E2E は pass。A-02 は主要修復を確認したが、runEpoch 欠落と空query/backend例外時の orphan async run が残る。`.env` が VCS tracking 対象で NFR-04 fail。REQ-14/17 E4 は未完了。
- Secret handling: `.env` の内容は読まず、ファイル状態だけを確認。`.gitignore` 追加後も `jj status` は `A .env`、`jj file list .env` も追跡対象を示した。
- Handoff: `.env` を削除せず untrack、Dialogue packet で runEpoch を必須化、空query/例外で run を cancelし、対象testを追加して再受入する。

## WL-017 — Step 9/10: Remaining repair and technical acceptance

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: 再受入で残った A-02/A-05 を修復し、技術受入を再実行する。
- Actions: Dialogue packet の runEpoch 欠落を stale 化。query validation を run 開始前へ移動し、backend例外でも run をcancel。unitとF3-04 E2Eを追加。`.env` は内容を読まず、削除せず `jj file untrack .env`。
- Checks: `mise run test` exit 0、`mise exec -- go vet ./...` exit 0、`mise run build` exit 0（10.749s）、`mise run e2e` 22 passed。`jj status` に `.env` なし、`jj file list .env` は no matching entries、ファイルはdiskに残存。
- Result: A-02/A-05 pass。全E1/E3技術項目pass。REQ-14/17のE4は人間による実課題評価待ちのため `state: accepting` を維持。
- Artifacts updated: `contextPacket.ts`、`useAppStore.ts`、`f3ContextPacket.test.ts`、`ce2e-f3.spec.ts`、`.gitignore`、`90_status.md`、`91_worklog.md`、`docs/plan_index.md`。
- Handoff: 代表的実課題でpacket UI / grounded use / control / frictionを人間が評価し、GoならStep 11と`state: done`へ進む。

## WL-018 — Step 9: Human E4 findings repair

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: REQ-14/17の実機確認で判明した結果パネル、選択、Promote、長文query、Claim表示、待機表示、Dialogue tool引数連結を修復する。
- Evidence: ユーザーの実機報告8件、`ProjectedContextPanel.tsx`、`useAppStore.ts`、production ID生成、Claim synthesis、`agent_loop.go` tool argument parsing。
- Actions: パネルを高さ制限付きスクロール領域化しPromoteをsticky表示。production IDを乱数化し、LLM由来Claimの空・重複IDを補完。Promote成功後はpacketを閉じCanvasへ戻す。長文/空queryを選択summaryから解決。検索中indicator、Claim参照元タイトル、partial説明を追加。連結tool callの最終tool/JSONを境界で復旧。unit/E2E回帰を追加。
- Decision: KagiのPOST JSON + Bearer契約は実key確認結果を正として維持する。Claim synthesis失敗時に内容を捏造せず、sourcesのみPromote可能なpartial状態を明示する。
- Handoff: plan-defined自動チェック後、修正版でREQ-14/17の人間受入を再実施する。

## WL-019 — Step 9: Packet selection lifecycle repair

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: Promote後の2回目検索へ前packetの選択数が残り、存在しないitem IDでPromoteが失敗する問題を修復する。
- Evidence: ユーザー実機報告、`ProjectedContextPanel`が`activePacket=null`でもmountedのままlocal stateを保持する実装。
- Actions: `packet?.packetId`変更時にclaim/source/relation選択をpaint前に空へ戻す。F3-02bとして、1回目をUIからPromote後、2回目が0件・全off・Promote disabledで開始するWails E2Eを追加。
- Decision: storeのpacket lifecycleとUIの一時選択を混在させず、packet identityを選択stateの寿命境界にする。
- Handoff: plan-defined自動チェックを再実行し、修正版で人間受入を継続する。
- Checks: `mise run e2e` 23 passed（29.4s）。F3-02bで1回目Promote後の2回目packetが選択0件、全checkbox off、Promote disabledを確認。

## WL-020 — Step 10/11: Human acceptance and documentation feedback

- Date/time: 2026-08-13
- Actor/session: Human acceptance + Codex documentation session
- Purpose: 修復後のF-3 coreを最終受入し、確定したas-built状態をstatus、index、roadmapへ同期する。
- Evidence: 人間が各種検索導線、検索結果パネル、個別選択、Promote、検索結果からのNode作成を一通り実機確認。直前のWails Core E2EはF3-02bを含む23 passed。
- Result: REQ-14/17 pass、F3 core Gate Go、`state: done`。F-3A / F-3B Direct Tool / F-3D coreの受入完了。
- Documentation feedback: `90_status.md`、`docs/plan_index.md`、親roadmapをdone/Goへ同期。F-3C Specialist subagentは未実装の失敗扱いにせず、`specialist_agent_bridge`別計画候補へ明示defer。
- Handoff: F-3 coreに必須残件なし。F-3Cを開始する場合は新規Full計画としてtier、E2E、worklog、外部実行境界を改めて決める。
