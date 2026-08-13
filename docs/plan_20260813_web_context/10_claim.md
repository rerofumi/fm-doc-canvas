# Claim

## Purpose

F1 の Workspace / Context / Proposal 契約と、F2 の非破壊派生・typed Relation の上に、Web から得た外部材料を「長い検索回答」ではなく、根拠付きの Candidate Context として机上へ戻し、人間が選んだ項目だけを Node / Relation にする最小機能を実装する。

## Background

`docs/plan_20260811_collaborative_workspace/05_roadmap.md` は F-3 を CW-3A（外部の深い文脈を必要な材料へ投影し、合意・対立・不確実性を一緒に検討する）に対応する段階としている。F-2 core slice は 2026-08-13 に受理済みであり、Current Canvas scope、structured Proposal、atomic apply、provenance、undo、Context Resolver、Core E2E harness が利用できる。

ロードマップ上の F-3 は F-3A（Context Packet 契約）、F-3B（最小 Web 取得）、F-3C（Specialist subagent）、F-3D（共同材料化）に分かれる。F-3C は有力な将来候補だが F-3 の成立条件ではなく、候補計画名も `specialist_agent_bridge` として分離されている。

## Problem

現状は Workspace 内の Text-bearing Node を変形・関連付けできる。しかし外部世界の材料を共同所有する契約がない。

- 調査のためにブラウザや別の調査 Agent へ移動し、結果を手で転記する。
- 転記した文章は URL、確認時点、根拠、推論、不確実性を失いやすい。
- 検索結果を自動で大量 Node 化すると、掃除と確認が便益を上回る。
- 検索したこと自体が確定事実として扱われ、机上の仮説と混ざる。

## Target Users / Environment

- Windows 11 上の Wails v2 desktop app。
- React / TypeScript frontend、Go backend、既存の LLM 設定を利用する単一ユーザー。
- F1 / F2 と同じ `mise` 管理の Go / Node、Playwright Core E2E harness。
- 本番の Web 取得には、既存 LLM key とは別の Web Search API key が必要になり得る。既定 strategy は Ollama Cloud Search。Core E2E は key / 実ネットワークを要求しない。

## Initial Scope

### F3 core slice（この plan の受理対象）

1. 選択中 `WebSearchPort` strategy の Direct Tool `web_search` で、明確な一回の検索を行う。既定は Ollama Cloud Search。
2. 取得結果を Context Packet として返す。ソースは観測、合意 / 対立 / 少数意見 / 不確実性 / 鮮度は推論として区別する。
3. Packet を Dialogue 内の一時的な Projected / Candidate Context として表示し、自動 Node 化しない。
4. ユーザーが選んだ claim / source だけを Current Canvas の Text Node と任意 Relation へ Promote する。
5. 採用時に URL、domain、確認時刻、query、provenance を引き継ぎ、一つの undo で戻せる。
6. 既知 URL は backend fetch せず、ユーザー供給ソースとして packet に載せ、OS ブラウザで開ける。
7. Dialogue / Agent からの検索と、明示 Direct Action の一発検索を分離する。どちらも Workspace を検索だけでは変更しない。
8. 実課題の E4 review で、外部移動・転記の減少、根拠付き材料の利用、掃除負担を判定する。

この plan の `done` は F3 core slice の受理を表す。ロードマップ全体の F-3 milestone は、F-3C と未採用の取得経路を個別に採用・延期・棄却した記録が揃うまで open とする。

### 後続候補（この plan の受理対象外）

- F-3C read-only Specialist subagent、session handle、複数回検索、Repository 調査。
- Direct Tool と Specialist の自動 routing。
- MCP client、検索操作ごとの provider 選択、検索履歴ライブラリ。
- ページ本体の scrape / extract、大量 Source Node、Research Archive。
- AnyType / 保存 Workspace / 画像を External Source にすること。

## Initial Technical Hypotheses

- F2 の command / history / provenance / Relation / resolver を拡張すれば、Promote は新しい保存 version なしで実装できる。
- 検索そのものは mutation ではない。Context Packet は Dialogue / run の一時状態であり、Save 対象は採用済み Node / Relation だけである。
- 検索実装は Agent Runtime に埋め込まず、`WebSearchPort` strategy へ隔離する。既定の本番 adapter は Ollama Cloud `web_search`。切替は Kagi Search API v1 と Brave Web Search。いずれも Conditional Go（認証付き 200 未実施）。
- Settings で provider と per-provider key を切り替える。検索操作ごとや失敗時の自動 failover はしない。
- LLM 内蔵の `web_search`（xAI / OpenAI Responses）と Ollama `web_fetch` は観測ソース戦略にしない。
- Core E2E は fake strategy と既存 fake LLM で完結し、実検索品質は E4 と実装時の認証付き確認に分離する。

## Uncertainties

- 認証付き Ollama / Kagi / Brave 応答の実 body と日本語クエリ品質。schema と未認証 probe は確認済み、200 OK は未実施。ユーザーは Ollama と Kagi の key を保有。
- synthesis の表示密度（claim 数、source 折りたたみ）の最終 copy。
- Promote 先 role の既定は Text。Artifact filename を同時に出すかは F3 Gate 後に判断する。
- 実検索の timeout / 429 / 空結果の頻度。初期 timeout は 15s とし、実測で amend する。

## Next Documents

`20_app_requirement.md` → `30_requirement.md` → `40_specification.md` → `50_review_notes.md` / `60_review_packet.md` → `90_status.md`。
