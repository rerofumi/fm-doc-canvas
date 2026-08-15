# Claim

## Purpose

F1 / F2 で確立した Workspace / Current Canvas / Context / Proposal / Relation 契約の上に、ロードマップ F-5B「Generated Structures」の core slice を実装する。AI と人間が Current Canvas 上の複数 Node を俯瞰し、Relation の一括提案と、一時的な Cluster View による「別の見方」を受け取り、必要なら採用した Cluster だけを SubCanvas へ変換できるようにする。

## Background

`docs/plan_20260811_collaborative_workspace/05_roadmap.md` の F-5B は、次の3項目を独立判定する。

1. **Relation suggestion** — F-2 の関係候補を複数素材へ広げる。
2. **Generated View** — Cluster View / Library View として観点ごとに異なるまとまりを生成し、Node ownership を変えず、単一の保存分類として固定しない。
3. **Layout suggestion** — 構造理解に配置が必要な場合だけ、自動配置を比較する。

F-2 では pairwise の typed Relation（`source` / `derived` / `supports` / `opposes` / `similar`）と、単発 Transform Proposal を実装済み。F-3 では Context Packet と Promote、F-4 では Image Variant を実装済み。しかし、机上の複数素材を横断して「これらの間にはこのような関係がある」「この素材群は同じ論点でまとまる」という**構造的な提案**を一度に受け取り、可逆な仮配置として眺める経路がまだない。

D-08（採用済み）は、Relation と Generated View と SubCanvas の境界を定めている。Generated View は Node 本文・Canvas ownership・確定 Relation を暗黙に変更しない一時的な仮配置であり、残したい Cluster だけ明示操作で SubCanvas へ変換する。本 plan はこの D-08 を実装で具体化する。

## Problem

現状では次が共通の操作契約になっていない。

- 複数 Node の間に成立し得る Relation を、AI が一括で提案し、人間が項目ごとに採否・修正する経路。
- Current Canvas の素材群を、類似・対立・論点などの観点で一時的にグループ化して見せる Generated View（Cluster View）。
- Generated View の Cluster を、人間の明示操作だけで、preview / undo 付きで SubCanvas（恒久 Folder）へ変換する経路。
- 一時的な View を Save / Load へ持ち込まず、閉じれば元の Canvas へ戻ることの保証。

これらが欠けているため、素材数が増えた後に「関係を見落とす」「まとまりを発見できない」「手動で Folder を作る負担が大きい」という CW-4B の課題を検証できない。

## Target Users / Environment

- Windows 11 上の Wails v2 desktop app。
- React / TypeScript frontend、Go backend、既存の LLM provider 設定を利用する単一ユーザー。
- F1〜F4 と同じ `mise` 管理の Go 1.26.1 / Node 24.14.1、Playwright 1.62.1 Core E2E harness。

## Initial Scope

### F-5B core slice（この plan の受理対象）

1. Current Canvas の Text-bearing / Image Node を対象に、AI が複数 Relation を一括提案する **Relation batch suggestion**。Dialogue の `propose_relation_batch` tool と、Direct Action の one-shot `SuggestRelations` を同じ Proposal 契約へ通す。
2. AI が Current Canvas の Node を観点別にグループ化する **Cluster View proposal**。Dialogue の `propose_cluster_view` tool と、Direct Action の one-shot `SuggestClusters` を同じ Proposal 契約へ通す。
3. accepted Cluster View を **runtime-only の一時的な Generated View** として Canvas 上へ表示する。Node 本文、Canvas ownership、確定 Relation、document position を変更しない overlay 表示とする。Text-bearing Node は本文、Image Node は F4 の既存 Vision allowlist に従う画像入力（上限内）または metadata-only fallback を明示的に使う。
4. active Generated View の各 Cluster を、preview / undo 付きで **SubCanvas へ明示変換**する。変換は既存 `createSubCanvas` atomic command を使い、undo 時は document だけでなく変換前の active View / cluster membership も復元する。
5. active Generated View の情報を `viewHints` として Context Resolver に反映し、次の Dialogue / Direct Action が「現在見ている仮グループ」を観測情報として参照できるようにする。
6. Proposal / View の stale guard、Save / Load で Generated View を永続化しないこと、Core E2E による検証。
7. 実課題による E4 review で、Relation batch suggestion と Cluster View を独立に Go / Hold / Stop 判定する。

この core の View-local 共同編集は、既存コードベースで安全に実装できる rename、既存 cluster 間の member 移動、member 除外、cluster 削除に限定する。新規 cluster 作成、cluster split / merge、ungrouped Node の手動追加は D-08 全体に対する後続候補であり、この plan は共同編集能力の部分実装として受理判定する。

この plan の `done` は F-5B core slice の受理を表す。ロードマップ全体の F-5B milestone は、Library View と Layout suggestion の disposition が揃うまで open とする。

### 後続候補（この plan の受理対象外）

- Library View（再利用候補や評価軸で並べる Generated View）。
- Layout suggestion / auto-layout（Generated View 内での自動再配置、cluster hull への吸着）。
- 複数 Generated View の同時保持、View 履歴、Save 後の View 復元。
- Generated View 自体の Save / Load 永続化。
- Web / Repository / AnyType / MCP / Specialist subagent。
- 自動 Accept、全履歴 Memory、background retry、telemetry、性能 SLO の新設。

## Initial Technical Hypotheses

- F1 / F2 の `WorkspaceCommand`、history、`ProposalRecord`、Agent tool-call、Context Resolver を拡張すれば、新しい依存なしで実装できる。
- Generated View は document へ保存せず、`WorkspaceRuntime` 相当の runtime state として保持する。Save / Load では View を含めず、V1.3 file format を変更しない。
- Cluster の可視化は、React Flow 上へ non-interactive な hull / background node を injection する方式で実現できる。document node として保存しないため、View を閉じれば元の表示へ戻る。
- Relation batch は、既存 `addRelation` command の all-or-nothing batch 版（`addRelations`）を新設し、一つの undo で全 Relation を削除できる。
- AI からの自由文を parser で解釈するのではなく、node IDs、kind、reason、cluster label を含む構造化 Proposal として受け取る方が、人間の確認と stale rejection を一つの経路にできる。

## Uncertainties

- Cluster hull の描画を React Flow の `Panel` + SVG overlay で行うか、pseudo node（`type: "clusterHull"`）として inject するかは、`@xyflow/react@^12.3.0` の挙動確認後に選ぶ。
- `SuggestClusters` Direct Action の対象 scope を「明示選択があれば選択集合、なければ Current Canvas 全体」のどちらを既定にするかは、実利用確認で調整する。
- Cluster View の最大 cluster 数 / node 数上限は、fake E2E では固定値を使い、実 provider の出力品質は Conditional / E4 で確認する。
- Direct / Dialogue の Image Node 入力は F4 Vision allowlist（最大3画像、明示選択優先）を再利用し、Vision非対応または画像取得失敗時は alt / prompt / provenance の metadata-only へ縮退したことを proposal 上で示す。
- Library View と Layout suggestion は今回の判定対象外だが、core 実装後に必要なら別 plan で採用・延期・棄却を記録する。

## Next Documents

`20_app_requirement.md` → `30_requirement.md` → `40_specification.md` → `50_review_notes.md` / `60_review_packet.md` → `90_status.md`。
