# F6 Collaboration Orchestration 事前振り返り

- 作成日: 2026-08-16
- 対象ロードマップ: `docs/plan_20260811_collaborative_workspace/05_roadmap.md` の F-6
- 関連資料:
  - `docs/plan_20260811_collaborative_workspace/01_research.md`
  - `docs/plan_20260811_collaborative_workspace/02_consultant.md`
  - `docs/plan_20260811_collaborative_workspace/05_roadmap.md`
- 状態: F6 要件分析前の方向性レビュー

## 1. 本書の目的

本書は、F6 `Collaboration Orchestration` の要件分析に入る前に、`01_research.md`、`02_consultant.md`、`05_roadmap.md` で整理された製品方向を再確認し、F6 で `fm-doc-canvas` がどのような立ち位置を取るべきかを記録する。

F6 は新しい個別能力を大量に追加する段階ではなく、F1〜F5 で Go になった能力を、現在の Workspace / Focus / Visible Working Set に応じて自然に使い分けられるかを検証する段階として扱う。

## 2. 現時点の結論

方向性は維持してよい。

`fm-doc-canvas` は、Notion 型の長期 Knowledge Base、汎用 Chat アプリ、完全自律 Agent Cockpit ではなく、次の製品像として育てるのが妥当である。

> `fm-doc-canvas` は、課題・素材・断片・外部情報・生成物を一時的な机上に並べ、人間と AI が同じ可視文脈を見ながら、問い・比較・関連付け・変形・生成・評価を進め、必要な Outcome / Relation / Workspace だけを選んで持ち帰る AI協働型 Workspace である。

より短く表すなら、次の位置づけである。

> 使い捨て可能な、マルチモーダルな、AI協働ワークベンチ。

ただし「使い捨て可能」「マルチモーダル」「ワークベンチ」は性質であり、最上位概念は AI協働型 Workspace である。

### 2.1 隣接カテゴリに対する差別化ポジション

`fm-doc-canvas` の立ち位置は、隣接するツール群との違いで表すと明確になる。F6 の設計判断でも、この差別化が失われていないかを確認軸にする。

| 隣接カテゴリ | `fm-doc-canvas` の違い |
| --- | --- |
| 汎用 Chat アプリ | 回答が会話に流れて消えず、可視の Workspace 文脈を人間と AI が共有する |
| Notion 型 Knowledge Base | 保存・分類・再発見ではなく、一時利用と共同思考を正常系にする |
| 手動 Mindmap | 構造を開始条件にせず、AI との共同変形・Relation の結果として構造が生じる |
| 自律 Agent Cockpit | executor / route / tool chain の管理ではなく、人間が判断主体を保つ協働を中心にする |
| 検索・調査ツール | 検索回答で終わらせず、合意・対立・不確実性を作業材料（Context Packet）として机上へ戻す |
| 単体の画像生成ツール | 別入口へ移らず、同じ文脈で生成・比較・評価・再試行できる |

F6 はこの差別化を強化する段階であり、Agent Cockpit 化や workflow builder 化へ寄せる段階ではない。

## 3. research から再確認した利用傾向

`01_research.md` から読み取れる中核傾向は次のとおり。

1. 課題、疑問、素材、断片から気軽に始めたい。
2. LLM 単体の意見ではなく、必要に応じて検索や外部情報で接地したい。
3. 構造化への関心はあるが、開始前に分類、保存先、接続を決めたくない。
4. 約 3 分の 2 の作業は Canvas を保存せず閉じるか、成果物だけ Export して終える。
5. 後で見返す価値がある調査だけ Workspace 状態を明示 Save する。
6. 生成、観測、評価、修正を一つの仕事として進める閉ループに価値を感じる。
7. 管理のための管理、履歴整理、保存判断、再発見コストが増えると継続しにくい。

したがって、未保存終了は失敗ではなく正常終了になり得る。F6 でも、自動保存、履歴蓄積、整理促進を価値の中心に置かない。

