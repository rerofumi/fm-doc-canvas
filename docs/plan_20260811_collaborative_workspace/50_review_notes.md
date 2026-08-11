# Review Notes — Collaborative Workspace Foundation

## Review Findings

### R-01: Existing material was a roadmap, not one implementable plan

`00_usecase.md`〜`08_glossary.md` は製品方向、利用調査、用語、D / F Gate を詳細に持つが、REQ、Evidence class、status、implementation package がなかった。`05_roadmap.md` 自身も F-0〜F-6 の一括実装を避け、個別 plan へ昇格するよう求めている。

Resolution: 本 Full plan の受理対象を D-12 + D-02 + F-1 foundation slice に限定した。F-2〜F-6 は `90_status.md` の完了条件に含めない。

### R-02: Product terms and current implementation disagree

Current implementation は flat `canvasId`、別 Text / Artifact type、自動初期 Artifact、永続 Chat、入口別 Context を持つ。roadmap は Workspace / Current Canvas scope、一つの text-bearing node、blank start、短期 Dialogue、shared Context を採用済みとしている。

Resolution: `40_specification.md` に domain / presentation 分離、厳密なV1.3 union、memory-only Dialogue、完全なContext Resolver input / body allowlist、Chat / Direct Action scoped DTOを定義した。

### R-03: Proposal name did not represent human approval

現行は tool proposal event 到着時に Frontend が即時適用し、Backend は最大 10 秒 acknowledgment を待つ。F-1C の accept / modify / reject と人間の判断時間を表せない。

Resolution: proposal lifecycle と apply receipt を分け、human wait を run context / explicit cancel で管理する。10 秒固定 timeout は network/apply acknowledgment にのみ使えるが、人間判断には使わない。

### R-04: Current tests are not E2E

Go tests と `test:sprint-c` は有用だが、React DOM、generated Wails binding、Go service、native WebView2 を一続きに通さない。前計画の Core E2E EX waiver は本計画へ継承できない。

Resolution: browser vertical slice を必須 E1、native WebView2 smoke を E2 とした。runner は WP-0 の実行済み Go 判定を必要とする。

### R-05: Plan sources contain superseded statements

- `02_consultant.md` の Pause は roadmap D-06 の「Pause を作らない」に置き換えられた。
- `02_consultant.md` の定型 session 観測 / 過半数条件は D-09 の concrete-issue driven update に置き換えられた。
- `02_consultant.md` の MCP / external reference 候補は、初期実装で MCP client を含めない D-07 / D-11 を優先する。
- `rubberduck_log.json` は質問ログであり、user observation の根拠ではない。

Resolution: 正式 plan は `05_roadmap.md` と `08_glossary.md` を優先し、古い資料は historical input として保持する。

## Fixed Items

- numeric suffix を `plan_20260811_collaborative_workspace` へ変更した。
- Full / Core E2E enabled / worklog enabled を `90_status.md` に記録した。
- Claim、App Requirements、REQ-01〜REQ-19、Specification、Review Packet、Status、Worklog を追加した。
- domain primer と Wails / Playwright E2E feasibility cheatsheet を追加した。
- V1.3 migration、legacy chat non-destructive handling、Current Canvas scope、event correlation、Proposal state を明文化した。
- Core E2E を CE2E-01〜05 に分割し、F-3 / F-4 extension を後続 plan へ分離した。

## Independent Review Amendments

計画品質、REQ trace、実装可能性の三つのread-only reviewで、初稿には実装阻害レベルの不足が見つかった。次をplanへamendした。

- Resolver inputへWorkspace document / runtime / explicit targets / Candidate seedsを追加し、Agent toolを含むbody accessをallowlistへ限定した。
- 最新Workspaceの権威をFrontend compare-and-applyへ固定し、ChatとDirect Actionのscope token / late result規則を追加した。
- Proposal decisionとapply receiptを二段階Wails protocolに分離し、idempotency / shutdown / Stop / receipt reconciliationを定義した。
- Folder subtree move、cycle拒否、dissolve、cascade禁止、ancestor / siblingを含むboundary projection algorithmを追加した。
- V1.3 persisted union、unknown field方針、legacy version別変換表、deterministic ID / fixture matrixを追加した。
- Backend portsとFrontend clock / ID seam、image metadata / binary transport境界を追加した。
- keyboard E1とhuman E4をREQ-15 / REQ-19へ分離し、SubCanvas集合target / future context slotをREQ-18へ追加した。
- scope epochとactive run epochを追加し、A→B→A navigation / Stop raceでもlate resultを拒否する契約にした。
- 既存Direct Actionのtext vision / image provider selectorとAgent Artifact createを、新DTO / `create-text` proposalへ明示移行した。

上記を反映した再監査をimplementation handoff条件とする。

## Planning Baseline Decisions

以下は実装計画のbaselineであり、`60_review_packet.md`のhuman reviewで承認されるまでは製品実装の受理済み判断を意味しない。

