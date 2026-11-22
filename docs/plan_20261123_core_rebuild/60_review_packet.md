# Review Packet — plan_20261123_core_rebuild (r1)

## 1. 概要：何が変わるか（利用者視点）

2026年8月の改変（ChatDrawer / Artifact / AI パートナー自律レベル / Proposal / Cluster View / Web 検索等）を一旦破棄し、**`v0.4.2` までに確立していた「キャンバス上にノードを置いて質問し、画像を生成・確保する」基本機能と 4 つの画像生成プロバイダー連携**を、ゼロベースのクリーンな新規ソースコードとして再構築します。

- **復活させる基本機能**:
  - 広いキャンバス上でのメモ配置・有向連結（ループ防止）・上流コンテキスト自動追跡・Dagre 自動整頓・広域ズーム（`0.1`〜`4.0`）・確認付き Clear Canvas。
  - LLM テキスト生成（OpenAI 互換 `/chat/completions`、System Prompt、Vision 画像入力、自動サマリー、カード下の元質問プロンプト表示＆クリック追記）。
  - 4 プロバイダー画像生成（**OpenRouter / OpenAI [Images & Responses 最大5枚] / Google Gemini / xAI [Generations & Edits 1枚]**）の全 API Key 同時保持＋リクエスト単位切替＋衝突回避ローカル保存（画像ノードのみ生成し、不要なプロンプト専用ノードは作らない）。
  - Drag & Drop インポート（`.txt`/`.md`/画像）、キャンバス JSON（v1.0/v1.1 互換）保存/読込、単体 `.md`/画像エクスポート、Marp スライド出力。
- **新規設計する UI（過去 UI は参照せずゼロベース設計）**:
  - **Canvas-First / Low-Chrome**: 常設 UI を「上部フローティングバー（追加/整頓/開く/保存/設定）」と「下部フローティングコマンドドック（Context Chips で送信対象のテキスト件数・画像枚数を可視化＋Text/Image 切替＋プロバイダー切替）」のみに集約し、キャンバス面積を最大化。
  - 詳細編集（`NodeInspector`）、画像拡大（`ImageLightbox`）、設定（3 タブ構成の `SettingsModal`）は必要時のみ展開。通知は `alert()` を避けインアプリトースト＋確認ダイアログへ統一。
- **対象外（Non-Goals）**:
  - 8 月改変で導入した機能群（ChatDrawer、AI パートナー自律レベル/Orchestration、Proposal、Cluster View、Web 検索）、ストリーミング表示、クラウド同期、API Key のキャンバス JSON 保存。

---

## 2. 判断事項（利用者への確認）

**今回の計画開始にあたり、必須の追加判断（阻害となる矛盾・未決 B）はありません。**

なお、通常の設計範囲として以下の 4 点を既定方針として採用しています。変更したい項目があれば実装着手前にお知らせください（問題なければこのまま `WP-1` から実装へ進めます）。

| 項目 | 推奨・採用した既定方針 | 理由・影響 | 代案 |
| --- | --- | --- | --- |
| ビジュアルテーマ | ニュートラルな**ライトテーマ既定**（CSS カスタムプロパティでトークン化） | ドキュメント閲覧・画像比較の視認性が高く、将来のダークテーマ追加も低コスト | ダークテーマを既定にする |
| UI 言語 | MVP は**日本語 UI 固定** | 8 月版の i18n 肥大を避け、基本機能の安定化を優先 | 最初から日英切替（i18n）を入れる |
| 相対 `Image/` 基準 | 通常ビルドは実行ファイル基準、`wails dev` はリポジトリルート基準（環境変数で上書き可） | 既存の `Image/` 相対パス互換を保ちつつ、開発時のファイル散逸を防ぐ | 常に実行ファイル基準、または絶対パス必須にする |
| Auto-layout 方向 | **左→右（`LR`）** | 左右コネクタ（右出力 → 左入力）と視覚的に一致 | 上→下（`TB`）にする |

---

## 3. 未確認事項と実装時の確認ゲート

外部環境・ランタイムに依存する以下の 3 点は、未確認のまま確定扱いとせず、`41_work_packages.md` §3 に観測ゲートと代替案を設定しています。

1. **前提①（`WP-1` ゲート）**: 現 Windows 環境での `mise` 経由 Go / Node.js / Wails v2.12 導入と WebView2 ビルド動作。Go 確定まで `WP-2` 以降を開始しない。
2. **前提②（`WP-3` 観測 / `WP-7` 再確認）**: `wails dev` 時の `-tags dev` 付与と `os.Getwd()` 基準（不成立時は `wails.json` 上位探索フォールバックを適用）。
3. **前提③（`WP-6` 観測 / `WP-7` 最終確認）**: Windows WebView2 上での Wails `EnableFileDrop` / `OnFileDrop` と React Flow 操作の両立（不成立時は設定/CSS 調整、両立不能時は `replan_required`）。
4. **実課金外部 API（`REQ-07`, `REQ-08`）**: 全 4 プロバイダーおよび LLM は `httptest.Server` 自動テスト（`E1`）＋ローカルモック実機確認（`E2`）を実施し、実キー未提供プロバイダーは残存リスク明示のうえ `EX` 運用条件（`30_requirement.md` Verification Scope §3）で扱う。

---

## 4. 独立レビュー結果（W-REV）

- **判定**: `Critical: 0 件` / `Must-fix: 0 件` / `Suggest: 3 件` — **`implement` 工程 `WP-1` の開始可**。
- **任意改善（`Suggest` 3 件・通常モードで記録のみ）**:
  - `RV-001`: `42_spec_core_data_security.md` の前提②観測 WP 注記の軽微な参照ずれ（作業正本は `41_work_packages.md` の `WP-3`/`WP-7`）。
  - `RV-002`: `WP-6` 実装時に `CommandDock` 送信・エクスポート前にも `commitInspectorDraft()` を呼ぶ任意改善案。
  - `RV-003`: 既定方針 4 点の本資料での共有（対応済み）。

---

## 5. 正本ドキュメントへのリンク

- 要望・背景: [`10_claim.md`](./10_claim.md)
- 利用場面・シナリオ・範囲: [`20_app_requirement.md`](./20_app_requirement.md)
- 要求・受入条件・検証範囲正本（`REQ-01`〜`REQ-15`）: [`30_requirement.md`](./30_requirement.md)
- 全体設計・マップ（`D-001`〜`D-018`）: [`40_specification.md`](./40_specification.md)
  - コア・データ・セキュリティ詳細: [`42_spec_core_data_security.md`](./42_spec_core_data_security.md)
  - 外部プロバイダー・I/O 詳細: [`42_spec_providers_io.md`](./42_spec_providers_io.md)
  - Canvas-First UI・状態管理詳細: [`42_spec_canvas_ui.md`](./42_spec_canvas_ui.md)
- ワークパッケージ・依存・ゲート（`WP-1`〜`WP-7`）: [`41_work_packages.md`](./41_work_packages.md)
- レビュー記録・採否: [`50_review_notes.md`](./50_review_notes.md)
- 環境宣言: [`env_manifest.md`](./env_manifest.md)
- 進捗正本: [`90_status.md`](./90_status.md)