## 4. consultant から再確認した設計原則

`02_consultant.md` の原則は、F5 まで進んだ現時点でも有効である。

| 原則 | F6 への含意 |
| --- | --- |
| Workspace を最上位にする | Chat / Task / Agent ではなく共有作業状態を中心にする |
| Task を一時的な Focus として扱う | 固定タスク管理ではなく、現在の問い・注意対象に応じて動く |
| AI を Partner として扱う | 作業代行ではなく、問い返し・批評・比較・調査・変形を担う |
| Context Runtime を共有する | Dialogue / Direct Action / Web / 画像生成 / Relation が別文脈にならない |
| 一時利用を正常系とする | Discard / Export / Save を用途ごとに分ける |
| 成果物と過程を分離する | raw chat や思考過程ではなく採用した Outcome / Relation を残す |
| 構造を共同思考に使う | 保存分類ではなく見方を変えるために Relation / Generated View を使う |
| 自動化を協働の下位能力にする | tool call 数や自律実行量を価値指標にしない |

F6 は `AI Orchestration` ではなく `Collaboration Orchestration` として扱うべきである。主語は Agent Runtime ではなく、Workspace 上の協働である。

## 5. F6 の本質

F6 の本質は、F1〜F5 で作った個別能力を、局面に応じて適切に選び、提案し、実行し、結果を共同材料として Workspace へ戻すことである。

想定する基本流れは次のとおり。

1. 現在の Focus を見る。
2. Visible Working Set を見る。
3. 未解決点、候補、Relation、外部根拠の不足を見る。
4. AI が今取るべき役割を提案する。
5. 必要最小の Action Level を提案する。
6. 対象、期待結果、route、停止点を短く示す。
7. ユーザーが承認、修正、拒否する。
8. 実行結果を Workspace の共同材料として戻す。

F6 の価値は自動化の深さではなく、協働判断の適切さにある。

## 6. F6 で扱う AI Partner の役割候補

F6 では、AI が暗黙に処理を選ぶのではなく、現在の局面でどの役割を担うのかを軽く明示できるとよい。

| 役割 | 例 | 主な実行レベル |
| --- | --- | --- |
| 質問者 | 目的、制約、評価基準の不足を聞く | AL-0 |
| 批評者 | 弱点、反例、抜け、リスクを出す | AL-0 / AL-1 |
| 比較者 | 複数案の違い、評価軸、トレードオフを出す | AL-1 |
| 整理者 | Relation / Cluster / Generated View を提案する | AL-1 / AL-2 |
| 変形者 | 要約、言い換え、Variant、構成案を作る | AL-2 |
| 調査者 | Web や外部情報で根拠、対立、不確実性を集める | AL-2 / AL-3 |
| 専門委譲者 | 大規模・多段階の調査を Specialist subagent に渡す | AL-3 |
| 生成者 | 画像、Artifact、素材案を生成する | AL-2 |
| 実行者 | 明確な対象に対して変更・生成を行う | AL-2 / AL-3 |

例:

> 今は比較者として、選択中の 3 ノードから評価軸と対立点を出すのがよさそうです。

この程度の軽い明示で十分であり、毎回詳細な計画書を出す必要はない。

## 7. F6 MVP の推奨スコープ

F6 の最小 MVP は次でよい。

> 現在の Workspace 状態から、AI が「次の一手」を 1〜3 件提案し、ユーザーが選択・修正・拒否して、既存能力を実行できる。

各提案には、最低限次を含める。

- 役割
- Action Level
- 対象
- 実行 route
- 期待する結果
- なぜ今それが有効か
- 変更・停止・取消の方法

初期検証では、対象能力を広げすぎない。候補は次の 2〜3 系統に絞るのがよい。

1. compare / critique / reframe
2. web research / evidence synthesis
3. generated view / relation proposal

画像生成や Specialist subagent は F6 の後続候補にできるが、初期 MVP の中心にしすぎると route、待機、権限、結果表示の複雑さが大きくなる。

