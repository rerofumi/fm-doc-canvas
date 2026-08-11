# Review Notes

## Review Findings

### R-01: F2 の候補列は大きすぎる

ロードマップの F-2A には extract / split / merge、compare / summarize、reframe / counterpoint、variant / text-to-card / card-to-text が列挙されている。一度に全てを実装すると、単一出力と複数出力、Text / Artifact role、Relation discovery、UI の差分が混ざり Gate 判定ができない。

**Resolution**: この plan の受理対象は `summarize` / `compare` / `counterpoint` の一つの派生出力と型付き Relation に絞る。split / merge 等は F2 core の実利用結果を受けた後続 plan 候補とする。

### R-02: Relation は F1 にも存在する

F1 は `context` Relation を accepted record として保存し、React Flow edge と Context Resolver に投影した。F2 は Relation storage を作り直すのではなく、型、reason、Proposal lifecycle、由来、共同編集 UI を拡張する。

**Resolution**: `context` は互換のため残し、F2 UI の初期型は `source` / `derived` / `supports` / `opposes` / `similar`。Proposal status は document record と分離し、未採用候補を persisted Relation にしない。

### R-03: 生成と Relation の partial apply

派生 Node を作成してから Relation が失敗すると、由来のない生成物が残る。逆に Relation だけを先に作ると存在しない endpoint になる。

**Resolution**: `applyTransform` を一つの command transaction / history entry とし、document validate が成功した時だけ commit する。fault injection と E2E で partial mutation がないことを確認する。

### R-04: Gate F-2 が機能テストだけでは受理できない

ロードマップの Gate は discovery、共同修正、追跡可能性、cleanup burden という体験価値を要求する。操作成立の E1 と一般的な UI review だけでは判定できない。

**Resolution**: `REQ-18` を追加し、別受入 session / human が代表的な実課題で E4 evidence と Go / Hold / Stop を記録する。telemetry、採用率目標、終了アンケートは追加しない。

### R-05: 人間の配置が Context へ戻っていない

Relation は resolver に戻るが、ロードマップが共同編集入力とする人間の配置変更が未定義だった。

**Resolution**: `REQ-15` と `spatialHints` を追加する。Current Canvas の selected / active Node ID と position だけを明示 hint として返し、位置だけから Relation、group、priority、causality を推論・確定しない。

### R-06: Dialogue と Direct Action の承認境界

全 transform を事前 Proposal にすると、Direct Action の「依頼そのものが承認」「一発操作」という採用済み境界を失い、確認負担を増やす。

**Resolution**: `REQ-16` を追加する。Dialogue / Agent は Proposal + decision、明示 Direct Action は request-as-approval + atomic apply + post-apply diff / undo とする。scope、provenance、stale guard は共有するが、問い返し、追加 Agent round、Dialogue append は共有しない。

### R-07: preview / diff の片側だけが定義されている

出力 preview はあるが、source と output の比較方法がなく、Modify と誤変形訂正の判断材料が不足していた。

**Resolution**: `REQ-17` を追加する。Dialogue / Agent は apply 前 comparison、Direct Action は apply 後 change summary / source-output diff を提供する。

### R-08: F2 core とロードマップ F-2 closure の混同

core slice の受理だけで F-2 全体を完了扱いすると、`extract / split / merge / reframe / variant / card conversion` が追跡不能になる。

**Resolution**: この plan の `done` は F2 core slice のみを表す。ロードマップ F-2 milestone は後続候補ごとの disposition が揃うまで open とし、Go のときだけでなく Hold / Stop のときも理由と再検討条件を残す。

## Fixed Decisions

| Decision | Adopted choice | Reason |
| --- | --- | --- |
| Plan tier | Full | domain model、Agent contract、UI、persistence、E2E に広く影響 |
| E2E | Core E2E in scope | F1 harness が Go 済みで、Proposal と scope は browser→Wails binding を通す価値が高い |
| Worklog | enabled | F1 と同じ計画群の意思決定を追跡する |
| Transform input | Text-bearing only | F4 multimodal と分離し、F2 Gate を検証可能にする |
| Proposal transport | structured tool / DTO | 自由文 parser より revision / scope / receipt を検証できる |
| Persistence | V1.3 compatible optional extension | F1 migration contract を壊さず F2 の reason / provenance を保持 |
| Apply boundary | derived node + derived Relation atomic | partial output と undo の不整合を防ぐ |
| Entry approval | Dialogue / Agent は Proposal、Direct Action は request-as-approval | 探索経路と一発操作の役割を維持する |
| Spatial feedback | Current Canvas の explicit position hint | 人間の配置を次の入力へ戻しつつ意味を自動確定しない |
| Comparison | Proposal pre-apply / Direct Action post-apply | preview / diff と Direct Action の低摩擦を両立する |
| Value Gate | REQ-18 の task-based E4 review | 機能成立と CW-2 の価値を分離して受理する |

## Deferred Items

- `extract / split / merge`: 複数出力・統合時の provenance / atomicity を F2 core 実利用後に再設計する。
- `reframe / variant`: ロードマップの最小検証候補として次の transform slice で必ず採用・延期・棄却を判定する。
- `text-to-card / card-to-text`: D-12 の role / capability 境界を維持できる導線を別途設計する。
- Relation の高密度グラフ表示、Generated View、Cluster / Library。
- Relation reason の編集履歴、confidence score、external evidence。
- V1.4 file version。optional extension で足りないことが fixture / consumer review で判明した場合だけ amend。
- 実 provider ごとの structured output / tool-call compatibility の追加調査。Core E2E は fake provider と既存 contract を使う。

## Rejected Options

- **AI が直接本文を書き換える**: 元状態・比較・undo の意味を失い、CW-2 と F1 human ownership に反する。
- **LLM の自由文を JSON parser で後処理する**: provider ごとの出力揺れと partial parse が revision / Relation atomicity を壊す。
- **Relation を単なる React Flow edge として扱う**: reason / provenance / Context への反映を失う。
- **全ての候補 Relation を自動 accepted にする**: AI の仮説と人間の判断を混同する。
- **F2 で外部 Web 検索を同時に始める**: CW-2 の素材変形の価値と CW-3 の接地価値を分離できない。

## Current Non-Goals

- 外部 Context、MCP、Specialist subagent、Saved Workspace Recall。
- Image Node の本文変形、画像生成の Agent 化。
- automatic layout、folder / tag 自動分類、multi-user collaboration。
- Core E2E での real LLM / network / credentials。

## Future Plans

- F2 core Gate の結果にかかわらず、`collaborative_transform_advanced` 候補で extract / split / merge / reframe / variant / card conversion の disposition を記録する。Go なら次 slice、Hold なら摩擦の修正後、Stop なら非採用理由と再検討条件を残す。
- Relation の実利用で高密度・再発見の課題が出たら `generated_views` を検討。
- 外部情報の転記が主要 friction と確認できた場合のみ `web_context` を立案。

## Documentation Feedback

Acceptance 後、確認済みの transform / Relation / V1.3 extension / Context 反映挙動だけを `docs/` current docs と必要な cheatsheet へ反映する。Proposal の候補、Rejected options、未確認の provider 挙動は plan に残す。

## Amend History

- 2026-08-12: F2 を新規 Full plan として作成。F1 の完了・Gate F-2・baseline test を根拠に、core slice を定義。
- 2026-08-12: ロードマップ突合レビューを反映。REQ-15〜18、F2-05、NFR acceptance rows、F2 core / milestone closure 境界を追加。
