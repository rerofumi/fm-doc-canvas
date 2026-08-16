# Claim — F6 Collaboration Orchestration

## Purpose

F1〜F5 で Go になった協働能力を、現在の Focus、Dialogue、Visible Working Set、Relation、Generated View に応じて選びやすくし、人間が判断主体を保ったまま「次の一手」を実行できるか検証する。

F6 は多数の Tool を自動連鎖する workflow engine ではない。既存能力のうち今の局面に合うものを少数提案し、対象・理由・期待結果・実行レベル・取消方法を人間と共有する協働調整層である。

## Background

F1〜F5 では次の能力が受理済みである。

- Current Canvas / selection / Context allowlist を共有する Workspace contract。
- `compare` / `counterpoint` 等の非破壊 transform、typed Relation、Proposal、undo。
- Web search から Context Packet を作り、選択項目だけを Promote する外部材料取得。
- 画像生成・Vision・Image Variant の同一 Workspace 内での利用。
- Relation batch、Cluster View、Cluster→SubCanvas の Generated Structures。

一方、これらは Chat、PromptBar、Canvas context menu、Proposal panel に分散している。利用者は「今は比較、反証、検索、Relation、Cluster のどれを使うべきか」を自分で判断し、入口を選び直す必要がある。既存 Agent loop は Tool を選択できるが、選択肢を比較可能な形で事前提示せず、通常応答・Tool 実行・Proposal の境界も一目では分かりにくい。

## Problem

F6 の元要求である「これまでのツールを利用してコラボレーションツールへ発展させる」は、次の点が未確定である。

1. orchestration が解決する具体的な利用者負担は何か。
2. AI が提案するだけか、選択後に実行まで行うか。
3. どの能力と Action Level を最初の価値検証へ含めるか。
4. route / scope / target をどこまで編集可能にするか。
5. 提案が有用だったことを、Tool call 数や自動化量以外でどう判定するか。

曖昧なまま実装すると、既存メニューの AI 版、Agent cockpit、workflow builder、または提案を整理する新しい仕事になり得る。

## Target Users / Environment

- F1〜F5 の Workspace、Dialogue、Direct Action、Context Packet、Proposal、Generated View を利用するデスクトップ利用者。
- Wails v2 / Go / React / TypeScript / Zustand / React Flow の既存構成。
- LLM、Web Search Provider は既存設定を利用する。新規 external API、npm package、Go module は導入しない。
- Core E2E は既存 Playwright / fake LLM / fake Web Search を利用し、実 API key と外部 network を要求しない。

## Initial Scope Hypothesis

最初の実装仮説は次とする。

> ユーザーが明示的に「次の一手」を呼び出すと、AI Partner が現在の共有文脈から 1〜3 件の Action Proposal を返す。各提案は role、AL、対象、既存 route、期待結果、理由、制御方法を示す。ユーザーは対象・query を必要な範囲で調整して一件を実行するか、拒否・再提案できる。実行結果は既存の derived Node、Context Packet、Relation Proposal、Cluster View Proposal として Workspace へ戻る。

初期 allowlist は次に限定する。

- `clarify`: 不足条件を一つ問い返す（AL-0、document 非変更）。
- `compare`: 選択中の 2 Node 以上を既存 Direct Transform で比較する（AL-2、undo 可）。
- `counterpoint`: 選択中の 1 Node 以上へ反証を作る（AL-2、undo 可）。
- `web_search`: 明示 query で既存 Direct Tool を一回呼び、Context Packet を返す（AL-2、document 非変更）。
- `suggest_relations`: 2 Node 以上から既存 Batch Relation Proposal を作る（AL-1、Accept まで非変更）。
- `suggest_clusters`: 2 Node 以上から既存 Cluster View Proposal を作る（AL-1、Accept まで非変更）。

Suggestion 生成中は上記 action を実行しない。人間が action card の `実行` を選んだ後だけ、既存 route へ dispatch する。

## Success Hypothesis

- 利用者が現在の局面で有効な action と理由を理解できる。
- 読込対象、実行対象、期待結果、document 変更有無、取消方法を実行前に予測できる。
- action 選択後、既存能力の結果が新しい Workspace 材料として現れる。
- 誤った提案を対象修正、query 修正、拒否、再提案で処理できる。
- 外部 Tool への移動や入口探索を減らしつつ、提案の整理・監視・履歴管理を増やさない。

## Failure / Stop Hypothesis

- Context Menu や通常 Dialogue より遅く、提案を読む・直す負担だけが増える。
- 同じ action を機械的に並べるだけで、局面に応じた優先順位がない。
- 対象、route、変更有無を予測できない。
- 提案生成時に Tool が無断実行される。
- 実行後の結果が長文 Chat に流れ、Workspace 材料へ戻らない。
- route / model / provider 選択が新しい管理作業になる。

## Initial Technical Hypotheses

- Agent loop に汎用 chaining を追加せず、`SuggestNextActions` の one-shot structured LLM call とする。
- frontend / backend の allowlist と validator で action kind、role、AL、route、target arity を固定し、LLM の任意 Tool 名や scope を信用しない。
- proposal set は runtime-only とし、Workspace JSON や Dialogue history へ保存しない。
- action 実行は `runDirectTransform`、`runWebSearch`、`runDirectSuggestRelations`、`runDirectSuggestClusters` を再利用する。
- F1〜F5 の workspace / canvas / runtime generation / scope epoch / context digest / source revision guard を継承する。

## Uncertainties

- 1〜3 件の提案が選択負担を増やさず、発見を増やすか。
- 最新 Dialogue、明示 Focus、selection のどれを優先すると自然か。
- card 内の対象・query 修正だけで十分か、action kind / AL / route の変更 UI が必要か。
- `clarify` を他の action と同列 card に置くことが自然か。
- one-shot LLM の選択品質が通常 Dialogue より有用か。
- `suggest_clusters` の最小対象数 2 が実課題で有用か、より大きな対象だけに絞るべきか。

これらは core 実装前に抽象機能を追加して解決せず、Core E2E と実課題 E4 Gate で Go / Hold / Stop を判定する。

## Next Documents

1. `20_app_requirement.md`: MVP 体験、今回対象、将来候補。
2. `30_requirement.md`: REQ ID、verification、E2E、Gate。
3. `40_specification.md`: structured contract、validator、dispatcher、UI、lifecycle、WP。
4. `50_review_notes.md`: 採用・却下・保留した設計候補。
5. `60_review_packet.md`: 実装前レビューと Go / No-Go。

