# Review Notes

## Review Findings

### R-01: ロードマップ F-4B 後半を混ぜると Gate が崩れる

確認付き再生成、AL-3、`fm-image-assistant` を同じ slice に入れると、共同評価の価値と自律反復の価値を分けて判定できない。ユーザーは F-4A + Vision Context までを指定した。

**Resolution**: core は既存生成器への Dialogue 導線、Image Variant、Vision、差分共有まで。再生成ループは後続候補。

### R-02: PromptBar を Dialogue に吸収すると Direct Action が壊れる

D-05 は Dialogue と Direct Action の併存を採用済み。画像生成 prompt をそのまま実行したい用途が Direct Action の主ユースケースである。

**Resolution**: PromptBar Image は残す。Dialogue への自動昇格、専用 handoff は作らない。共有するのは allowlist、Variant、provenance、undo だけ。

### R-03: F1 は Dialogue の pixel 送信を禁止している

F1 REQ-09 / spec §12.4 は Dialogue Agent へ `image-binary` を許可しない。Vision Context を入れるには明示上書きが必要。

**Resolution**: この plan の明示選択 allowlist に限り解除する。除外・未選択・cap 超過は metadata only のまま。current docs への反映は受入後。

### R-04: 生成と配置を同時 commit すると preview できない

画像生成は時間がかかる。成功と同時に Node を増やすと、見ずに机が汚れる。

**Resolution**: Dialogue は generate-then-place。Direct Action だけ即時配置。物理ファイルが先に書けても document には載せない。

### R-05: 新しい画像 API は不要

`ImageGenService`、PromptBar、`GenerateTextWithImages`、`FixtureImage` が既にある。足りないのは契約接続と E2E 配線。

**Resolution**: 新規 provider / SDK なし。E2E の `imageGenService = nil` を直すのが WP-0。

### R-06: Vision + tool-calling の実 provider 品質は未確認

Chat Completions は user `image_url` + `tools` を公式に許す。現行 agent loop は string content のみ。実 VLM の同時利用は未実施。

**Resolution**: 契約は既存 Chat Completions に載せる。実画質は Conditional。Core E2E は fake で添付数と no auto-regen を固定する。

### R-07: Gate F-4 は機能テストだけでは受理できない

文脈再入力が減ったか、Direct Action が遅くなったかは E1 では判定できない。

**Resolution**: REQ-16 を F2 REQ-18 / F3 REQ-17 と同様の task-based E4 とする。

## Fixed Decisions

| Decision | Adopted choice | Reason |
| --- | --- | --- |
| Plan tier | Full | Agent tool、Vision 契約、UI、persistence、E2E に広い影響 |
| E2E | Core E2E in scope | F1〜F3 harness があり、生成 / 配置 / Vision は binding を通す価値が高い |
| Worklog | enabled | 同一計画群の意思決定を追跡する |
| Scope | F-4A + Vision Context | ユーザー指定。再生成ループは対象外 |
| Image backend | 既存 ImagePort | 新サービス不要 |
| Dialogue mutation | Proposal after generate | 未確認画像で机を汚さない |
| Direct Action | request-as-approval | D-05 |
| Vision | 明示 allowlist 最大 3 | F1 制限の局所解除 |
| Provider UI | Dialogue は既定のみ | DC-09 |
| Persistence | V1.3 optional provenance | migration を壊さない |
| Value Gate | REQ-16 E4 | 機能成立と CW-3B の価値を分離する |

## Deferred Items

- 確認付き自動再生成。
- AL-3、`fm-image-assistant`。
- Dialogue の request-level Image Provider 切替。
- 物理ファイル GC。
- 実 VLM 画質。Core E2E は fake。
- Image を Web Context / Generated View の入力にすること。

## Rejected Options

- この plan で F-4B 全部を実装する: Gate が混ざる。
- PromptBar を廃止して Dialogue だけにする: Direct Action を損なう。
- 生成成功と同時に Node 化する: 掃除負担。
- Responses API へ移行する: 既存 agent loop と F3 契約を壊す。
- 新しい Image Provider / SDK: 不要。
- Dialogue 操作ごとの provider 選択、失敗時 failover: DC-09。
- Light plan: Vision 契約と Agent / E2E 変更があるため不足。

## Current Non-Goals

- 複数ユーザー、Saved Workspace Recall、Generated View。
- 動画、mask UI、telemetry、性能 SLO。

## Future Plans

- 確認付き再生成は、差分共有だけでは反復が足りない実例が出たとき。
- `fm-image-assistant` は AL-3 需要が確認されたとき。
- F-5B は画像材料を構造生成へ広げる任意枝。

## Next Plan Candidates

- 確認付き再生成 / AL-3 multimodal follow-up
- `specialist_agent_bridge`（F-3C、本 plan の範囲外）
- `generated_views`（F-5B）

## Documentation Feedback

実装・受入後に current `docs/requirement.md` / `docs/specification.md` / cheatsheet へ反映する項目:

- Dialogue Vision allowlist と F1 metadata-only の上書き範囲
- `generate_image` tool と Image Variant / `origin=image`
- PromptBar Image は Direct Action のまま
- Core E2E に F4-01〜05
- E2E composition の ImagePort 配線

## Amend History

| Date | Change |
| --- | --- |
| 2026-08-13 | Full 新規 plan `plan_20260813_multimodal_context` を作成。F4 core = F-4A + Vision Context。再生成ループは対象外 |
