# GUI 改善方針（改訂版）

この文書は、[`00_gui_update_20260816a.md`](./00_gui_update_20260816a.md) の要望を実装可能な単位へ整理した概要である。正式な要件と実装仕様は `30_requirement.md` と `40_specification.md` を正とする。

## 採用する方向性

### 1. Canvas-First

- 画面下部の常設 `PromptBar` を撤去し、キャンバスをウィンドウ下端まで広げる。
- Chat と Direct の入力は右側の AI アシスタントドロワーへ統合する。
- ヘッダーから重複操作と危険操作を減らし、主要操作の意味を Icon + Text で示す。

### 2. Unified Assistant

- AI ドロワーに `Chat` / `Direct` タブを設け、Canvas ごとの共通 draft を使用する。
- Chat は会話セッション、Direct は即時 Text / Image 生成として、同じ入力欄から明確にモードを切り替える。
- `次の一手` と `Web検索` は両タブに置くが、結果の表示先と入力コンテキストはタブごとに定義する。
- Chat は既存 `CancelChat` により停止可能。Direct は既存 API にキャンセル機構がないため、この計画では停止ボタンを表示せず、処理中表示・多重実行防止・stale result 破棄を行う。

### 3. SubCanvas の「戻れない」を解消

- 任意 Canvas 選択ダイアログは作らない。
- SubCanvas 内で選択したノードを `親 Canvas へ移動` できるようにする。
- SubCanvas 削除時は全メンバーを親 Canvas へ引き上げ、レイアウトを保ったまま FolderNode 付近へ再配置する。
- FolderNode 自身に Relation がある場合は、削除される Relation 数を確認ダイアログに明示し、確認後に Folder Relation のみを原子的に削除する。メンバーノードを端点とする Relation は保持する。
- Undo は、ノード位置・FolderNode・Canvas・Relation をまとめて復元する。

### 4. ContextPreview の縮小

- 展開リストと個別除外チェックボックスを廃止する。
- 実際に送信対象となる Text / Image 件数だけを非操作バッジで表示する。
- 既存の `excludedNodeIds` は廃止導線としてクリアし、再選択したノードが再びコンテキストへ入らない状態を残さない。

### 5. i18n は別計画へ分離

全 UI 文言を対象としない部分的な i18n は行わない。本計画では i18n 基盤を導入せず、全コンポーネント・ダイアログ・ツールチップ・エラー文言を一括移行する後続 Full Plan とする。

## 実装パッケージ

1. `WP-1`: ヘッダー・パンくず・Canvas 領域整理
2. `WP-2`: SubCanvas リネーム、親への引き上げ、安全解体
3. `WP-3`: Chat / Direct 統合ドロワーと共通状態機械
4. `WP-4`: Context バッジ簡素化
5. `WP-5`: Unit / logic test、Build、Playwright Core E2E、手動 UX 受入

## 正式文書

- Claim: [`10_claim.md`](./10_claim.md)
- App Requirements: [`20_app_requirement.md`](./20_app_requirement.md)
- Requirements: [`30_requirement.md`](./30_requirement.md)
- Specification: [`40_specification.md`](./40_specification.md)
- Review Notes: [`50_review_notes.md`](./50_review_notes.md)
- Status: [`90_status.md`](./90_status.md)
