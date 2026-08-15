# App Requirements

## Purpose

素材が増えた Current Canvas で、関係付けと構造化を人間の手作りだけにしない。AI Partner が複数素材の Relation を一括で提案し、観点別の Cluster View を一時的な見方として提示する。人間はそれを採否・編集し、残したいまとまりだけ SubCanvas へ昇格できる。価値は提案数や View 生成回数ではなく、欠落・対立・まとまりの発見が実際の判断に使われ、掃除や確認の負担が便益を上回らないことにある。

## Target Environment

- F1〜F4 と同じ単体 Wails desktop app。
- Relation / SubCanvas は既存の F1 / F2 契約（`RelationRecord`、React Flow edge、`createSubCanvas`、boundary aggregate）を再利用する。
- LLM は既存 Chat Completions / tool-call 契約。新しい provider / SDK / 外部サービスは追加しない。
- Core E2E は `FixtureLLM` / temp root を使い、credentials / 外部ネットワークを要求しない。
- MCP、Specialist subagent、Library View、自動 layout は対象外。

## User Experience

1. ユーザーは複数 Node を選択して **Suggest Relations** を実行する（Direct Action）。選択がない場合は Current Canvas 全体を対象にできる。
2. AI は Relation 候補（型・方向・理由付き）を一括で返し、ユーザーは項目ごとの確認・除外・Accept / Reject を行う。Accept した Relation は一括適用され、一度の undo で取り消せる。
3. Dialogue では AI Partner が対話の流れで `propose_relation_batch` / `propose_cluster_view` を提案できる。既存 pairwise `propose_relation` も維持する。
4. ユーザーは **Suggest Clusters** または Dialogue 提案で、Current Canvas の Node を観点別にグループ化した **Cluster View** を受け取る。提案は cluster 名・理由・所属 Node を示す。
5. Accept した Cluster View は Canvas 上に一時的な overlay（cluster の囲み・ラベル・色）として表示される。Node の本文・所有 Canvas・確定 Relation・保存 position は変わらない。Close で元に戻る。
6. View 内の cluster はその場で名前変更、既存 cluster 間の member の付け替え・除外、cluster 削除ができる（document は変更しない）。これは core の部分実装であり、新規 cluster 作成、split / merge、ungrouped Node の追加は後続候補とする。
7. 残したい cluster だけ、明示操作で SubCanvas へ変換できる。変換前に member・Folder 名・境界 Relation の扱いを preview し、undo できる。undo は Node / Folder / Relation 表示に加え、変換前の active View と cluster membership も復元する。自動変換はしない。
8. Active View の概要は次の Dialogue へ観測情報（viewHints）として渡り、AI は現在の仮グループを参照できる。View は確定事実として扱われない。
9. New / Discard / Load / Canvas 移動 / Stop の後の遅着提案は適用されない。Stop は実行中 request / 未確定 Proposal のみを無効化し、既に Accept 済みの active View は破棄しない。member が削除された View は安全に縮退する。
10. 失敗時は document を変えず、理由と次操作（retry / 対象変更 / 閉じる）が分かる。

## MVP Features

| Feature | MVP behavior |
| --- | --- |
| Direct Relation batch suggestion | 選択または Current Canvas 全体を対象に one-shot LLM 呼び出し。≤8 件の Relation 候補を一つの Proposal として表示。Dialogue 履歴に追加しない |
| Dialogue `propose_relation_batch` | Agent tool として同じ Proposal 契約へ。read-before-propose、scope / stale guard は既存どおり |
| Batch Relation Proposal UI | 項目ごとの kind / direction / reason 表示、項目除外、Accept selected / Reject all / Stop。Accept は atomic、one undo |
| Direct Cluster View suggestion | `SuggestClusters` one-shot。≤8 clusters / ≤40 nodes。Folder Node は member にしない |
| Dialogue `propose_cluster_view` | Agent tool として同じ Proposal 契約へ。Accept まで document 不変 |
| Cluster View overlay | hull / label / 色の非破壊表示。member のドラッグに追従。Close で元に戻る |
| View-local editing | cluster rename、member 付け替え / 除外、cluster 削除。document 不変 |
| Image input | Text は allowlisted body、Image は F4 Vision allowlist（最大3画像）を再利用。Vision非対応 / asset取得失敗は metadata-only に縮退し、その旨を preview に表示 |
| Cluster → SubCanvas | preview dialog + 既存 `createSubCanvas` + composite undo。変換済み cluster は View から除去し、undo では変換前 View も復元 |
| viewHints | active View の cluster membership を Context Resolver の観測情報として次 request に含める |
| Safety / stale | navigation / New / Discard / Load / Stop / member 削除後の提案は no-op または縮退。部分適用しない |
| F-5B value gate | 実課題 E4 で Relation batch と Cluster View を独立に Go / Hold / Stop 判定 |

## Future Candidates

- **Library View**: 再利用候補や評価軸で並べる Generated View。
- **Layout suggestion**: cluster 内自動再配置、整列、hull への吸着。
- 複数 Generated View の同時保持、View 履歴、View の Save / Load 永続化。
- Relation batch 項目の行内編集（kind / direction / reason の修正）。
- 新規 cluster 作成、cluster split / merge、ungrouped Node の手動追加（D-08共同編集能力の後続 slice）。
- Web / Projected Context 素材を特別扱いする cluster 軸。
- Specialist subagent による大規模構造解析。

## Initial Non-Goals

- Generated View を恒久フォルダ・単一の正解構造・Knowledge Base にすること。
- Relation / View の自動 Accept。人間の明示 decision なしに document を変える経路。
- position からの cluster 自動生成、cluster からの Relation 自動確定。
- PromptBar、Transform Direct Action、web_search、generate_image の挙動変更。
- telemetry、件数目標、終了時アンケート。
- Core E2E への実 API key / 実ネットワーク持ち込み。
