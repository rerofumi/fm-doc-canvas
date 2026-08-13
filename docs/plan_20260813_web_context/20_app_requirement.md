# App Requirements

## Purpose

外部検索へ移動して結果を貼り付ける作業を減らし、Web の根拠・対立・不確実性を現在の机上素材と同じ面で比較・採否できるようにする。価値は検索回答の速さではなく、採用した項目だけが共同記憶になることにある。

## Target Environment

- F1 / F2 と同じ単体 Wails desktop app。
- 最初の External Source は Web。Acquisition Route はこの plan では Direct Tool のみ。
- 本番検索は `WebSearchPort` strategy。既定は Ollama Cloud Search、切替先は Kagi Search と Brave Web Search。Settings で既定 provider と per-provider key を保持する。検索操作ごとには executor を選ばせない。
- LLM 通信は既存 Chat Completions / Agent Runtime を再利用する。synthesis も同じ契約に乗せる。
- Core E2E は fake Context Provider と fake LLM を使い、credentials / 外部ネットワークを要求しない。
- MCP、Specialist subagent、Repository、画像検索、ページ scrape は入力経路にしない。

## User Experience

1. ユーザーは Dialogue で調査を依頼するか、明示 Direct Action で検索クエリを実行する。任意で Current Canvas の選択 Node を「問いのヒント」にできる。
2. アプリは検索だけを行い、Canvas の Node 数は変わらない。結果は Projected Context として、query、ソース一覧、整理済み claim、由来を表示する。
3. ソースは観測（title、URL、domain、snippet、確認時刻）として見せる。合意 / 対立 / 少数意見 / 不確実性 / 鮮度は推論であり、確定事実と混ぜない。
4. 同一 URL や同一 domain の重複は独立意見として数えず、折りたたんで示す。
5. ユーザーは必要な claim / source だけを選び、現在の素材への Relation 案を採否して Promote する。選ばなかった項目は Node にならない。
6. Promote 後の Node は元ソース URL と確認時刻を保持する。URL は OS の既定ブラウザで開く。アプリ内 WebView や backend によるページ取得はしない。
7. Direct Action の検索は Dialogue 履歴や追加 Proposal を作らない。失敗時は no-op、成功時は packet と（Promote した場合の）undo を示す。
8. New / Discard / Canvas 移動 / Stop のあと遅着した検索結果や Promote は適用しない。

## MVP Features

| Feature | MVP behavior |
| --- | --- |
| Direct Tool search | 明示 query による一回の `web_search`。選択中 strategy が最大 8 件のソースを返す |
| Search provider strategy | Settings で `ollama` / `kagi` / `brave` を切替。未選択 provider の key を消さない。失敗時に別 provider へ送らない |
| Context Packet | 観測ソースと推論 claim を分離し、executor / status / query / retrievedAt を持つ |
| Projected Context UI | Dialogue または Direct receipt に一時表示。自動保存・自動 Node 化しない |
| Known URL | ユーザーが渡した https URL を scrape せずソースとして追加し、ブラウザで開ける |
| Promote | 選択項目だけ Text Node 化。1 回最大 5 件。任意で F2 Relation を atomic に追加 |
| Provenance | URL、domain、retrievedAt、query、provider を adopted Node に残す |
| Entry separation | Dialogue / Agent は tool 結果として packet を出す。Direct Action は request-as-approval の一発検索 |
| Safety | timeout、key 欠落、空結果、stale promote を actionable error にし、部分 Node を残さない |
| F3 value gate | 実課題の E4 review で転記減少、根拠利用、掃除負担を判定 |

## Future Candidates

- F-3C Specialist subagent と、同じ Context Packet への複数段階調査。
- Direct Tool / Specialist の自動 routing。
- ページ extract、Kagi `extract` / Extract API、site: 指定の深掘り、news freshness の高度フィルタ、Ollama `web_fetch`。
- Tavily を第三 strategy として実装すること。
- 検索履歴ライブラリ、Research Archive、大量 Source Node。

## Initial Non-Goals

- 検索結果の自動 Accept、自動 Relation 確定、全ヒットの Node 化。
- 検索したことを事実の保証にすること。
- MCP client、Specialist subagent、Repository mutation。
- アプリ内ブラウザ、backend による任意 URL fetch。
- 検索操作ごと、または Agent 判断による Context Provider / Acquisition Route 選択。Settings の既定 strategy 切替は対象内。
- Core E2E に実 API key と実ネットワークを持ち込むこと。