## 8. F6 で避けるべき方向

初期 F6 では、次を避ける。

- 常時監視による自動提案
- 起動直後の自動 Agent 実行
- 汎用 workflow builder
- MCP / provider / model cockpit
- すべての action の自動 chaining
- raw log の保存
- 長期 Agent memory
- 保存済み Workspace の自動推薦
- 複数 Agent の常時並列実行
- 複雑な plan UI
- 毎回の詳細 context confirmation modal

これらは管理作業、監視作業、保存判断、履歴整理を増やす危険がある。

## 9. F6 の Go / Hold / Stop 観点

### Go

- AI の提案した役割が現在の局面に合っている。
- Action Level が過剰ではない。
- Direct Tool / Specialist subagent / 変形 / Generated View の route が妥当である。
- ユーザーが対象、scope、期待結果を理解できる。
- 必要なら route や scope を修正できる。
- 次に何を判断すべきかが明確になる。
- 新しい論点、比較軸、反証、Relation、Variant が増える。
- 外部ツール移動や copy & paste が減る。
- ログ整理、保存判断、確認作業が増えない。
- 「AI に勝手に進められた」ではなく「一緒に考えやすくなった」と感じられる。

### Hold

- 提案は有用だが頻度が多い。
- route / AL の選択がときどき過剰である。
- 理由説明が重い。
- context 確認が儀式化している。
- 結果が長文回答に寄りすぎて Workspace 材料にならない。
- Specialist subagent の待機や中間状態が気になる。

### Stop

- 外部 Chat / 検索 / 既存 Direct Action の方が速い。
- AI 提案の整理・削除作業が増える。
- 何を読まれ、何を変更されるか予測できない。
- 自動化によってユーザーの判断主体感が落ちる。
- route / model / tool 選択が新しい管理作業になる。
- Generated View や Relation が保存分類・掃除作業へ変質する。

## 10. F6 要件分析前の確認論点

F6 の詳細要件を書く前に、次を確認する必要がある。

1. F6 の入口
   - 常時提案ではなく、最初はユーザーが「次に何ができる？」と呼んだときに提案するのが安全と思われる。
2. 提案数
   - 初期値は 1〜3 件が妥当。
3. route 選択の表示粒度
   - ユーザーに executor を選ばせず、AI が推奨 route と短い理由を出す。
4. 結果の戻し先
   - Chat reply を主結果にせず、Candidate Context、Relation Proposal、Generated View、Artifact Draft、Decision Candidate、Evidence Packet、Open Question など Workspace 材料へ戻す。
5. 初期対象能力
   - compare / critique / reframe、web research / evidence synthesis、generated view / relation proposal を優先候補にする。

## 11. 不確実性

次の点は、F6 要件分析または実課題検証で確認が必要である。

- F6 提案の入口を手動呼び出しに限定して十分か。
- AI の「次の一手」提案が、何件を超えると選択負担になるか。
- route / AL の説明粒度はどこまでなら軽く理解できるか。
- Specialist subagent を F6 初期 MVP に含めるべきか、後続候補に分けるべきか。
- 画像生成を F6 初期 MVP に含めると、検証焦点が Collaboration Orchestration から Multimodal Orchestration に寄りすぎないか。
- F6 の結果をどの UI 表現で Workspace 材料へ戻すのが最も自然か。
- 既存 F1〜F5 の実装状態が、F6 の orchestration に必要な role / AL / target / route / provenance / undo 情報を十分に露出しているか。

## 12. 現時点の推奨

F6 は、まず次の仮説として要件化するのがよい。

> 現在の Focus、Visible Working Set、未解決点、既存 Relation / Generated View / Context Packet をもとに、AI Partner が役割・Action Level・対象・route・期待結果を含む「次の一手」を少数提案し、人間が軽く修正・拒否・実行できる。実行結果は長文回答ではなく Workspace 上の共同材料として戻る。

この仮説であれば、research / consultant / roadmap の思想を保ったまま、F5 までの成果を統合できる。
