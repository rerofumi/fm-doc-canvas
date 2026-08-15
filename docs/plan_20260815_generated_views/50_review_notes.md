# Review Notes

## Review Findings

### R-01: Direct Action の「request-as-approval」をどこまで適用するか

F2 / D-05 では、明示 Direct Action は request 自体を承認として扱い、Transform では即時 Node 作成 + undo とした。しかし Relation と Cluster View は意味構造の確定を伴うため、D-08（Relation は人間が作成または AI Proposal を採用した時だけ確定）と衝突し得る。

**Resolution**: Direct Action の承認対象は「提案の生成」までとする。`SuggestRelations` / `SuggestClusters` は Agent loop / Dialogue 履歴を作らないが、出力は必ず Proposal card に表示し、Relation / View の確定には人間の Accept を要する。F2 Direct Transform（内容生成の即時適用）とは区別する。

### R-02: Generated View を document に保存するか

View を `WorkspaceDocument` へ保存すると V1.4 bump と migration が発生し、D-08 の「一時的な仮配置」とも緊張する。

**Resolution**: core では View を runtime-only（Zustand store）に保持し、Save file に含めない。永続化したい構造は Cluster → SubCanvas 変換（既存 V1.3 `createSubCanvas`）で表現する。View の永続化は後続候補。

### R-03: Cluster の可視化方法

候補: (a) SVG overlay（Panel + viewport 変換）、(b) React Flow への pseudo node inject、(c) 別パネルのリスト表示のみ。

**Resolution**: (b) を第一候補とする。`selectable / draggable / connectable = false` の hull pseudo node を projection へ混ぜ、member bounding box + padding で描画する。document node や command には触れない。実装前に WP-0/WP-1 spike で `@xyflow/react@^12` の挙動（z 順、pan/zoom 追従）を確認し、問題があれば (a) へ切り替える。(c) だけでは「別の見方」として弱いため採用しない。

### R-04: Relation batch を個別 Proposal に分割するか

1 件ずつ ProposalRecord を作ると Accept all で N 個の history entry / N 回の undo になり、「一括で見て一括で戻す」体験と衝突する。

**Resolution**: 新しい Proposal kind `add-relation-batch` と新 command `addRelations` を作り、Accept（選択 subset）を単一 transaction / 単一 undo とする。項目除外は modify として扱う。pairwise `add-relation` Proposal は既存どおり維持する。

### R-05: Cluster View の対象に Folder Node / Image Node を含めるか

Folder Node は SubCanvas の入口であり、cluster member にすると所有境界と表示が混乱する。Image Node は F4 で Relation endpoint として認められている。

**Resolution**: Folder Node は member にしない（validation で拒否）。Text-bearing と Image Node は member になり得る。Image の本文は LLM へ送らず、metadata のみ（F4 の Vision allowlist に該当しない限り）。

### R-06: viewHints を Context に含める範囲

View 全体を無条件に送ると、request と無関係な hint が増え、context 肥大と誤推論の元になる。

**Resolution**: `viewHints` は active View に属し、かつ今回の request の active context に含まれる Node に関係する cluster のみ出力する。hint には「暫定グループであり確定 Relation ではない」旨の注記を付ける。意味の自動確定には使わない（F2 spatialHints と同格）。

### R-07: Cluster → SubCanvas 変換後の View の扱い

変換後に View と SubCanvas が二重に同じまとまりを表示すると混乱する。

**Resolution**: 変換した cluster は active View から除去する。最後の cluster を変換したら View を閉じる。View を閉じても作成済み SubCanvas は残る（document 側の確定構造）。

### R-08: Gate は項目別に判定する

ロードマップ F-5B は Relation suggestion / Generated View / Layout suggestion を独立判定とする。core に Layout suggestion を入れると判定が混ざる。

**Resolution**: core slice は Relation batch と Cluster View（+ SubCanvas 変換）のみ。Layout suggestion と Library View は後続候補として残し、REQ-17 の E4 で (a) Relation batch と (b) Cluster View を独立に Go / Hold / Stop 判定する。

### R-09: SubCanvas 変換の undo 範囲

既存 `createSubCanvas` の history は Workspace document を復元できるが、変換後に別途削除した runtime-only cluster は復元できない。これでは「Cluster → SubCanvas 変換」全体が一操作として可逆にならない。

**Resolution**: 既存 command を document mutation に再利用しつつ、変換前 `activeGeneratedView` snapshot を同じ composite history entry に含める。undo / redo は document と View を同時に復元する。

### R-10: Cluster proposal の revision stale guard

workspace / canvas / scope correlation と Node 存在確認だけでは、Direct request 中に本文が更新された場合に古い内容由来のclusterをAcceptできる。

