# Web Context Providers

External Source が Web のとき、検索結果を Context Packet の観測ソースへ変換する Context Provider の調査記録。製品要件は各 plan に置き、本書は API 契約・検証結果・採用判断だけを扱う。

- Target version: Ollama Cloud Web Search `POST /api/web_search`（認証付き200確認 2026-08-13）; Kagi Search API v1 `POST /api/v1/search` + Bearer（認証付き200確認 2026-08-13）; Brave Search API Web Search `GET /res/v1/web/search`（2026-02 時点の公開契約）; Tavily Search `POST /search`（OpenAPI 1.0.0）; xAI Web Search tool（Responses / SDK, docs 確認 2026-08-13）
- Confirmed: 2026-08-13
- Environment: Windows 11, PowerShell `Invoke-WebRequest`, no credentials. `OLLAMA_API_KEY` and `KAGI_API_KEY` were unset in the planning shell
- Knowledge type: Official Web docs + unauthenticated live probe
- When to read: F-3 Web Context、WebSearch strategy / adapter、検索設定、E2E fake search を実装・変更する前

## Decision summary

| Candidate | Role | Decision | Condition |
| --- | --- | --- | --- |
| `WebSearchPort` strategy + fake fixture | Acquisition contract / Core E2E | **Go** | 既存 `FixtureLLM` / `RuntimeModeE2E` と同じく、実ネットワークなしで packet を返す。provider ID で切替 |
| Ollama Cloud `web_search` | 既定の本番 strategy | **Go** | 2026-08-13 authenticated 200。`results[].title|url|content`。日本語クエリも 200 |
| Kagi Search API v1 | 切替可能な本番 strategy（品質候補） | **Go** | 2026-08-13 authenticated 200 は `POST /api/v1/search` + Bearer。help の GET + Bot は実キーでも 404 |
| Brave Web Search API | 切替可能な本番 strategy | **Conditional Go** | 公式 schema は title / url / description を満たす。認証付き 1 回の成功応答が未実施 |
| Tavily Search (`include_answer=false`) | 追加 strategy 候補 | **Deferred adapter** | F3 core の実装必須ではない |
| Kagi `extract` option / Extract API | 検索結果ページの本文取得 | **No-Go for F-3 core** | 追加課金の scrape。既知 URL は metadata + OS browser |
| xAI / OpenAI Responses `web_search` | LLM 内蔵検索 | **No-Go as search strategy** | 検索と回答生成が一体。観測ソースと推論を分けにくい |
| Ollama `web_fetch` | 既知 URL の本文取得 | **No-Go for F-3 core** | 任意 URL fetch / scrape。既知 URL は metadata + OS browser |
| OpenRouter `:online` / MCP search | 追加経路 | **Out of scope** | D-07 で MCP client 除外。検索操作ごとに executor を選ばせない |
| 失敗時の自動 provider failover | 暗黙切替 | **No-Go** | どの strategy が走ったかを隠す。失敗は選択中 provider の error |

## Product fit (implementation heuristic)

F-3 が欲しいのは「検索回答」ではなく、title / URL / domain / snippet / 確認時刻を持つ観測ソースである。

- 検索 API は観測ソースだけを返す。合意・対立・不確実性の整理は別の structured synthesis とし、推論ラベルを付ける。
- `include_answer`、Answers endpoint、LLM Context endpoint、provider-native grounded answer は最初の Context Provider に使わない。
- Core E2E は fake Context Provider を必須とし、実 API key / 実ネットワークを要求しない。

## Strategy contract

本番・E2E とも同じ `WebSearchPort` を使う。adapter は provider 固有 HTTP だけを知り、Context Packet 正規化は共有する。

```text
Search(query, maxResults) -> []{title, url, snippet}
```

- `maxResults` はアプリ側で 1〜8。Ollama API 上限は 10、Kagi `limit` 上限は 1024（返却上限であり取得量は変えない）、Brave `count` 上限は 20
- 選択中 strategy の key が無いときはその strategy を呼ばず `web-search-unauthorized`
- 未知の provider ID は `web-search-unknown-provider`
- 失敗しても別 strategy へ送らない

## Ollama Cloud Web Search

