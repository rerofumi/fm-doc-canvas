### 環境宣言（Environment Manifest）

1. **実行環境（自己申告）**: `Windows / PowerShell (pwsh)`（`e:\programming\AI_generative\fm-doc-canvas`、ツールチェーン管理は `mise`、VCS は `jj`）
2. **対象ソース版・成果物**:
   - 対象参照: 親 commit `da5c2215`（`xqmmzvlz` / 採用計画 `r1`）上の作業コピー `mssrrqzp` / commit `baac6cb3`（`WP-1`〜`WP-6` 全実装＋`WP-7` 証跡追記済み）
   - 対象範囲: リポジトリルート `e:\programming\AI_generative\fm-doc-canvas` 配下の実装一式（`mise.toml`, `wails.json`, `go.mod`, `main.go`, `app.go`, `backend/*.go`, `frontend/src/**/*`, `frontend/wailsjs/**/*`, `build/bin/fm-doc-canvas.exe`）および計画文書・証跡（`docs/plan_20261123_core_rebuild/30_requirement.md`, `40_specification.md`, `41_work_packages.md`, `42_spec_*.md`, `50_review_notes.md`, `90_status.md`）
   - 特定・照合方法: `jj log -r "@ | @-"` および `jj status` による版・差分一覧確認＋各文書の直接 read-only 読み取り照合
3. **テスト資産・fixture**:
   - 対象範囲:
     - Backend Go テスト（7 ファイル / 23 テスト）: `app_test.go`, `backend/config_test.go`, `backend/file_test.go`, `backend/image_asset_test.go`, `backend/sanitize_test.go`, `backend/llm_test.go`, `backend/providers_test.go`
     - Frontend Vitest テスト（6 ファイル / 31 テスト）: `frontend/src/types/types.test.ts`, `frontend/src/utils/graphContext.test.ts`, `frontend/src/utils/autoLayout.test.ts`, `frontend/src/utils/marpExport.test.ts`, `frontend/src/utils/canvasSerializer.test.ts`, `frontend/src/store/useCanvasStore.test.ts`
   - 期待件数・出所 / 確認件数: Go 23 テスト / Vitest 31 テスト（`WP-7` 独立再実行で全 PASS 確認済み）
   - 対象参照: `mssrrqzp` / `baac6cb3`（証跡: `docs/plan_20261123_core_rebuild/50_review_notes.md:"WP-7_E1_PASS"`）
   - 特記事項: `REQ-07`/`REQ-08` の外部 API 検証は `httptest.Server` モック（`E1`）で実施し、実 API Key はテスト資産へ一切含まない
4. **採取・突合手段と結果**:
   - 使用手段: `jj` CLI（`jj log`, `jj status`）およびファイル直接読み取り・`mise run` 独立再実行
   - 機械IDを使う場合: 未使用
   - 機械IDを使わない場合: `jj` commit ID (`baac6cb3`)・作業コピー差分一覧・テストファイル一覧および `50_review_notes.md` 証跡アンカーの read-only 照合を使用
   - 照合結果:
     - 計画文書一式および実装・テスト資産（Go 7ファイル / Frontend 6ファイル）: **照合済み（一致）**
     - ローカル環境の `mise` / Wails v2.12 / WebView2 ビルド動作（前提①）・`wails dev` パス解決（前提②）: **照合済み（Go）**
     - Windows GUI インタラクティブ操作・実 D&D（前提③）: **自己申告のみ（CLI 環境限界により未観測・GUI 実機確認待ち）**
5. **変更履歴（ready以降）**:
   - `2026-11-23` / 初回作成（plan `ready`） / `plan_20261123_core_rebuild` r1 の計画完了時点の基準宣言を記録 / 再確認範囲: なし / 影響を受ける試験結果: なし
   - `2026-11-23` / 実装・WP-7 完了時点へ更新（`accepting` 移行前） / `WP-1`〜`WP-6` 実装成果物および `WP-7` テスト資産（Go 23件 / Vitest 31件）・`baac6cb3` を記録 / 再確認範囲: `REQ-01`〜`REQ-15` 独立受け入れ判定 / 影響を受ける試験結果: 初回判定
