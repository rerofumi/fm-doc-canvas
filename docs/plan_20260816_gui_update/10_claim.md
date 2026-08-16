# Claim — fm-doc-canvas GUI Update (2026-08-16)

## Purpose

`fm-doc-canvas` の既存機能を保ちながら、キャンバスを中心に作業できる画面構成へ整理し、AI 操作の二重入力、SubCanvas から戻せない操作、壊れやすい ContextPreview、区別できない会話セッションを解消する。

## Background

Chat、Artifact、Transform、Web Context、画像、Generated View、Collaboration Orchestration の追加により機能は充実した一方、操作入口がヘッダー、画面下部、右ドロワーへ分散した。現在は次の問題がある。

1. 下部 `PromptBar` がキャンバス領域を常時圧迫する。
2. Chat と Direct に別々の入力欄があり、入力先と結果表示先が分かりにくい。
3. ヘッダーに危険操作・重複操作・アイコンのみの操作が混在する。
4. SubCanvas へ入れたノードを Undo 以外で親へ戻せず、SubCanvas 自体も安全に解体できない。
5. ContextPreview の個別除外が状態不整合を起こし、利用価値に対して複雑である。
6. 会話タイトルが固定名のままで複数セッションを識別できない。

## Adopted Direction

- **Canvas-First**: `PromptBar` を撤去し、キャンバスを主領域とする。
- **Unified Assistant**: Chat / Direct を右ドロワーへ統合し、Canvas ごとの共通 draft と明示的なモード別実行を持つ。
- **Parent Lift**: 任意 Canvas 移動ではなく、SubCanvas から親 Canvas へ戻す操作を第一級の導線とする。
- **Safe Dissolve**: SubCanvas メンバー、メンバーを端点とする Relation、相対レイアウトを保持して解体する。FolderNode 自身の Relation は確認付きで除去する。
- **Context Summary Only**: ContextPreview は件数バッジだけに縮小し、個別除外を廃止する。

## Scope

### In Scope

- ヘッダーとパンくずの整理
- `PromptBar` の撤去
- Chat / Direct 統合ドロワー、共通 draft、モード別アクション、処理中状態
- Image Provider の Chat / Direct 共通利用
- 初回ユーザーメッセージによる会話タイトル自動設定
- ContextPreview の件数バッジ化と既存除外状態の解消
- SubCanvas リネーム
- 選択ノードの親 Canvas への引き上げ
- Relation と配置を考慮した SubCanvas の安全解体
- Unit / logic test、Build、Playwright Core E2E、手動 UX 検証

### Out of Scope

- 全 UI 文言の i18n。部分導入はせず、後続 Full Plan で一括実施する。
- 任意 Canvas を選択する汎用移動ダイアログ。
- Direct Text / Image API のバックエンドキャンセル機構追加。
- EditorDrawer のレイアウト変更。
- 保存 JSON スキーマの変更。

## Code-Grounded Facts

- Chat は `SendChat` / `CancelChat` と run correlation を持ち、停止可能である。
- Direct Text / Image は Promise 完了待ちで、既存 API にキャンセル契約がない。
- `moveNodes` は利用できるが、移動後の座標・selection・focus の整理は呼び出し側仕様が必要である。
- `dissolveSubCanvas` は FolderNode が Relation endpoint の場合に拒否し、子ノード座標をそのまま親へ移すため、コマンド拡張が必要である。
- Core E2E は Vitest ではなく Wails + Playwright であり、`mise run e2e` が正規コマンドである。

## Uncertainties / Risks

- Direct の実処理はキャンセルできないため、Canvas 遷移後の遅延結果を適用しない freshness guard が必要。
- SubCanvas 解体時の配置は親 Canvas 上の既存ノードとの衝突を完全には避けられない可能性があるため、決定的なグループ配置アルゴリズムと手動受入を組み合わせる。
- 既存 Playwright セレクタのうち `PromptBar` 前提のものは統合ドロワーへ更新が必要。

## Next Documents

- `20_app_requirement.md`: UX と MVP
- `30_requirement.md`: 受入可能な REQ
- `40_specification.md`: 状態機械、SubCanvas コマンド、テスト仕様
- `50_review_notes.md`: 改訂判断と deferred 項目
- `60_review_packet.md`: 実装前レビュー
- `90_status.md`: 実装・受入状態
- `91_worklog.md`: 改訂履歴