- Endpoint: `POST https://ollama.com/api/web_search`
- Auth: `Authorization: Bearer <OLLAMA_API_KEY>`
- Official source: [Web search](https://docs.ollama.com/capabilities/web-search)
- Body: `{ "query": string, "max_results"?: integer }` — default 5, max 10
- Result shape: `results[].title`, `url`, `content`
- SDK（Python / JS `ollama` package）は使わない。stdlib HTTP で十分
- 同ページの `POST https://ollama.com/api/web_fetch` は F-3 core で呼ばない

### Local probe (no credentials)

- Date: 2026-08-13
- Command: `POST https://ollama.com/api/web_search` with `{"query":"fm-doc-canvas","max_results":1}` and no bearer token
- Expected: 401
- Actual: HTTP 401 `{"error":"Unauthorized"}`
- Result: endpoint is live; bearer auth required

### Authenticated probe (2026-08-13)

- Environment: local `.env` `OLLAMA_API_KEY` present (value not recorded)
- `POST https://ollama.com/api/web_search` `{"query":"fm-doc-canvas","max_results":1}` + Bearer → **HTTP 200**, JSON `results[0].title|url|content`
- Japanese query `協調的ワークスペース ドキュメント` → **HTTP 200**, same `results[]` shape
- Result: **Go** for Ollama Cloud `web_search` adapter
- Residual risk: rate limit / quota 未計測。`content-type` は `text/html` でも body は JSON
- Update when: field names change or 429 appears

## Kagi Search API v1

- Adapter request: `POST https://kagi.com/api/v1/search` JSON `{"query","workflow":"search","limit"}`
- Adapter auth: `Authorization: Bearer <KAGI_API_KEY>`
- Response mapping: `data.search[].title|url|snippet`（任意 `time` / `props`）。配列 envelope `data[]` + `t=0` も読めるが、認証付き 200 の実体は object envelope
- Official sources: OpenAPI [POST /search](https://kagi.com/api/docs/openapi/search/search); help example GET + Bot は live 404
- `extract` / page fetch / legacy `GET /api/v0/search` は F-3 core 対象外
- Decision: **Go** for POST + Bearer。help.kagi.com の GET + Bot 例は実キーでも 404 のため採用しない

### Authenticated probe (2026-08-13)

- Environment: local `.env` `KAGI_API_KEY` present (value not recorded)
- `GET /api/v1/search?q=fm-doc-canvas&limit=1` + `Authorization: Bot <key>` → **HTTP 404** HTML `Not Found | Kagi Search`
- `POST /api/v1/search` + Bearer + `workflow=search` → **HTTP 200** JSON `data.search[0].title|url|snippet|time|props`（`related_search` あり）
- Japanese query `協調的ワークスペース ドキュメント` POST + Bearer → **HTTP 200**, same `data.search[]` shape
- `GET /api/v0/search` + `Authorization: Bot <same key>` → **HTTP 401** `error[0].code=2 Unauthorized`（この key は v0 Bot ではない）
- Result: production adapter は POST JSON + Bearer。GET + Bot は No-Go
- Residual risk: help ページ例が誤誘導する。quota / billing は未計測
- Update when: Kagi が GET v1 を実運用するか、key 種別が分かれたとき

## Brave Web Search

- Endpoint: `GET https://api.search.brave.com/res/v1/web/search`
- Auth header: `X-Subscription-Token`
- Official sources: [product](https://brave.com/search/api/), [get started](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started), [API reference](https://api-dashboard.search.brave.com/api-reference/web/search/get)
- Useful query params: `q`, `count` (max 20), `offset` (max 9), `extra_snippets=true`, `freshness`, `safesearch`, `search_lang`, `country`
- Result shape needed by Context Packet: `web.results[].title`, `url`, `description`; optional `extra_snippets`
- Domain は URL から算出する。API が domain を別 field で返しても、packet 側は正規化 host を正とする
- Independent index。Answers / LLM Context は別 endpoint であり、F-3 core では呼ばない
- 公式は agent 向けに LLM Context endpoint を勧めるが、本製品は観測ソースと推論を分離したいので Web Search を使う

### Local probe (no credentials)

- Date: 2026-08-13
- Command: `GET https://api.search.brave.com/res/v1/web/search?q=fm-doc-canvas&count=1` without `X-Subscription-Token`
- Expected: auth / validation error, not DNS / TLS failure
- Actual: HTTP 422 JSON `error.code=VALIDATION`, `meta.errors[0].loc=["header","x-subscription-token"]`, `msg=Field required`
- Result: endpoint is live; header name confirmed
- Residual risk: authenticated 200 body, rate limit, plan quota, Japanese query quality are unverified
- Update when: header / path / result field names change, or authenticated fixture is captured

## Tavily Search

- Endpoint: `POST https://api.tavily.com/search`
- Auth: `Authorization: Bearer <TAVILY_API_KEY>`
- Official source: [Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- Result fields: `results[].title`, `url`, `content`, `score`
- Must disable `include_answer` (default false). Do not enable `include_raw_content` in F-3 core
- `max_results` 1–20, default 5

### Local probe (no credentials)

- Date: 2026-08-13
- Command: `POST https://api.tavily.com/search` with `{"query":"fm-doc-canvas","max_results":1,"include_answer":false}` and no bearer token
- Expected: 401
- Actual: HTTP 401 `{"detail":{"error":"Unauthorized: missing or invalid API key."}}`
- Result: endpoint is live; error envelope confirmed
- Residual risk: authenticated 200 body and snippet quality unverified
- Why not first: answer / extract 機能が近く、検索結果を共同材料ではなく回答に畳みやすい

## xAI / OpenAI-compatible web_search

- Official source: [xAI Web Search](https://docs.x.ai/developers/tools/web-search)
- Surface: xAI SDK `web_search()`, Responses API `{ "type": "web_search" }`, optional `allowed_domains` / `excluded_domains`
- Live Search 旧 API は deprecation 方向（tools へ移行）
- Why No-Go as first Context Provider:
  - モデルが server-side で検索し、citations 付き回答を返す。観測ソース一覧を人間が採否する UI の一次面にならない
  - 現行 agent loop は Chat Completions tool-call。Responses API への切替は F-3 の垂直 slice を超える
  - ローカル LLM 利用者は検索不能になる
  - 既存 xAI key は image gen 用であり、LLM endpoint と同一とは限らない

## Fake / E2E provider

- Reuse `FM_E2E=1` + `FM_E2E_TEMP_ROOT` composition in `app.go`
- Add a `WebSearchPort` fixture that returns a deterministic Context Packet (2–3 sources, 2 claims, 1 suggested Relation)
- Assert no outbound host other than the existing Wails / Playwright loopback
- Fault hook: extend `FM_E2E_FAULT` or a dedicated search fault key for timeout / empty / unauthorized

## Mapping heuristic

各 strategy は次の共通 DTO へ正規化する。adapter 固有 field を packet や Node に漏らさない。

| Packet source field | Ollama | Kagi v1 | Brave | Tavily | Fake |
| --- | --- | --- | --- | --- | --- |
| `title` | `results[].title` | `data.search[].title` | `web.results[].title` | `results[].title` | fixture |
| `url` | `results[].url` | `data.search[].url` | `web.results[].url` | `results[].url` | fixture https URL |
| `domain` | host of url | host of url | host of url | host of url | fixture |
| `snippet` | `content` | `snippet` | `description` (+ optional extra_snippets joined) | `content` | fixture |
| `retrievedAt` | local clock ISO | local clock ISO | local clock ISO | local clock ISO | fake clock |
| `provider` | `ollama-web` | `kagi-web` | `brave-web` | `tavily-search` | `fake-web` |

Reject non-http(s) URLs. Do not follow redirects or fetch page bodies in F-3 core.

## Secrets and config

- Store per-provider keys in local `config.json` under `webSearch.ollama.apiKey` / `webSearch.kagi.apiKey` / `webSearch.brave.apiKey`. Never put them in canvas JSON, Dialogue, packet, E2E fixtures, or docs
- `webSearch.provider` selects the active strategy (`ollama` | `kagi` | `brave`). Switching must not wipe unused provider keys (same rule as imageGen)
- Do not write secrets into plan / cheatsheet
- `.env` を使う場合は作成前に ignore を確認し、`jj status` / `jj file list .env` で追跡対象外であることを確認する。ignore 追加前に追跡されたファイルは明示的な untrack が必要
- Missing key for the *selected* provider is `web-search-unauthorized`, not a silent fallback to another strategy or to LLM-native search

## Open Questions

- Ollama / Kagi は authenticated 200 と日本語 query を確認済み。Brave authenticated 200 と日本語 query 品質は未確認のため Conditional
- Ollama / Brave の 429 / quota 実測は未確認。timeout は 15s を初期値とし、実測で amend する
