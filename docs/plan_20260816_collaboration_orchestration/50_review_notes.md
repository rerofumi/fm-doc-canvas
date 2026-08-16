# Review Notes — F6 Collaboration Orchestration

## Review Findings

### R-01: F6 は自動実行器か、選択支援か

**Finding**: 「既存 Tool を組み合わせる」を自動 chaining と解釈すると、F6 の価値検証より先に plan state、pause、retry、partial result、cost control、履歴 UI が必要になる。

**Resolution**: core は context-aware な single Action Proposal と、一件だけの human-controlled dispatch とする。複数 step は一件目の結果を見た人間が再度 `次の一手` を呼ぶ。

### R-02: suggestion の入口

**Finding**: 自動提案は initiative を増やす一方、Node追加やselection変更のたびに待機・通知・整理が発生し得る。

**Resolution**: ChatDrawer の明示 `次の一手` のみ。Context Menu / PromptBar へ同じ入口を重複追加しない。manual entry の摩擦が具体的に確認された場合だけ opt-in trigger を後続検討する。

### R-03: 初期 capability allowlist

**Finding**: F1〜F5 の全能力を入れると、画像 provider、Vision、画像 asset、Generated View、Web provider、transform の異なる lifecycle を同時に評価することになる。

**Resolution**: `clarify`、`compare`、`counterpoint`、`web_search`、`suggest_relations`、`suggest_clusters` に限定する。既存 `summarize` と image generation は機能自体を維持するが、F6 core allowlist には入れない。

### R-04: role / AL / route を誰が決めるか

**Finding**: LLM に自由な role / AL / executor を出させると、存在しない Tool、過剰 AL、provider 選択を user が管理する cockpit になり得る。

**Resolution**: LLM は allowlisted `kind` と対象・理由・期待結果だけを返す。role / AL / route / effect / control は code の固定 mapping から付与する。利用者は card を選ぶことで action を選択し、自由な executor editor は持たない。

### R-05: planner へ渡す Context

**Finding**: action 選択のために full body と画像 pixel を毎回送る必要はなく、送信量・privacy・wait を増やす。

**Resolution**: F1 allowlist の label / summary / bounded excerpt、accepted Relation / View hint、bounded Dialogue、Image metadata のみ。child action 実行時は各 F2 / F3 / F5 契約に従う。

### R-06: Focus 不足時の挙動

**Finding**: 材料がない時に全機能一覧を出すと、context-aware partnership ではなく AI menu になる。

**Resolution**: usable intent と対象がない場合は provider call なしの deterministic `clarify` を許可する。質問は card 表示だけでは Dialogue へ追加せず、人間が採用した時だけ assistant message として追加する。

### R-07: target / query の修正範囲

**Finding**: 全 field を編集可能にすると小型 workflow builder になる。一方、scope を直せない proposal は誤提案時に使えない。

**Resolution**: Web query と、proposal 作成時 eligible target 内の Node subset だけを編集可能にする。kind / role / AL / route は変更しない。別 action は別 card または通常 Dialogue / Direct Action を使う。

### R-08: 二段階の承認境界

**Finding**: orchestration card の実行と、Relation / Cluster Proposal の Accept を同一視すると F5 の意味構造確定ルールを壊す。

**Resolution**: card 実行は「既存 feature Proposal を生成する」承認まで。Relation / View の確定は既存 Modify / Accept / Reject を必要とする。Direct Transform は F2 の request-as-approval と single undo を維持する。

### R-09: proposal の寿命

**Finding**: recommendation を Save すると履歴整理・古い提案・再発見という F5A の未確認問題を持ち込む。

**Resolution**: request / proposal / receipt は runtime-only。New / Discard / Load / navigation / Close / re-suggest で破棄し、V1.3 を変更しない。

### R-10: Cancel の意味

**Finding**: Wails の同期 one-shot method は provider transport を途中停止できない可能性がある。

**Resolution**: core は local cancel と requestId correlation を必須にし、遅着 result を no-op にする。provider transport cancel は、待機問題が確認された場合の後続候補とする。UI copy は「結果を無視して閉じる」意味と実装が乖離しないようにする。

### R-11: invalid LLM response の部分採用

**Finding**: 3件中1件が invalid の時に残りを黙って表示すると、LLM の ranking と説明の対応が変わる。

**Resolution**: 一件でも unknown / target / arity / required text が不正なら proposal set 全体を error にする。汎用 menu への fallback も行わない。

### R-12: F6 Gate の閉じ方

**Finding**: child action が正しく動くだけでは F2〜F5 の回帰確認に過ぎず、orchestration の価値を証明しない。

**Resolution**: Contextual Proposal layer を独立 Gate とし必須 Go にする。Transform / Research / Structure の route family は個別判定し、3 family 中2つ以上の Go を F6 core Go の必要条件とする。Context / Control に Stop があれば全体 Go にしない。

### R-13: Existing Agent loop との関係

