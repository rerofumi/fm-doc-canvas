# Review Notes

## Review Findings

### R-01: ロードマップ F-3 は 4 枝あり、一度に実装すると Gate が混ざる

F-3A〜D と F-3C を同じ slice に入れると、単発検索の価値と複数段階委譲の価値を分けて判定できない。D-07 は「試作前に route を固定しない」とするが、比較可能な最初の試作を同時に 2 本作ることまでは要求していない。

**Resolution**: この plan は F-3A + F-3B Direct Tool + F-3D に絞る。F-3C は `specialist_agent_bridge` として残し、同じ Context Packet 契約だけ先に固定する。D-07 の「固定しない」は最終 route のロック禁止として解釈し、最初の実測対象は小さい Direct Tool とする。

### R-02: LLM 内蔵検索は共同材料にならない

xAI / OpenAI Responses の `web_search` は citations 付き回答を返す。現行 agent loop は Chat Completions であり、観測ソースの採否 UI を一次面にできない。ローカル LLM 利用者は検索不能になる。

**Resolution**: 検索 strategy は構造化 SERP のみ。既定は Ollama Cloud `web_search`、切替は Kagi v1 と Brave Web Search。LLM 内蔵検索、Ollama `web_fetch`、Kagi `extract` は strategy にしない。synthesis は別の structured call とし、推論ラベルを付ける。

### R-03: 検索結果の自動 Node 化と Research Archive 化

コンサルタント案にも「必要な項目だけ Promote」とある。自動 Node 化は CW-3A の失敗条件（掃除負担、根拠喪失の逆）に直結する。

**Resolution**: 検索は mutation ではない。Promote は明示選択、1 回 5 件、未採用は Save / Active Context に入れない。

### R-04: 既知 object 取得を scrape と読むと SSRF が入る

F-3B の「既知 object の取得」をページ fetch と実装すると、任意 URL への backend アクセス、HTML 依存、robots / ToS が core に入る。

**Resolution**: 既知 URL は metadata ソースとして packet に載せ、閲覧は OS browser。extract は後続候補。

### R-05: 新しい Relation kind `cites` はまだ不要

Web 由来を Relation で表すと、F2 の意味的 Relation と出典が混ざる。出典は provenance の責務である。

**Resolution**: `cites` を追加しない。机上素材との関係だけ F2 kind を使う。

### R-06: Gate F-3 は機能テストだけでは受理できない

外部移動が減ったか、根拠が判断に使われたかは E1 では判定できない。

**Resolution**: REQ-17 を F2 REQ-18 と同様の task-based E4 とする。

### R-07: 認証付き検索 API は計画時点で未実施

Brave / Tavily の未認証 probe と公式 schema は確認した。200 OK は key が必要なため未実施。

**Resolution**: Ollama / Kagi / Brave はともに Conditional Go。WP-0〜2 と E2E は fake で先行できる。各本番 adapter の確定は認証付き 1 呼出のあと。ユーザーは Ollama と Kagi の key を保有するが、計画 shell には無い。

### R-08: 単一 provider 固定はユーザー保有 key と将来切替を捨てる

当初は Brave 一つ・通常 UI に切替なしとした。ユーザーは Ollama Cloud Search の key を持ち、strategy としての複数 provider 切替を要求した。imageGen と同じ per-provider 保持なら DC-09（検索のたび選ばせる）を破らずに切替できる。

**Resolution**: `WebSearchPort` registry を採用。Settings で既定を切替。検索操作ごと・失敗時 failover はしない。REQ-18 を追加。REQ-02 は「選択中 strategy を一度呼ぶ」意味を保つ。

## Fixed Decisions

| Decision | Adopted choice | Reason |
| --- | --- | --- |
| Plan tier | Full | 新規外部 API、Context 契約、Agent tool、UI、persistence、E2E に影響 |
| E2E | Core E2E in scope | F1/F2 harness があり、packet と Promote は browser→binding を通す価値が高い |
| Worklog | enabled | 同一計画群の意思決定を追跡する |
| Acquisition Route | Direct Tool only in this plan | 小さい方から実測する。F-3C は別 plan |
| Search strategy | `ollama`（既定）+ `kagi` + `brave` + `fake`。Settings 切替、no failover | ユーザー保有 key を活かし、imageGen と同じ保持規則。Kagi は品質候補 |
| Packet lifetime | Dialogue / run の一時状態 | D-11。自動保存しない |
| Mutation boundary | Promote only | 検索と採用を分ける |
| Persistence | V1.3 optional provenance | F1/F2 migration を壊さない |
| Entry approval | Dialogue は packet event、Direct Action は一発検索 | F2 の入口分離を検索に適用 |
| URL handling | no backend fetch | SSRF と scrape を core から除く |
| Value Gate | REQ-17 E4 | 機能成立と CW-3A の価値を分離する |

## Deferred Items

- F-3C Specialist subagent、session handle、複数回検索、Repository。
- Direct Tool / Specialist routing。
- Tavily を第三 strategy として実装すること。
- Ollama `web_fetch`、Kagi `extract` / Extract API、ページ extract、in-app preview、news freshness UI。
- Promote 先 Artifact role / 仮 filename。
- 新しい Relation kind。
- V1.4 file version。
- 実 provider の日本語品質。Core E2E は fake。

## Rejected Options

- この plan で F-3C まで実装する: Gate が混ざる。
- LLM 内蔵 `web_search` を最初の Context Provider にする: 回答と観測が一体、API 面が違う。
- 検索ヒットを自動 Node 化する: Research Archive 化と掃除負担。
- 検索操作ごと、または失敗時に provider を自動選ぶ: DC-09 と由来の不明化。
- Settings での既定 strategy 切替を禁止する: ユーザー要求と保有 key に反する。
- MCP client を入れる: D-07。
- 検索結果を assistant 本文だけに出す: 共同材料にならない。
- 全 Canvas 本文を検索 hint にする: F1/F2 allowlist 違反。
- Light plan: 外部 API と契約変更があるため不足。

## Current Non-Goals

- 複数ユーザー、Saved Workspace Recall、Generated View、画像を Web Context の入力にすること。
- 検索履歴ライブラリ、telemetry、性能 SLO。

## Future Plans

- `specialist_agent_bridge`: 単発 Direct Tool では不足する実例が出たとき。
- Tavily を第三 `WebSearchPort` として足す Light/Full amend。
- F-5B は採用済み Web 材料を構造生成へ広げる任意枝。

## Next Plan Candidates

- `specialist_agent_bridge`
- `multimodal_context`（F-4、F-3 とは独立）
- F-2 follow-up transform disposition（本 plan の範囲外）

## Documentation Feedback

実装・受入後に current `docs/requirement.md` / `docs/specification.md` / cheatsheet へ反映する項目:

- `webSearch` config と `web_search` tool
- Context Packet は persist しない
- provenance `origin=web` と optional URL fields
- Core E2E に F3-01〜05

## Amend History

| Date | Change |
| --- | --- |
| 2026-08-13 | Full 新規 plan `plan_20260813_web_context` を作成。F3 core = A/B Direct Tool/D。Brave Conditional Go。F-3C は対象外 |
| 2026-08-13 | ユーザー指示で search provider を strategy 化。既定 Ollama Cloud Search、切替 Brave。REQ-18 追加。`web_fetch` は対象外 |
| 2026-08-13 | ユーザー指示で Kagi Search API v1 を strategy `kagi` として追加。`extract` は対象外。REQ-18 の必須 ID を拡張 |
