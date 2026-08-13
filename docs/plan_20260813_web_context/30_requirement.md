# Requirements

## Scope

F1 / F2 の Workspace 契約を利用し、Web を最初の External Source とする Context Packet 取得と、明示 Promote による共同材料化を行う。この plan は F-3A / F-3B Direct Tool / F-3D の core slice である。F-3C Specialist subagent、F-4 multimodal、F-5 Generated Structure は含めない。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | Dialogue または明示 Direct Action から、空でない検索 query を解決する。任意の選択 Text-bearing Node は query hint（summary または短い本文抜粋）に限る。別 Canvas、excluded Node、未採用 packet、hidden body は暗黙に送らない。 | Resolver / request fixture test、Core E2E F3-01 | E1 |
| REQ-02 | Direct Tool `web_search` は選択中の `WebSearchPort` strategy を一度だけ呼び、title / URL / domain / snippet / retrievedAt を持つソース配列の Context Packet を返す。検索だけでは Workspace document を変更しない。 | Domain + backend adapter test、Core E2E F3-01 | E1 |
| REQ-03 | Context Packet は観測ソースと推論 claim を分離する。claim の種別は `consensus` / `disagreement` / `minority` / `uncertainty` / `freshness` とし、1 つ以上の sourceId を引用する。ソースなしの確定事実化を拒否する。 | Packet invariant test、F3-01 | E1 |
| REQ-04 | Packet は Projected / Candidate Context として Dialogue または Direct receipt に一時表示する。raw 検索結果・全調査過程を Save せず、未選択項目を Node 化しない。 | Persistence / UI test、Core E2E F3-03 | E1 |
| REQ-05 | ユーザーが選んだ claim / source だけを Current Canvas の Text Node へ Promote する。1 回の Promote は最大 5 件。Node 作成と承認済み suggested Relation は atomic で、一つの undo で戻せる。 | Atomic reducer + F3-02 | E1 |
| REQ-06 | 採用 Node は provenance に `origin=web`、url、domain、retrievedAt、query、provider を保持する。元の Workspace Node は変更しない。 | Persistence / command test、F3-02 | E1 |
| REQ-07 | 現在の机上素材への Relation 案は F2 の `supports` / `opposes` / `similar` を使い、ユーザーが採否・型変更・拒否できる。自己 Relation、欠損 endpoint、scope 外への暗黙作成を拒否する。 | Relation invariant + F3-02 | E1 |
| REQ-08 | 未採用 packet の本文・URL・claim は次の Active Context と Save に含めない。採用済み Node / Relation だけが Context Resolver と persistence の対象になる。 | Resolver + Save/Load test、F3-03 | E1 |
| REQ-09 | Promote / 遅着 packet の適用前に workspaceId、Current Canvas、runtime generation、scope / run epoch、packetId を検証する。New / Discard / Load / navigation / Stop 後は stale として変更しない。 | Concurrent/stale test、F3-04 | E1 |
| REQ-10 | ユーザー供給の https URL は backend fetch せず packet のソースとして追加できる。http 以外、空 host、ユーザー情報付き URL は拒否する。開く操作は OS 既定ブラウザに委譲する。 | URL validation test、F3-05 | E1 |
| REQ-11 | 同一正規化 URL は 1 ソースに畳む。同一 domain の複数ソースは独立意見として自動加算せず、packet 上で cluster 表示する。 | Normalization test、F3-01 | E1 |
| REQ-12 | key 欠落、timeout、provider 4xx/5xx、空結果、不正 URL は document を変えず、次操作（設定、query 修正、retry、閉じる）が分かるエラーにする。LLM 内蔵検索へ暗黙 fallback しない。 | Backend error test、F3-05 | E1 |
| REQ-13 | Dialogue / Agent の `web_search` は structured packet event を出し、assistant 本文を材料の一次面にしない。明示 Direct Action は追加 Proposal / Dialogue 履歴を作らず、同じ validation と packet 契約を使う。 | Route integration + F3-01/F3-04 | E1 |
| REQ-14 | 主要操作（検索、ソース展開、Promote、URL を開く、undo、閉じる）は accessible name を持ち、失敗理由を理解できる。 | Browser assertions + UX review | E1 / E4 |
| REQ-15 | Core E2E は fake Context Provider と fake LLM だけを使い、実 API key / 外部ネットワークを要求しない。provider へ送る本文は query と allowlist 済み hint に限定する。 | Harness inspection、payload test | E1 |
| REQ-16 | F3 の plan-defined build、typecheck、unit/domain、Go、vet、Core E2E が全て pass する。Core E2E は F3-01〜F3-05 を含み、既存 F1 / F2 E2E を壊さない。 | `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 |
| REQ-17 | 実課題による別受入 session / human review で、(a) 外部検索・調査 Agent への移動や転記が減ったか、(b) 根拠付き Projected Context が比較や判断に使われたか、(c) 元状態・由来・取消方法を説明できるか、(d) 表示量・確認・掃除の負担が便益を上回らないかを記録し、F3 core Gate を Go / Hold / Stop 判定する。件数 telemetry や定型終了アンケートは追加しない。 | Plan-defined task-based review note | E4 |
| REQ-18 | Web Search は strategy として切替できる。実装必須 ID は `ollama`（既定）、`kagi`、`brave`、E2E 用 `fake`。Settings で既定 provider を選び、per-provider key を保持する。provider 切替で未使用 key を消さない。1 回の検索は選択中 strategy だけを呼び、失敗時に別 strategy や LLM 内蔵検索へ送らない。未知 ID は `web-search-unknown-provider`。 | Config roundtrip + registry unit test | E1 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| NFR-01 | 新規 runtime / UI npm package と新規 Go module を追加しない。検索 HTTP は標準ライブラリ、ブラウザ起動は既存 Wails / `pkg/browser` 経路を使う。 | `package.json` / `go.mod` diff inspection | E3 |
| NFR-02 | 検索は document / history を変更しない。Promote は単一 command transaction とし、失敗時に document、history cursor、revision、selection を部分更新しない。 | Fault injection / reducer test | E1 |
| NFR-03 | 外部検索へ送るのは query と選択 hint の allowlist だけである。synthesis に渡す本文も Context Resolver と packet ソースに限定する。 | Payload assertion / Go DTO test | E1 |
| NFR-04 | Web Search API key は local `config.json` のみ。canvas JSON、Dialogue、packet、E2E fixture、cheatsheet に書かない。 | Config / persistence inspection | E3 |
| NFR-05 | Backend はユーザー URL や検索結果 URL を fetch / scrape しない。SSRF 面を F3 core に作らない。 | Adapter inspection + negative test | E1 / E3 |

## Constraints

- 開発・検証コマンドは `mise` 経由で実行する。
- F1 / F2 の V1.3 意味を変更しない。provenance の optional field 追加に留め、V1.4 が必要なら implementation 前に amend する。
- 最初の Acquisition Route は Direct Tool。Specialist subagent や routing を同じ slice に混ぜない。
- 本番 strategy（`ollama` / `kagi` / `brave`）は cheatsheet の Conditional Go に従い、認証付き確認が終わるまで fake と registry を先行してよい。
- 検索操作ごと、Agent 判断、失敗時 failover で Context Provider を選ばせない。Settings での既定 strategy 切替は必須。
- Direct Action は追加の Agent 判断、問い返し、Dialogue への自動昇格を行わない。
- 検索ヒット数の既定上限は 8、Promote は 1 回 5 件。自動ページングしない。

## Compatibility

- V1.0〜V1.3 の既存 load / migration を壊さない。
- 既存 `apply_edit`、transform、Relation、画像生成、Chat session の F1 / F2 挙動を壊さない。
- 旧 config に `webSearch` が無い場合は `provider=ollama` かつ key 未設定として扱い、検索時にだけ key 欠落エラーを出す。

## Verification / Completion Conditions

- Build: `mise run build` が exit 0。
- Typecheck: Wails build 内の `npm run build` が exit 0。必要に応じ `mise exec -- npm --prefix frontend run build`。
- Unit / domain: `mise run test` が exit 0。packet / promote / stale / URL / payload test を含む。
- Backend static: `mise exec -- go vet ./...` が exit 0。
- Core E2E in scope: yes。
- Core E2E IDs: F3-01 search packet / no mutation、F3-02 promote / relation / undo、F3-03 candidate exclusion / persistence、F3-04 Direct Action / stale、F3-05 errors / known URL。
- Authenticated Ollama / Kagi / Brave 200 は各本番 adapter の Conditional Go 条件であり、Core E2E の合格条件ではない。

## Out of Scope

- F-3C Specialist subagent、Delegated Session、追加質問 handle。
- Direct Tool と Specialist の自動 routing。
- MCP client、Tavily adapter の必須実装、Ollama `web_fetch`、Kagi `extract` / Extract API。
- 検索画面での都度 provider 選択、失敗時の自動 failover。
- ページ本体 extract、アプリ内 WebView、検索履歴ライブラリ、大量 Source Node。
- 新しい Relation kind（`cites` 等）。Web 由来は provenance で表す。
- 自動 Accept、全履歴 Memory、background retry、telemetry、性能 SLO の新設。

## Acceptance Criteria

- 各 REQ に verification method と evidence class が設定されている。
- 実装者は `90_status.md` の implementer state / evidence のみ更新し、acceptance は別 session / human が実施する。
- F3 Gate は、外部移動・転記が減り、根拠付き Projected Context が判断に使われ、掃除・確認負担が便益を上回らないことを確認して Go とする。
- この plan の `done` は F3 core slice の受理であり、ロードマップ全体の F-3 milestone closure を意味しない。
