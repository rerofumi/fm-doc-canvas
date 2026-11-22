### 環境宣言（Environment Manifest）

1. **実行環境（自己申告）**: `Windows / PowerShell (pwsh)`（`e:\programming\AI_generative\fm-doc-canvas`、ツールチェーン管理は `mise`、VCS は `jj`）
2. **対象ソース版・成果物**:
   - 対象参照: 基準親 commit `70773a33b236`（change `zzmrqyyrztrn` / `recreating_20261123`）＋ 作業コピー `xqmmzvlzmozo`（本計画文書群 r1。`ready` 時点の実装ソースはゼロベース再構築前の未生成状態）
   - 対象範囲: リポジトリルート `e:\programming\AI_generative\fm-doc-canvas` 配下の計画文書一式：
     - `docs/plan_20261123_core_rebuild/10_claim.md`
     - `docs/plan_20261123_core_rebuild/20_app_requirement.md`
     - `docs/plan_20261123_core_rebuild/30_requirement.md`
     - `docs/plan_20261123_core_rebuild/40_specification.md`
     - `docs/plan_20261123_core_rebuild/41_work_packages.md`
     - `docs/plan_20261123_core_rebuild/42_spec_core_data_security.md`
     - `docs/plan_20261123_core_rebuild/42_spec_providers_io.md`
     - `docs/plan_20261123_core_rebuild/42_spec_canvas_ui.md`
     - `docs/plan_20261123_core_rebuild/50_review_notes.md`
     - `docs/plan_20261123_core_rebuild/60_review_packet.md`
     - `docs/plan_20261123_core_rebuild/90_status.md`
     - `docs/plan_index.md`
     - 参照 cheatsheet: `docs/cheatsheet/image_generation_providers.md`, `docs/cheatsheet/multimodal_vision.md`, `AGENTS.md`
   - 特定・照合方法: `jj log -r "@ | @-"` および `jj status` による版・差分一覧確認＋各文書の直接 read-only 読み取り照合
3. **テスト資産・fixture**:
   - 対象範囲: 計画時点（`ready`）では実装・テストコード未作成のため対象資産 0 件（ゼロベース再構築の初回計画であるため正常。`WP-1`〜`WP-4` にて `backend/*_test.go` および `frontend/src/utils/*.test.ts`・v1.0/v1.1 互換 JSON fixture を新規作成予定）
   - 期待件数・出所 / 確認件数: 0 件（計画時点・実装未着手） / 確認済み 0 件
   - 対象参照: 該当なし（`implement` 工程完了・受け入れ時に実測版へ更新する）
   - 特記事項: `REQ-07`/`REQ-08` の外部 API 検証は `httptest.Server` モック（`E1`）とローカルモック/実キー確認（`E2` / `EX` 条件）に分離し、実 API Key はテスト資産へ含めない
4. **採取・突合手段と結果**:
   - 使用手段: `jj` CLI（`jj log`, `jj status`）およびファイル直接読み取りによる手動確認
   - 機械IDを使う場合: 未使用
   - 機械IDを使わない場合: 計画文書のみの初回計画フェーズであるため、Python 等の任意 ID 生成スクリプトは使用せず、`jj` の commit ID (`70773a33b236`)・作業コピー差分一覧および各文書の直接読み取りによって内容と ID 一意性（`REQ-01`〜`REQ-15`, `D-001`〜`D-018`, `WP-1`〜`WP-7`）を照合した
   - 照合結果:
     - 計画文書 11 ファイルおよび `docs/plan_index.md` の存在・構成・ID 一意性: **照合済み（一致）**
     - ローカル環境の `mise` / Wails v2.12 / WebView2 ビルド動作: **未照合（`WP-1` 冒頭の未確認前提①ゲートで実測予定）**
5. **変更履歴（ready以降）**:
   - `2026-11-23` / 初回作成（plan `ready`） / `plan_20261123_core_rebuild` r1 の計画完了時点の基準宣言を記録 / 再確認範囲: なし / 影響を受ける試験結果: なし
