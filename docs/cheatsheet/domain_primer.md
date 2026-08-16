# Domain Primer — AI協働型Workspace

## One-Sentence Description

AI協働型Workspaceは、人間と AI が同じ材料・関係・途中状態を見ながら問い、比較し、変形し、必要な成果だけを持ち帰るための一時的な共同作業空間である。

## Tools / Components

- Workspace: 一回の共同作業の開始から終了までを包む境界。
- Canvas: 材料と関係を見て直接操作する面。
- Dialogue: 意図、曖昧さ、評価基準、反論を調整する面。
- Direct Action: 選択済みの対象へ、追加判断を挟まず一つの操作を行う面。
- Focus: 今どこへ注意を向けているかを表す一時的な問い・意図・制約。
- Visible Working Set: 人間と AI の双方が現在扱えると理解している対象群。
- Context Runtime: 操作ごとに読込対象、変更対象、関係対象、由来、寿命を組み立てる仕組み。
- Outcome: Workspace 全体とは別に持ち帰る文章、画像、判断などの成果。

## Actors / Roles

- Human: 材料、意図、制約、違和感、最終判断を所有し、AI の提案を採用・修正・拒否する。
- AI Partner: 問い返し、反例、関係、別の見方、変形案を提示し、合意された範囲を実行する。
- Workspace: 両者が参照している状態を外部化し、隠れた一方的 memory にしない。
- External Source: Web、repository、保存資料など、Workspace 外にある情報の所在。
- Context Provider / Acquisition Route: 外部情報を由来付きの共同材料へ変換する境界と取得経路。

## Basic Actions

1. 課題、素材、断片、file のいずれかを机上へ出す。
2. Focus と Active Context を必要な範囲だけ定める。
3. 人間と AI が質問、比較、関連付け、変形、評価を往復する。
4. AI の変更は対象・理由・差分・由来を確認し、採用・修正・拒否・取消する。
5. 用が済めば Discard、結果だけ必要なら Export、再開価値があれば明示 Save する。

## Purpose / Completion Conditions

目的は情報量や自動化量を増やすことではなく、発見、比較、判断、変形を同じ文脈で前進させることである。作業の完了は次のいずれでもよい。

- 課題が解決し、Workspace を捨てた。
- Outcome だけを Export した。
- 再利用価値のある Workspace 状態を明示 Save した。

保存率、Chat 件数、Node 数、Tool call 数は単独の成功条件ではない。

## Essential Terminology

- Active Context: 今回の操作で実際に読む採用済み材料。
- Candidate Context: 関連候補だが、まだ採用されていない材料。
- Mutation Target: 書き換え、派生、生成の対象。
- Relation Target: 関係付ける対象と関係の向き・種類。
- Proposal: AI が提示し、人間の採用前には確定状態を変更しない候補。
- Action Proposal: 現在の局面に対して AI Partner が示す「次の一手」の候補。workflow の確定 step ではなく、実行前に role、Action Level、対象、期待結果、制御方法を人間と共有する。
- Provenance: どの材料・操作・外部情報から生じたかという由来。
- Generated View: ownership や本文を変えず、同じ材料を別の観点で一時配置する見方。
- Short Recovery: 恒久履歴ではなく事故直後だけを対象にする復旧層。

## Reusable Domain Elements

- 入口で、作業価値が分かる前から過剰な命名・分類・保存判断を強制しないこと。
- AI が読む対象と変更対象を人間が予測・訂正できること。
- 人間の配置・接続・採否も共同文脈へ戻ること。
- 変更が観測、停止、拒否、取消できること。
- Dialogue、Workspace、Outcome、Recovery の寿命を混同しないこと。
- 外部情報は事実、推論、不確実性、鮮度、由来を区別すること。
- 構造は恒久分類ではなく、共同編集できる思考結果であること。

## Common Misconceptions

- Workspace は恒久 Knowledge Base と同義ではない。
- AI Partner は常時自律実行する Agent と同義ではない。
- Artifact は完成済み Outcome と同義ではない。
- Chat 履歴を長く保存することは、Dialogue の連続性と同義ではない。
- 自動分類や自動 Node 化を増やすことは、共同理解の向上と同義ではない。
- Discard は失敗ではなく、正常な完了形になり得る。

## Reusable Domain Invariants

1. Human が最終的な意図・制約・採否を所有する。
2. Current scope 外の対象を暗黙に読込・変更しない。
3. Proposal は採用前に確定状態を変更しない。
4. identity、Relation、provenance は role 変更や移動で失わない。
5. Discard した作業過程を秘密裏に長期保存しない。
6. Save と Export は異なる。Save は作業状態、Export は選択 Outcome を扱う。
7. Direct Action は明示入力へ忠実で、Dialogue の自動判断を暗黙に継承しない。
8. 外部取得結果は Candidate として入り、明示採用された部分だけが Workspace の確定材料になる。
9. Action Level は成熟度ではなく局面ごとの協働方法であり、高い自律度を単独の価値にしない。
10. Action Proposal の生成と action の実行を分け、人間が選ぶ前に Tool、外部取得、確定変更を開始しない。

具体的な保存形式、Context件数、test isolation、UI selector、provider制約は各projectのRequirement / Specificationで決める。
