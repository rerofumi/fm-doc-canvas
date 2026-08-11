# Claim — Collaborative Workspace Foundation

## Purpose

`fm-doc-canvas` を、別々の Node・Chat・Prompt 操作を寄せ集めた Canvas から、人間と AI が同じ対象・関係・変更範囲を共有できる **AI協働型Workspace** へ進める。その最初の実装可能な基盤として、D-12 Text Node Contract、D-02 Workspace / Canvas boundary、F-1 Shared Workspace Contract を構築する。

本計画は [05_roadmap.md](./05_roadmap.md) 全体を一括実装しない。F-2 Collaborative Transform 以降を安全に追加・停止できる domain contract、寿命、保存互換、Context、Proposal、E2E の境界を受理対象とする。

## Background

利用実態は [00_usecase.md](./00_usecase.md) と [01_research.md](./01_research.md) に記録されている。`fm-doc-canvas` は、課題や素材を一時的に机上へ置き、画像や文章を生成・比較し、約 3 分の 2 は Workspace を保存せず、Discard または Outcome の Export で終える用途に定着している。

前計画 [plan_20260810_chat_artifact](../plan_20260810_chat_artifact/) は Artifact、ChatDrawer、Canvas 読込 Agent、revision conflict、tool acknowledgment を実装した。一方、現行アーキテクチャは次の不整合を残している。

- 新規起動時に Artifact が自動作成され、素材や空の Canvas から始める意図とずれる。
- Text と Artifact は本文の性質が近いのに別 Node 型・別 Agent tool であり、同じ identity のまま用途を切り替えられない。
- `canvasId`、flat nodes/edges、Chat 保存単位が、Workspace / root Canvas / SubCanvas / Current Canvas の境界を表せない。
- 未保存 Workspace の Dialogue も `chat-sessions.json` へ自動永続化され、Discard 後に孤立し得る。
- Dialogue は単一 target、Direct Action は複数選択で、Context 解決規則が一致しない。
- Agent の mutation proposal は Frontend 到着時に即時適用され、`proposed → accepted / modified / rejected` と undo を表せない。

## Problem

次段階の共同変形、Relation、外部 Context、画像共同生成を個別に追加すると、現在の型・保存・寿命・Context の分裂を増幅する。先に共通契約を作らなければ、次のリスクを局所修正では抑えられない。

1. Text / Artifact の role 変更や SubCanvas 移動で identity、Relation、revision、filename を失う。
2. Current Canvas 外の本文や古い run の mutation が暗黙に読込・適用される。
3. 意図的に捨てた Dialogue が永続化される一方、必要な短期会話は Agent Context に渡らない。
4. 人間承認を待つ Proposal が現行 10 秒 acknowledgment と競合する。
5. UI、Wails binding、Go validation、保存 migration を横断する回帰を自動 E2E で検出できない。

## Target Users / Environment

- Primary user: Windows 11 上でローカル利用する単一ユーザー。
- Desktop runtime: Wails v2 / WebView2、Go Backend、React / TypeScript Frontend。
- Data: ユーザーが明示 Save した Workspace JSON、ローカル設定、外部参照の画像ファイル。
- AI: 既存 OpenAI-compatible Agent Runtime を継続利用する。新しい Web API、MCP client、画像 Provider は本計画に追加しない。
- Verification: `mise` 管理環境、固定 fixture、実ユーザーデータ・API key・外部 network に依存しない Core E2E。

## Initial Scope

1. 一つの text-bearing domain node と、可逆な `text` / `artifact` role。
2. `Workspace → root Canvas / SubCanvas → Node` の identity と Current Canvas scope。
3. V1.0〜V1.2 を読める新保存形式と、identity を失わない migration。
4. Dialogue は作業中だけ、Save は机上状態だけ、Discard は Workspace と Dialogue を残さない寿命規則。
5. Dialogue / Direct Action が共有する Context Resolver と、Active / Candidate Context、Mutation / Relation Target の可視化。
6. AL-2 mutation の Proposal、accept / modify / reject、stale 拒否、provenance、undo。
7. SubCanvasの明示集合targetと、将来のDelegated Session / Projected Contextをhidden Chatにしない予約契約・表示先。
8. workspace / canvas / generation / revision で相関したChat / Direct Action / Proposal DTO、Backend request validation、Frontend compare-and-apply。
9. browser-driven Core E2E と native Wails smoke を含む受理経路。

## Initial Technical Hypotheses

- Runtime domain model と React Flow presentation node を分離すれば、Text / Artifact を role として扱いつつ UI 表現を維持できる。
- 新保存形式を `1.3` とし、旧 `customNode` / `artifactNode` を load adapter で一つの text-bearing node へ変換すれば、V1.2 の意味を変更せず移行できる。
- Context解決を完全なWorkspace snapshotを入力するpure functionとし、外部送信body allowlistをFrontend / Goで一致検証すれば、入口ごとの解釈差とscope leakを減らせる。時間経過後のfreshnessはFrontend storeのcompare-and-applyを最終権威にする。
- Dialogue を memory-only に戻し、明示 Save に raw Dialogue を含めなければ、一時性と短期会話継続を両立できる。
- Wails dev browser server と browser automation を利用すれば、UI → generated binding → Go Backend の vertical slice を自動化できる可能性がある。

## Uncertainties

- Playwright 1.62.1 は CLI 起動まで確認済みだが、Wails binding、実 browser、子 process cleanup は未確認である。WP-0 の Go / No-Go 条件とする。
- Browser E2E は WebView2 固有 drag & drop、native dialog、clipboard を保証しないため、native smoke を併用する。
- 既存 `chat-sessions.json` は自動削除せず読込停止とし、新しい孤立データを増やさない。既存ファイルの削除・移行は本計画の破壊的処理に含めない。
- Short Recovery の必要性と TTL、保存済み Workspace の再発見、外部 Context Provider は実利用上の要求が生じるまで Hold とする。

## Next Documents

1. [20_app_requirement.md](./20_app_requirement.md): MVP のユーザー体験と非目標。
2. [30_requirement.md](./30_requirement.md): REQ ID、検証方法、Evidence class。
3. [40_specification.md](./40_specification.md): domain model、保存 migration、状態遷移、WP、E2E。
4. [50_review_notes.md](./50_review_notes.md): 採用・棄却・保留判断。
5. [60_review_packet.md](./60_review_packet.md): human review と Go / No-Go。
6. [90_status.md](./90_status.md): 実装証拠と別セッション受理。
