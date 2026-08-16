# Review Notes — fm-doc-canvas GUI Update (2026-08-16)

## Review Findings

### Code-grounded corrections

1. Core E2E は Vitest ではなく Wails + Playwright で、正規コマンドは `mise run e2e`。
2. `dissolveSubCanvas` は FolderNode が Relation endpoint のとき拒否し、member 座標も親座標へ変換しないため、「GUIを接続するだけ」では安全解体を満たさない。
3. Chat は `CancelChat` を持つが、Direct Text / Image API は cancel contract を持たない。
4. Chat input は local state / Enter送信、Direct input は App Store / Ctrl+Enter送信であり、共通 state と keyboard contract が必要。
5. `moveNodes` は利用できるが、移動後の selection / focus と配置を自動整理しない。

## Adopted Decisions

- i18n は REQ-01 の意味を保ったまま active scope から defer。全 UI 文言を対象とする後続 Full Plan へ分離する。
- 任意 Canvas picker（旧 REQ-11）は実装しない。課題を直接解く `親 Canvasへ移動`（REQ-14）を採用する。
- Safe dissolve は domain command を拡張し、member layout / member Relations を保持する。
- FolderNode 自身の Relation は移し先の意味が一意でないため自動付替えしない。件数を明示して確認後に削除する。
- Chat / Direct は Canvas別共通 draft と single-operation state を使用する。
- Chat は停止可能、Direct は停止不可。Direct は freshness guard により遅延結果を破棄する。
- ContextPreview は badge-only とし、個別 exclusion 機能を廃止する。

## Fixed Plan Items

- [x] REQ-13 を `mise run build` / `mise run test` / `mise run e2e` に修正。
- [x] REQ-12 に Folder Relation、member Relation、配置、atomic Undo を追加。
- [x] REQ-14 として親階層への引き上げを追加。
- [x] REQ-15 として Assistant lifecycle / stale result を追加。
- [x] REQ-N01/N02 を active acceptance table に統合。
- [x] Chat / Direct action matrix、draft authority、keyboard、result surface を仕様化。
- [x] `MoveToCanvasDialog` と部分 i18n を対象ファイルから除外。

## Deferred / Superseded

| ID / item | Disposition | Reconsideration condition |
| --- | --- | --- |
| REQ-01 全UI i18n | 後続 Full Plan 候補 | 全表示文言、tooltip、dialog、error、backend error mapping を一括棚卸しできるとき |
| REQ-11 任意 Canvas picker | 将来候補 | 親への引き上げ以外の cross-branch 移動需要が確認されたとき |
| Direct cancel | 将来候補 | backend API に run ID / cancel contract を追加する計画を組むとき |
| SubCanvas drag and drop | 将来候補 | parent lift / dissolve の利用実績後 |

## Rejected Options

- PromptBar の折りたたみ維持: 入力二重構造が残る。
- Direct に見かけだけの Stop button を置く: backend 処理を止められず誤解を招く。
- Folder Relation を無言で削除: safe delete の条件に反する。
- Folder Relation を任意 member へ自動付替え: Relation の意味を推測してしまう。
- 部分 i18n: 全 UI 文言対象という要求を満たさず、二重管理を増やす。
- 自動的に親 Canvas へ navigation: 複数 node を順に引き上げる作業を中断する。代わりに toast action を出す。

## Current Non-Goals

- EditorDrawer redesign
- JSON schema migration
- New external dependency
- Backend Direct cancellation

## Documentation Feedback

実装・受入後に、確定した Assistant mode behavior と SubCanvas dissolve invariant を `docs/requirement.md` / `docs/specification.md` へ反映する。

## Amend History

- 2026-08-16: 初版。
- 2026-08-16: ユーザーレビューを受け、i18n分離、任意移動の親引き上げ化、relation-aware dissolve、実E2E、Unified Assistant state machine を反映。
