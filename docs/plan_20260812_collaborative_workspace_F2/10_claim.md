# Claim

## Purpose

F1 で確立した Workspace / Current Canvas / Context / Proposal 契約の上に、AI と人間が既存 Node を一緒に変形し、Node 間の意味的な Relation を共同編集できる最小機能を実装する。

## Background

`docs/plan_20260811_collaborative_workspace/05_roadmap.md` は、F-2 を CW-2（素材を比較・分解・統合・言い換え・派生させ、関係を発見する）に対応する段階としている。F1 の受理で、空の Workspace、Current Canvas scope、V1.3 persistence、Context Resolver、Proposal の人間承認、revision / stale guard、undo、Core E2E が利用可能になった。

## Problem

現状は Text / Artifact を直接編集し、accepted Relation を edge として表示することはできる。しかし次が共通の操作契約になっていない。

- 元 Node を壊さず、要約・比較・反証などを派生 Node として残すこと。
- AI が提案した Relation の型、方向、理由を人間が確認・変更・拒否すること。
- 派生と Relation を一つの由来・revision・undo 境界で適用し、次の Context に戻すこと。

## Target Users / Environment

- Windows 11 上の Wails v2 desktop app。
- React / TypeScript frontend、Go backend、既存の LLM provider 設定を利用する単一ユーザー。
- F1 と同じ `mise` 管理の Go 1.26.1 / Node 24.14.1、Playwright 1.62.1 Core E2E harness。

## Initial Scope

### F2 core slice（この plan の受理対象）

1. Current Canvas の Text-bearing Node を一つ以上選択し、`summarize`、`compare`、`counterpoint` を実行する。
2. 元 Node を変更せず、派生 Text Node を同じ Canvas に作成する。
3. 派生 Node と入力 Node の `source` / `derived` Relation、および明示的な `supports` / `opposes` / `similar` Relation を扱う。
4. AI の派生・Relation Proposal を preview、accept、modify、reject、Stop、undo できる。
5. accepted Relation と派生の provenance を Save / Load、Context Resolver、次の Dialogue / Direct Action へ反映する。
6. 人間が Current Canvas で変更した Node 配置を明示的な spatial hint として次の Context に反映し、配置だけから Relation や意味を自動確定しない。
7. Dialogue / Agent の Proposal 経路と、一発操作としての Direct Action 経路を分離しつつ、scope、provenance、atomic apply、undo の基礎契約を共有する。
8. 実課題による E4 review で、新しい論点・比較軸・反証・Relation の発見、修正による共同理解、追跡可能性、掃除負担を確認する。

この plan の `done` は F2 core slice の受理を表す。ロードマップ全体の F-2 milestone は、後続候補を個別に採用・延期・棄却した記録が揃うまで open とする。

### 後続候補（この plan の受理対象外）

`extract / split / merge`、`reframe`、variant、text-to-card / card-to-text、画像を本文として扱う変形、Generated View / Cluster、外部 Context、Specialist subagent、複数ユーザー共同編集。これらは消去せず、F2 core の実利用後に個別 disposition を記録する。

## Initial Technical Hypotheses

- F1 の `WorkspaceCommand`、history、`ProposalRecord`、Agent tool-call、Context Resolver を拡張すれば、新しい依存なしで実装できる。
- AI からの自由文を parser で解釈するのではなく、source node IDs、base revisions、operation、content、Relation kind、reason を含む構造化 Proposal として受け取る方が、人間の確認と stale rejection を一つの経路にできる。
- 派生 Node の作成と `derived` Relation の追加は atomic command とし、片方だけ残る状態を作らない。
- F2 では V1.3 のファイル version を維持し、Relation の追加 metadata は optional field / `extensions` として後方互換に扱う。破壊的な version bump が必要になった場合は No-Go として amend する。

## Uncertainties

- `compare` の出力形式（Markdown 表、箇条書き、短い見出し）の最終 copy。
- Relation label を edge 上に常時表示するか、選択時・Inspector・Context preview で表示するか。
- Text Node と Artifact role の派生先既定値は Text とするが、ユーザーが Artifact filename を指定する導線を同時に出すか。
- 実 provider の structured output 差異は Core E2E では fake provider で固定し、実 provider compatibility は実装時に既存 LLM 契約内で確認する。

## Next Documents

`20_app_requirement.md` → `30_requirement.md` → `40_specification.md` → `50_review_notes.md` / `60_review_packet.md` → `90_status.md`。
