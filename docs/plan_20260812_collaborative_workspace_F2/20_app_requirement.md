# App Requirements

## Purpose

Canvas 上の素材を「AI が別の文章を返す」だけで終わらせず、元の考えを残したまま比較・要約・反証を次の Node と Relation に変換し、人間が採用したものだけを Workspace の共同記憶にする。

## Target Environment

- F1 と同じ単体 Wails desktop app。
- 外部 Web 検索、MCP、Specialist subagent、画像生成は F2 の入力経路にしない。
- LLM 通信は既存の設定・Agent runtime を使い、Core E2E は credentials / network なしの fake provider を使う。

## User Experience

1. ユーザーは Current Canvas で一つ以上の Text-bearing Node を選ぶ。
2. Dialogue / Agent から依頼する場合は、入力 Node、operation、対象 Canvas、Relation target を解決して Proposal を返す。AI は元 Node を直接上書きしない。
3. Canvas の明示 Direct Action から依頼する場合は、その操作自体を承認として扱い、Dialogue や追加の承認 Proposal を生成せず、検証済み結果を atomic apply する。
4. Dialogue / Agent の Proposal UI は入力、operation、source と output の比較、生成物の本文 preview、出力 role / placement、Relation kind / direction / reason、provenance、base revision を示す。
5. Proposal 経路では Accept、Modify、Reject、Stop を選べる。Direct Action 経路では適用後の change summary / source-output diff と undo を示す。どちらも元 Node は変更しない。
6. Accept / Direct Action 完了後の Node、Relation、人間が変更した Current Canvas の Node 配置は次の Context preview に現れる。配置は spatial hint であり、Relation や意味として自動確定しない。
7. Relation は edge として意味が分かる形で表示し、選択時に型・方向・理由・由来を確認できる。自動で全 Canvas を再配置しない。

## MVP Features

| Feature | MVP behavior |
| --- | --- |
| Non-destructive transform | `summarize`（1+ Node）、`compare`（2+ Node）、`counterpoint`（1+ Node）を派生 Text Node として作成 |
| Typed Relation | `source`、`derived`、`supports`、`opposes`、`similar` を accepted Relation として保存 |
| Human control | AI Proposal の preview / accept / modify / reject / Stop / undo |
| Context continuity | accepted 派生と Relation を次の Dialogue / Direct Action の shared resolver に反映 |
| Human spatial feedback | 人間が変更した Current Canvas 内の配置を次の request の明示 spatial hint として反映し、意味を自動確定しない |
| Entry separation | Dialogue / Agent は Proposal、明示 Direct Action は request-as-approval + post-apply diff / undo |
| F2 value gate | 実課題の E4 review で discovery、共同修正、追跡可能性、cleanup burden を判定 |
| Safe concurrency | source revision、Workspace generation、scope / run epoch を確認し、遅着 Proposal を適用しない |
| Persistence | F1 V1.3 を読み書きし、派生・provenance・accepted Relation を保持 |

## Future Candidates

- `extract / split / merge` の複数派生、variant、text-to-card / card-to-text。
- `reframe` と、より自由度の高い変形 instruction。
- Relation の仮説グラフから Generated View / Cluster View を作る。
- Web / Repository Context を Relation / Candidate Context として接続する。
- Image Node を入力・出力に含める multimodal transform。

## Initial Non-Goals

- 元 Node の AI 自動上書き、自動 Accept、自動 Relation 確定。
- 全 Canvas の自動 layout、恒久的な folder / tag / knowledge base 化。
- 外部検索、MCP、Specialist subagent、Saved Workspace Recall。
- Relation を根拠の真偽として保証すること。Relation は作業仮説・由来付きの共同編集結果である。
- F2 の Core E2E に実 API key、外部ネットワーク、実 provider の品質判定を持ち込むこと。