**Resolution**: Relation batch / Cluster View の両方で対象全Nodeの `sourceRevisions` を保持し、Direct結果到着時とProposal Accept / 変換時にkey setとrevision一致を検証する。不一致は全体no-opにする。

### R-11: Image Node の入力契約

対象にImage Nodeを含める一方、Text-only `GenerateText` patternだけでは画像内容を見た提案にならず、provider capability差も扱えない。

**Resolution**: F4 Vision allowlist / multimodal message pathを再利用し、最大3画像・明示選択優先とする。Vision非対応またはasset取得失敗はalt / prompt / provenanceのmetadata-onlyへ縮退し、proposal previewに入力modeを表示する。

### R-12: frontend test discovery

現行frontend domain testは単一entry buildであり、新規test fileを置くだけでは `mise run test` に含まれない。

**Resolution**: F5 testを既存entryからimportするか専用config / scriptへ登録し、標準出力でF5 test実行を確認する作業をWP-5とREQ-16へ追加する。

### R-13: Stop と accepted View の寿命

Stopによる遅着Proposalの無効化は必要だが、既にAcceptしたViewまで破棄すると、停止と明示Closeの意味が混ざる。

**Resolution**: Stopはin-flight request / 未確定Proposalだけをcancel / staleにする。accepted Viewは維持し、New / Load / Discard / navigation / 明示Closeで破棄する。

## Fixed Decisions

| Decision | Adopted choice | Reason |
| --- | --- | --- |
| Direct suggestion の承認範囲 | 提案生成まで。適用は人間の Accept 必須 | D-08 の確定規則と整合 |
| View の永続化 | runtime-only、Save 対象外 | V1.3 不変、D-08 の一時性 |
| Batch Relation 適用 | 新 command `addRelations`、単一 undo | 一括採否・一括取消の体験 |
| overlay 実装 | pseudo node（spike 結果次第で SVG overlay） | 既存 projection を最小拡張 |
| Folder の member 化 | 禁止 | SubCanvas 境界との混同を防ぐ |
| pairwise propose_relation | 維持 | 単発提案は既存経路で十分 |
| Library View / auto-layout | 対象外 | 独立判定の roadmap 方針 |
| SubCanvas変換 undo | document + active Viewのcomposite history | 変換全体を1操作として可逆にする |
| Image入力 | F4 Vision allowlist + metadata fallback | Text / Image scopeを実装可能な契約へ揃える |
| Stop | request / 未確定Proposalのみ無効化 | accepted Viewの所有を人間に残す |
| View-local共同編集 | rename / 既存cluster間移動 / 除外 / 削除の部分実装 | 現コードベース中心でcoreを小さく保つ |

## Deferred Items

- Library View（評価軸の Generated View）。
- Layout suggestion / auto-layout / cluster 内再配置。
- View の Save / Load 永続化、複数 View 同時保持、View 履歴。
- batch relation 項目の行内編集（kind / direction / reason 変更）。
- 新規 cluster 作成、cluster split / merge、ungrouped Node の手動追加（View-local共同編集はrename / 既存cluster間移動 / 除外 / 削除の部分実装）。

## Rejected Options

| Option | Reason |
| --- | --- |
| Direct Action で Relation を即時確定（F2 Transform と同じ request-as-approval 適用） | D-08 に反する。意味構造の確定は人間の採否を要する |
| Generated View を V1.4 で document 永続化 | core 検証前に migration コストを負う。SubCanvas 変換で十分 |
| 位置クラスタリング（k-means 等）で自動 cluster 生成 | position は観測情報であり意味の根拠にしない（D-02 / F2 方針） |
| Cluster を常に SubCanvas として作成 | D-08 が禁止する自動確定・恒久分類化に該当 |
| 新 npm グラフ可視化ライブラリ導入 | NFR-01 違反、既存 React Flow で実現可能 |

## Current Non-Goals

- MCP / Specialist subagent / Repository 調査。
- 自動 Accept、常時監視による自動提案発話。
- telemetry、件数目標、保存率指標。

## Future Plans

- REQ-17 E4 で Go の場合: Library View と Layout suggestion を後続 plan で独立判定する。
- View の再利用需要が確認された場合のみ永続化を検討する。

## Next Plan Candidates

- `generated_views_library`（Library View）
- `generated_views_layout`（Layout suggestion）
- `specialist_agent_bridge`（ロードマップ F-3C、既存の将来候補）

## Documentation Feedback

- 受理後、`05_roadmap.md` F-5B 節に個別 plan リンクと判定状態を反映する。
- `08_glossary.md` に `viewHints` / `Relation batch` の用語を追加要否を受入時に確認する（Generated View / Cluster View / Library View は既に存在）。
- current docs（specification.md 等）へは、受理済み挙動のみ受入後に反映する。