| Decision | Proposed baseline | Reason |
| --- | --- | --- |
| Plan scope | D-12 + D-02 + F-1 foundation | F-2以降のGateを有効に保つ |
| Plan name | `collaborative_workspace` | canonical product conceptを表す |
| Text / Artifact | one text-bearing kind + reversible role | identityと分類負担を両立 |
| Save schema | version 1.3 | V1.2の意味を変更しない |
| SubCanvas UI | Folder + breadcrumb + down badge / up-boundary portal | remote Node複製を避けつつ全tree方向を表す |
| Dialogue lifetime | memory-only、same Workspace内で bounded 12 messages | 継続対話と忘れる自由を両立 |
| Legacy chat file | stop read/write; do not auto-delete | destructive migrationを避ける |
| Context | complete pure resolver + body allowlist + request-local Go validation | UI入口差とhidden body accessを抑える |
| Agent discovery | list / search / readはpreview済みallowlistだけ。全体探索は明示Canvas target | 未選択本文を外部送信しない |
| Proposal | accept/modify/reject/Stop/undo | human ownershipを実装する |
| Existing generation compatibility | Direct text vision、image provider selector、Agent Artifact createを新DTO/Proposalへ移行 | foundationで現行capabilityを落とさない |
| E2E | browser vertical slice + native WebView2 smoke | binding横断とOS固有挙動を分離 |

## Deferred Items

- Playwright runner の最終 Go。WP-0 で browser + Wails binding + cleanup を実行する。
- Short Recovery と TTL。具体的な事故復旧要求が確認されるまで Hold。
- Legacy `chat-sessions.json` の削除 / export / migration。別の明示的な destructive plan が必要。
- 個別 Boundary Relation Proxy。tree anchor集約の視認性不足が観測された時に比較する。
- Saved Workspace Recall、Web Context、image Agent、Generated View、orchestration。
- Windows 以外の E2E / CI matrix。
- performance threshold。具体的退行の最小再現を得た時に REQ を amend する。

## Rejected Options

- F-1〜F-6 の一括 Full implementation: Gate による停止と価値検証ができなくなる。
- Text / Artifact の別 domain type を維持した片方向 Promote: reverse role と hidden filename、identity の要件を満たさない。
- V1.2 を新 Workspace schema として再解釈: 旧 implementation と意味が衝突する。
- legacy Chat の自動削除: user data を確認なしに破壊する。
- Save confirmation / exit survey: Discard を正常系とする利用に管理作業を追加する。
- pure logic test を Core E2E と呼ぶ: UI / binding / service integration の回帰を検出できない。
- browser E2E だけで native app を受理: WebView2、dialog、drag/drop の保証がない。
- real LLM / external network / user credential を Core E2E に使う: deterministic、privacy、cost を満たさない。

## Current Non-Goals

- semantic Relation suggestion と collaborative transform の product UX。
- External Context / Web / MCP / Specialist subagent。
- multimodal Agent loop。
- Knowledge Base / Task Manager / Research Archive。
- Pause、auto-save、save reminder、telemetry、全履歴 Memory。
- preview /明示Canvas targetなしで未選択Node本文をAgentが横断探索すること。
- file asset の自動 garbage collection。

## Future Plans

次の個別 plan は [05_roadmap.md](./05_roadmap.md) の Gate を満たした場合だけ開始する。

1. `collaborative_transform`
2. `web_context`
3. `specialist_agent_bridge`
4. `multimodal_context`
5. `saved_workspace_recall`
6. `generated_views`
7. `collaboration_orchestration`

## Next Plan Candidates

- WP-5 acceptance 後、実利用で共同変形の具体例が確認できた場合: `collaborative_transform`。
- 外部検索への離脱・転記が foundation 上でも主要摩擦の場合: `web_context`。
- Browser E2E runner が No-Go の場合: feature plan ではなく `desktop_e2e_harness` の限定調査 plan を検討する。

## Documentation Feedback

実装受理後に current docs へ次を反映する。実装前には current truth を変更しない。

- `docs/app_requirement.md`: blank start、role、Workspace / Dialogue / Save / Discard。
- `docs/requirement.md`: V1.3、SubCanvas scope、Context、Proposal、E2E。
- `docs/specification.md`: as-built files / DTO / state machine / migration / commands。
- `docs/review_notes.md`: legacy chat file、native smoke、残余リスク。
- `README.md`: user-facing creation、navigation、Save / Export / Discard が確定した場合だけ更新。
- `docs/cheatsheet/wails_playwright_e2e.md`: runner version、binding smoke、Go / No-Go、actual command。

## Amend History

| Date | Change | Reason |
| --- | --- | --- |
| 2026-08-11 | Existing research directory renamed and promoted to Full plan | User requested Full, worklog, E2E, meaningful suffix |
| 2026-08-11 | Scope fixed to D-12 + D-02 + F-1 | Avoid roadmap-wide implementation and preserve gates |
| 2026-08-11 | Playwright kept conditional | CLI passed; browser/Wails/process smoke not yet verified |
| 2026-08-11 | Independent review blockers amended | Resolver/DTO/protocol/SubCanvas/schema/E2E seamsをimplementation-readyな契約へ補完 |
| 2026-08-11 | Independent re-review cleared Blocker/High/Medium | ContextSelection / scope race / Direct Action回帰 / relation metadataまで再監査 |
