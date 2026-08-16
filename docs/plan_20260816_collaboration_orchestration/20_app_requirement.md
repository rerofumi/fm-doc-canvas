# App Requirements — F6 Collaboration Orchestration

## Purpose

利用者が個別機能の入口を覚えて選ぶ代わりに、AI Partner と現在の局面を共有し、少数の「次の一手」から自分で選択・修正・拒否して、既存の協働能力へ進める体験を提供する。

## Target Environment

- Wails v2 desktop application。
- Go backend、React / TypeScript frontend、Zustand、React Flow。
- 既存 LLM provider、Web Search strategy、Context Resolver、Proposal / undo contract。
- `mise.toml` の task と既存 Playwright Core E2E harness。
- 新規 runtime dependency、外部 API、workflow runtime、MCP client は追加しない。

## User Experience

### 1. 明示的に呼び出す

- ChatDrawer の AI Partner 面から `次の一手` を明示実行する。
- 起動時、Node 作成時、selection 変更時に自動提案しない。
- suggestion 生成中は対象、現在の処理、取消を確認できる。

### 2. 少数の提案を比較する

- 1〜3 件の card を推奨順に表示する。
- 各 card は平易な label に加えて role、AL、対象、期待結果、理由、document 変更有無、実行後の制御を示す。
- 内部 executor、model、provider の選択を利用者へ要求しない。route は確認用の短い表現にする。
- 情報が不足する場合は、実行 action を捏造せず `clarify` で一つの質問を示す。

### 3. 選択・軽い修正・拒否を行う

- 利用者は一件を実行、card を拒否、proposal set を閉じる、再提案できる。
- `web_search` の query と、Node 対象 action の対象 subset は実行前に軽く修正できる。
- action kind / role / AL / route を自由編集する cockpit は作らない。別 action は別 card を選ぶか、通常 Dialogue / 既存 Direct Action を利用する。

### 4. 既存能力で実行する

- `compare` / `counterpoint` は既存 Direct Transform と atomic undo を使う。
- `web_search` は既存 Direct Tool と Context Packet を使う。
- `suggest_relations` / `suggest_clusters` は既存 Proposal を生成し、その後の Accept / Modify / Reject を維持する。
- Suggestion request 自体は実行承認ではない。card の `実行` が選ばれるまで Tool、検索、document mutation を開始しない。

### 5. 結果を Workspace 材料へ戻す

- Transform は derived Text Node と relation / provenance / receipt を返す。
- Web search は dismiss / Promote 可能な Context Packet を返す。
- Relation / Cluster は既存の共同編集可能な Proposal を返す。
- orchestration 専用の長文回答、raw execution log、永続的 task history を主結果にしない。

### 6. 終了と再利用

- proposal set は runtime-only で、明示 Close、再提案、New、Discard、Load、Canvas navigation で破棄する。
- proposal set と実行 receipt は Workspace Save に含めない。
- accepted result の寿命は各 F2〜F5 の既存契約に従う。

## MVP Features

### F6-A: Orchestration Context Snapshot

- 明示 Focus があれば優先し、次に直近 Dialogue、明示 selection / Current Canvas context を利用する。
- 本文・画像・Relation・View hint は既存 Context Resolver allowlist に限定する。
- 候補 action の eligibility を LLM 呼出し前に計算する。

### F6-B: Structured Next Action Proposal

- one-shot LLM call で 1〜3 件を生成する。
- action kind は `clarify`、`compare`、`counterpoint`、`web_search`、`suggest_relations`、`suggest_clusters` のみ。
- role / AL / route は action kind ごとの固定 mapping とし、未知値や対象不正は全体を no-op error にする。

### F6-C: Human-Controlled Dispatch

- card ごとに実行、対象 / query 修正、拒否を提供する。
- 実行直前に scope / target / revision / eligibility を再検証する。
- 同時に一つの child action だけを開始する。自動 chaining は行わない。

### F6-D: Existing Result Surfaces

- 既存 Direct receipt、Context Packet panel、Relation Proposal、Cluster View Proposal をそのまま結果面に使う。
- orchestration card は child action の開始結果を表示し、既存結果面への導線を示した後は閉じられる。

### F6-E: Lifecycle / Error / Accessibility

- pending / cancelled / stale / error / ready / dispatched を区別する。
- provider timeout、不正 JSON、空提案、未知 action、対象不正は document を変えず、再提案・対象変更・通常 Dialogue の次操作を示す。
- keyboard と accessible name で呼出し、card 移動、修正、実行、拒否、Close を操作できる。

### F6-F: Value Gate

- 比較、外部根拠、構造発見、Focus 不足の実課題で独立に確認する。
- 提案採用率、Tool call 数、自律実行時間は単独の Go 条件にしない。
- Discovery、Context / Control、Collaboration、Friction、Return intent を人間レビューで判定する。

## Initial Capability Boundary

| Action | Role | AL | Existing route | Result | Core |
| --- | --- | --- | --- | --- | --- |
| `clarify` | 質問者 | AL-0 | Dialogue question | 不足条件への質問 | in |
| `compare` | 比較者 | AL-2 | Direct Transform | derived Text + undo | in |
| `counterpoint` | 批評者 | AL-2 | Direct Transform | derived Text + undo | in |
| `web_search` | 調査者 | AL-2 | Direct Tool | Context Packet | in |
| `suggest_relations` | 整理者 | AL-1 | Direct suggestion | Batch Relation Proposal | in |
| `suggest_clusters` | 整理者 | AL-1 | Direct suggestion | Cluster View Proposal | in |
| `summarize` | 変形者 | AL-2 | Direct Transform | derived Text + undo | future orchestration candidate（機能自体は既存） |
| `generate_image` | 生成者 | AL-2 | Image generation | Image Variant | future orchestration candidate（機能自体は既存） |
| Specialist subagent | 専門委譲者 | AL-3 | 未実装 | Delegated Session / Context Packet | future plan |

## Future Candidates

- `summarize` / 画像生成を action allowlist へ追加する個別 Gate。
- Specialist subagent bridge と AL-3 bounded delegation。
- 一つの結果を見て次を提案する、明示継続型の複数 step plan。
- action card の AL 引下げ / route 切替 UI（実利用で必要性が確認された場合のみ）。
- opt-in trigger、提案タイミング調整（手動呼出しが明確な摩擦になった場合のみ）。
- proposal quality の個人設定や再利用。ただし長期行動学習・raw history 保存は別途 privacy review を要する。

## Initial Non-Goals

- 常時監視、自動発話、起動直後の自動 Agent 実行。
- 汎用 workflow builder、DAG editor、macro recorder。
- 複数 action の自動 chaining、複数 Agent の並列実行、self-evaluation loop。
- AL-3、Specialist subagent、MCP client、repository / AnyType orchestration。
- model / provider / executor cockpit、per-card provider 選択。
- orchestration proposal / raw log / evaluation event の Workspace 保存。
- reframe など未実装の基礎 capability を F6 名義で同時追加すること。
- Saved Workspace Recall、長期 memory、過去 Workspace の自動推薦。