**Finding**: Agent loop は既に `propose_transform`、`web_search`、Relation / Cluster tools を選べるため、F6 が単なる重複になり得る。

**Resolution**: Agent loop は曖昧な Dialogue と実行を担う既存面として維持する。F6 core は複数候補の比較、role / AL / effect の事前可視化、明示 single dispatch を検証する別面とする。F6 が通常 Dialogue より有用でなければ Gate Stop とする。

## Fixed Decisions

| Decision | Adopted choice | Reason |
| --- | --- | --- |
| Tier / verification | Full、Core E2E、worklog enabled | 横断設計とHuman Gateが必要 |
| Entry | ChatDrawer の明示 `次の一手` | initiative / notification負担を抑える |
| Planner | one-shot structured call、最大1 provider call | proposal qualityを単離して検証 |
| Actions | clarify / compare / counterpoint / web / relations / clusters | F2/F3/F5のGo能力へ限定 |
| Mapping | kind→role/AL/route/controlをcode固定 | hallucinated executorを防ぐ |
| Context | bounded hints、Image metadata-only | privacy / cost / latency境界 |
| Edit | target subset / queryのみ | controlを残しcockpit化を避ける |
| Dispatch | single child action、no chaining | core valueを小さく検証 |
| Result | existing F2/F3/F5 surfaces | Workspace材料へ戻す |
| Persistence | runtime-only、V1.3不変 | recommendation管理を増やさない |
| Cancel | local invalidate + late no-op | sync callでも状態安全を守る |
| Gate | proposal layer必須 + 2/3 route family Go | orchestration固有価値を要求 |

## Deferred Items

- `summarize` の F6 allowlist 追加。
- Image generation / Image Variant の F6 action 追加。
- `reframe` など新 transform capability。
- AL を下げる / route を切り替える card editor。
- provider transport の物理 cancel。
- selection 以外の Current Canvas 全体を Node action target とする提案。
- multi-step continuation、explicit plan、途中再計画。
- opt-in proactive trigger。

## Rejected Options

| Option | Reason |
| --- | --- |
| system promptだけで「次の一手」を自然文回答 | structured target / effect / execution / E2Eを保証できない |
| Agent loopへ`propose_next_actions` Tool追加 | nested approvalとrun continuationがcoreを過大化する |
| deterministic rule menuだけを表示 | context-awareな役割・理由・優先順位を検証できない |
| suggestion生成と同時に一位actionを実行 | human selection前の外部取得・mutationになる |
| LLMが任意Tool名 / AL / providerを返す | unsupported routeとcockpit管理を生む |
| invalid itemだけdropして残りを表示 | ranking /説明の意味を黙って変更する |
| proposal / raw responseをWorkspaceへ保存 |一時利用と過程非保存の原則に反する |
| Canvas / PromptBar / Chat全てに入口追加 |機能入口の分散問題を再生産する |

## Current Non-Goals

- Agent cockpit、workflow builder、automation dashboard。
- AL-3 / Specialist subagent / MCP / AnyType。
- 自動 chaining / parallel agents / self-evaluation loop。
- 自動提案、background monitoring、notification。
- recommendation telemetry、adoption score、long-term learning。
- Workspace Recall / long-term memory。

## Future Plans

F6 core Gate 後、次の条件が実例で確認された場合だけ個別 plan を作る。

- `collaboration_image_action`: 画像生成を提案すると文脈再入力が減る。
- `collaboration_bounded_plan`: single dispatch 後の手動再呼出しが明確な摩擦になる。
- `specialist_agent_bridge`: Repository / 複数段階 Web 調査が Direct Tool で不足する。
- `collaboration_opt_in_trigger`: manual entry を忘れることが主要な失敗になる。

## Documentation Feedback

Acceptance 後のみ次を current docs へ反映する。

- `docs/claim.md`: AI Partner が next action を提案できるという受理済み範囲。
- `docs/app_requirement.md`: manual entry、Action Proposal、single dispatch の受理済み UX。
- `docs/requirement.md` / `docs/specification.md`: as-built contract、allowlist、lifecycle、verification。
- `docs/review_notes.md`: Gate結果と残存制約。
- `docs/plan_20260811_collaborative_workspace/05_roadmap.md`: F-6 plan link と Go / Hold / Stop。

未採用案、E4観察、生の議論は current docs へ移さず本 plan に残す。

## Amend History

- 2026-08-16: 初版。Full / Core E2E / worklog をユーザー確認後、orchestration core と将来候補を分離。
- 2026-08-16: Human Value Gate の実機確認を不合格として受領。単一/複数選択での `next-actions-failed`、不適切な回復文言、未選択時のcanvas-wide助言不足、通常Chatの`read_canvas_node`後400を同じplanのWP-6へ差し戻した。未選択時はCurrent Canvasのbounded contextを既定入力にする決定を採用し、REQ-22/23とF6-06/07を追加した。
