# Status — plan_20261123_core_rebuild

```text
tier: Full
state: accepting
worklog: disabled
```

## 現在の進行

| 項目 | 値 |
| --- | --- |
| 現在の工程 / 担当 | implement（返却済み・`needs_input`） / 次の担当: 利用者（Windows 実機 GUI 確認・EX 承認） → 再受け入れ (`acceptance`) → `release` |
| 担当leaderの実行参照 | conversation `d158731c-7d21-47c7-902c-75e199125e27` |
| 呼び出し元 / 返却先 | Lv.1 process（兼任） / 利用者 |
| 工程の結果 | `needs_input`（`REQ-01, REQ-15`: `pass`、`REQ-02`〜`REQ-14`: `human-pending`、`Critical: 0 / Must-fix: 0 / Suggest: 0`） |
| 採用計画 | `r1`（commit `da5c2215` / change `xqmmzvlz`、`docs/plan_20261123_core_rebuild/` 一式） |
| 改訂案 | なし |
| 再計画要求 | なし |
| 指摘対応モード | 通常（`Critical` / `Must-fix` のみ修正対象、`Suggest` は `50_review_notes.md` に記録） |
| 現在の作業 / 次の作業 | 全実装（`WP-1`〜`WP-6`）・独立検証（`WP-7`）・独立受け入れ判定（`W-ACC-1`）完了（未回収の子agentなし） / 利用者による Windows 実機 GUI 操作確認（`REQ-02`〜`REQ-14`・前提③実 D&D）および `REQ-07`/`08` 実課金 API の `EX` 承認後、再受け入れ・`release` へ進む |
| 保留理由 / 再開条件 | CLI/headless 環境限界により Windows GUI 実操作 `E2` および実課金外部 API の `EX` 利用者承認が未了。`build/bin/fm-doc-canvas.exe`（または `mise run dev`）での実機確認結果と `EX` 承認を取得して再開 |
| 反復累積カウント | REQごとの差し戻し・確認再実行上限: 3回（現在 全REQ 0/3）。ゴール全体の再計画 `RP` 上限: 2回（現在 0/2） |

### 実行中・予定作業（WP 追跡）

- 実行中・未回収の子agentなし（全 `WP-1`〜`WP-7`・`W-ACC-1` 回収完了、履歴節 `H-006`〜`H-013` を参照）。

## 環境宣言

- `docs/plan_20261123_core_rebuild/env_manifest.md`

## REQの実装・受け入れ

| ID | Requirement summary | 対象設計ID | 状態 | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | `mise` 管理による Wails v2 + React/TS ビルド・テスト基盤構築 | `D-001, D-002` | 今回実装 | `mise run build`・Go/Frontend テスト終了コード 0 確認 | E1 | `WP-1, WP-3, WP-7` | implemented | `50_review_notes.md:"WP-7_E1_PASS"`（Go 23件/Vitest 31件/build-frontend/wails build 独立再実行全PASS, `ab2fd146`） | `pass` (`acc-judge`, `ab2fd146`) |
| REQ-02 | キャンバス基本操作（パン、ズーム 0.1〜4.0、選択、確認付き Clear Canvas） | `D-011, D-012, D-018` | 今回実装 | 実アプリでのパン・ズーム境界・選択・Clear キャンセル/確定観測 | E2 | `WP-5, WP-6, WP-7` | implemented | 補助E1: `useCanvasStore.test.ts` PASS / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI パン/ズーム/選択/Clear 操作確認待ち) |
| REQ-03 | テキストノード機能（追加、行数制限表示、生成元プロンプト表示/追記、詳細エディタ・切替自動確定、削除） | `D-013, D-018` | 今回実装 | 実アプリでの作成・編集・切替自動確定・プレビュー・追記・削除観測 | E2 | `WP-5, WP-6, WP-7` | implemented | 補助E1: `useCanvasStore.test.ts` PASS / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI テキストノード・詳細エディタ操作確認待ち) |
| REQ-04 | 画像ノード・ライトボックス機能（Data URL 表示、操作、生成プロンプト非破壊追記、拡大・出力起動） | `D-014, D-008, D-005` | 今回実装 | 実アプリでの画像表示・リサイズ・追記（空/非空）・ライトボックス操作観測 | E2 | `WP-2, WP-5, WP-6, WP-7` | implemented | 補助E1: `backend/image_asset_test.go` PASS / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI 画像表示・リサイズ・追記・ライトボックス確認待ち) |
| REQ-05 | 有向エッジ連結と循環防止（作成・削除・ループ事前検出と拒否通知） | `D-015` | 今回実装 | 循環検出単体テスト＋実アプリでの接続・ループ拒否・削除観測 | E1 / E2 | `WP-4, WP-5, WP-7` | implemented | E1 PASS: `graphContext.test.ts` / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI 接続・ループ拒否・削除確認待ち) |
| REQ-06 | コンテキスト収集・上流トラバーサル（0/1/複数件、分岐/ループ停止警告、テキスト/画像分離）と可視化 | `D-016` | 今回実装 | グラフ探索・収集単体テスト＋実アプリでのコンテキストチップ・警告観測 | E1 / E2 | `WP-4, WP-5, WP-7` | implemented | E1 PASS: `graphContext.test.ts` 11件 / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI コンテキストチップ・警告確認待ち) |
| REQ-07 | LLM テキスト生成・Vision 入力・自動サマリー（OpenAI互換、空API Key対応、サマリー失敗時本文維持） | `D-006, D-013, D-018` | 今回実装 | `httptest` モック Go 単体テスト＋実アプリ（ローカルモック/実API）観測（未接続時は EX 条件適用） | E1 / E2 (EX可) | `WP-3, WP-6, WP-7` | implemented | E1 PASS: `backend/llm_test.go` / EX整理: `50_review_notes.md:"WP-7_EX_SUMMARY"` | `human-pending` (`acc-judge`: ローカルモック/実LLM E2 確認＋実課金API EX 承認待ち) |
| REQ-08 | マルチプロバイダー画像生成（OpenRouter/OpenAI/Google/xAI）・リクエスト単位切替・衝突回避ローカル保存 | `D-007, D-008, D-018` | 今回実装 | `httptest` 4プロバイダー＋保存単体テスト＋実アプリ切替生成観測（実キー未提供分は EX 条件適用） | E1 / E2 (EX可) | `WP-2, WP-3, WP-6, WP-7` | implemented | E1 PASS: `backend/providers_test.go`, `image_asset_test.go` / EX整理: `50_review_notes.md:"WP-7_EX_SUMMARY"` | `human-pending` (`acc-judge`: 切替生成 E2 確認＋実キー未提供プロバイダー EX 承認待ち) |
| REQ-09 | ファイルインポート（D&D で `.txt`/`.md`/画像を取込み、衝突回避コピー、非対応拡張子エラー通知） | `D-009, D-005` | 今回実装 | インポート・衝突回避・拡張子検証 Go 単体テスト＋実アプリ D&D 観測 | E1 / E2 | `WP-2, WP-3, WP-6, WP-7` | implemented | E1 PASS: `backend/file_test.go` + 結線確認 / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: Windows Explorer 実 D&D・前提③非干渉確認待ち) |
| REQ-10 | オートレイアウト（接続関係を保った全ノード自動再配置） | `D-017` | 今回実装 | レイアウト計算単体テスト＋実アプリ整頓操作観測 | E1 / E2 | `WP-4, WP-5, WP-7` | implemented | E1 PASS: `autoLayout.test.ts` / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実アプリ GUI 「整頓」視覚確認待ち) |
| REQ-11 | キャンバス JSON 保存/読込と v1.0/v1.1 互換（ハンドル補完・欠損安全処理・秘匿情報非混入） | `D-004, D-002` | 今回実装 | シリアライザ・v1.0/v1.1 fixture 読込単体テスト＋実アプリ保存/読込観測 | E1 / E2 | `WP-2, WP-3, WP-4, WP-6, WP-7` | implemented | E1 PASS: `canvasSerializer.test.ts`, `file_test.go` / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: OS ファイルダイアログ保存/読込・v1.0/v1.1 実機確認待ち) |
| REQ-12 | エクスポート機能（単体 `.md`、単体画像コピー、Marp スライド `.md`） | `D-010, D-005` | 今回実装 | Marp 変換・出力単体テスト＋実アプリ保存ダイアログ出力観測 | E1 / E2 | `WP-2, WP-3, WP-4, WP-6, WP-7` | implemented | E1 PASS: `marpExport.test.ts`, `file_test.go` / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 保存ダイアログ経由 3種エクスポート確認待ち) |
| REQ-13 | ローカル設定管理（`config.json` 永続化、4プロバイダー非破壊保持、旧フラット形式自動マイグレーション） | `D-003, D-002` | 今回実装 | 設定読み書き・非破壊切替・マイグレーション Go 単体テスト＋設定モーダル再起動確認 | E1 / E2 | `WP-2, WP-3, WP-6, WP-7` | implemented | E1 PASS: `backend/config_test.go` / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 設定モーダル編集・保存・再起動維持確認待ち) |
| REQ-14 | 新規 Canvas-First UI/UX と非同期状態・通知（上部バー＋下部ドック、ローディング多重送信防止、トースト通知） | `D-011, D-018` | 今回実装 | 実アプリ画面構成・非同期多重送信抑止・トースト通知観測 | E2 | `WP-5, WP-6, WP-7` | implemented | 補助E3 PASS: `window.alert/confirm` 0件 / 未観測: `50_review_notes.md:"WP-7_E2_UNOBSERVED"` | `human-pending` (`acc-judge`: 実画面構成・多重送信抑止・トースト/確認ダイアログ確認待ち) |
| REQ-15 | セキュリティ（画像パストラバーサル拒否、API Key の `config.json` 限定保存・ログ/JSON 非出力） | `D-005, D-003, D-004, D-006, D-007, D-008, D-009, D-010` | 今回実装 | パス検証・マスキング Go 単体テスト＋実装箇所確認 | E1 / E3 | `WP-2, WP-3, WP-4, WP-7` | implemented | `50_review_notes.md:"WP-7_E3_PASS"` + `acc-judge` 独立照合（全テストPASS・全経路パス検証・秘匿除外・標準出力0件） | `pass` (`acc-judge`, `ab2fd146`) |

## 履歴

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-001 / W-REQ（10_claim.md, 20_app_requirement.md, 30_requirement.md / REQ-01〜REQ-15）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-requirement / subagent 60e92edd-9f46-4992-b6d9-bd99c61d23a8 / r1（親commit 70773a33b236）
結果 / 証跡への参照: 完了 / docs/plan_20261123_core_rebuild/30_requirement.md:"Requirements Table（REQ 一覧）"（全15件・重複なし・検証範囲・EX条件整備）
未了・次の引き渡し: なし（未決Bなし） / W-ARCH へ引き渡し済み
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-002 / W-ARCH（40_specification.md, 42_spec_core_data_security.md, 42_spec_providers_io.md, 42_spec_canvas_ui.md / D-001〜D-018）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-architect / subagent 51969a64-db36-4278-8d0a-a09f7023baf0 / r1（親commit 70773a33b236）
結果 / 証跡への参照: 完了 / docs/plan_20261123_core_rebuild/40_specification.md:"REQ ↔ 設計項目 ID マッピング"（D-001〜D-018一意定義・失敗/失効動作・未確認前提3点整理）
未了・次の引き渡し: 未確認前提3点は WP ゲートへ引き継ぎ / W-WP へ引き渡し済み
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-003 / W-WP（41_work_packages.md / WP-1〜WP-7）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-taskplanner / subagent 69603658-ff9b-4547-93db-4c36c60e85b2 / r1（親commit 70773a33b236）
結果 / 証跡への参照: 完了 / docs/plan_20261123_core_rebuild/41_work_packages.md:"未確認前提 3 点の観測・判定ゲート"（並列非競合条件・統合順序・ゲート定義）
未了・次の引き渡し: なし / W-REV へ引き渡し済み
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-004 / W-REV（10〜42 独立レビュー → 50_review_notes.md）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-reviewer / subagent 0c8b4ae8-9077-4497-a5f0-60a254c63e20 / r1（親commit 70773a33b236）
結果 / 証跡への参照: 進行可（Critical: 0, Must-fix: 0, Suggest: 3） / docs/plan_20261123_core_rebuild/50_review_notes.md:"Plan Review Record（W-REV: 初回計画レビュー r1）"
未了・次の引き渡し: Suggest 3件（RV-001〜RV-003）は通常モードで採否記録済み / W-PACK へ引き渡し済み
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-005 / W-PACK（env_manifest.md, 60_review_packet.md, 50採否記録, 90_status.md, plan_index.md）
担当 / 実行参照 / 対象版: Lv.2 plan leader / conversation 3dabb194-1ff7-450a-b997-d2c949d13ea7 / r1（親commit 70773a33b236 + WC xqmmzvlzmozo）
結果 / 証跡への参照: 完了（ready） / docs/plan_20261123_core_rebuild/60_review_packet.md, docs/plan_20261123_core_rebuild/env_manifest.md
未了・次の引き渡し: implement 工程 WP-1 から開始可能（未確認前提①ゲートを冒頭で実測）
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-006 / W-IMPL-1（WP-1 / REQ-01: 前提①ゲート観測＋プロジェクト基盤・共有型定義）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp1-dev (767a5bc7-3198-4acc-b806-106fe4055d3f, gemini-4-hydrogen-medium) / r1（親commit da5c2215 → WC mssrrqzp / b724b336）
結果 / 証跡への参照: 完了（前提① Go） / `mise.toml`, `frontend/src/types/canvas.ts`, `frontend/src/types/config.ts`, `mise run test-frontend/build-frontend/test-backend/build` 全 exit 0（`build/bin/fm-doc-canvas.exe` 生成）
未了・次の引き渡し: REQ-01 は WP-3/WP-7 残件 / WP-2 と WP-4 の並列実行へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-007 / W-IMPL-4（WP-4 / REQ-05,06,10,11,12,15: フロントエンド純粋関数群 4 モジュール + Vitest 単体テスト）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp4-dev (9fefa6fa-8b00-407e-a4ea-a852a49eddbc, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / 95096f9d）
結果 / 証跡への参照: 完了（E1） / `frontend/src/utils/{graphContext,autoLayout,marpExport,canvasSerializer}.ts`＋各 `.test.ts`、`mise run test-frontend` 21 passed、`mise run build-frontend` exit 0
未了・次の引き渡し: UI統合・E2/E3は WP-5〜WP-7 / WP-3 完了と合わせて WP-5 へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-008 / W-IMPL-2（WP-2 / REQ-13,15,04,08,09,11,12: Backend コア・アセット・File I/O・セキュリティ）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp2-dev (eea15c22-b2df-4922-af1f-43d3141373ac, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / d73c80b2）
結果 / 証跡への参照: 完了（E1） / `backend/{config,path_base_dev,path_base_prod,sanitize,image_asset,file}.go`＋各 `_test.go`、`mise run test-backend` exit 0（15テストケース＋`-tags dev` 全PASS）
未了・次の引き渡し: OSダイアログ実動作・前提②は WP-3/WP-7 / WP-3 へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-009 / W-IMPL-3（WP-3 / REQ-01,07,08,09,11,12,13,15: Backend 外部プロバイダー連携・app.go 14メソッド結線・前提②実測）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp3-dev (61adf060-bc1f-4e8b-88d3-c99653711b58, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / 0bbe999e）
結果 / 証跡への参照: 完了（E1 + 前提② Go） / `backend/{llm,image,provider_openrouter,provider_openai,provider_google,provider_xai}.go`, `app.go`, `frontend/wailsjs/go/main/App.d.ts` 全14メソッド生成、`mise run test-backend` / `mise run build` exit 0、`wails dev` 前提②実測 Go（`os.Getwd()` = リポジトリルート）
未了・次の引き渡し: UI結線・E2/E3は WP-5〜WP-7 / WP-4 成果と合わせて WP-5 へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-010 / W-IMPL-5（WP-5 / REQ-02,03,04,05,06,10,14: Store・Bridge・Canvas-First UI 基盤・カード・基本操作）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp5-dev (2d64bf12-cb8c-496b-8066-45369c2e135a, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / 93c1a336）
結果 / 証跡への参照: 完了（E1 + E3） / `frontend/src/{services/wailsBridge.ts,store/*,components/{canvas,overlay,common}/*,App.tsx}`、`mise run test-frontend` 25 passed、`build-frontend`/`build` exit 0、`window.alert/confirm` 0件
未了・次の引き渡し: オーバーレイ詳細 UI・全機能結線・前提③観測は WP-6 / WP-6 へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-011 / W-IMPL-6（WP-6 / REQ-02,03,04,07,08,09,11,12,13,14: オーバーレイ詳細 UI・全機能統合・前提③確認）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / wp6-dev (8e7b6637-c6d8-4580-ba86-e5ba568422c6, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / 4e22b9bf）
結果 / 証跡への参照: 完了（E1 + E3 + wails dev 起動確認） / `NodeInspector.tsx`, `ImageLightbox.tsx`, `SettingsModal.tsx`, `useCanvasStore.ts`, `CanvasViewport.tsx`, `App.tsx`、`mise run test-backend/test-frontend(31 passed)/build-frontend/build` 全 exit 0、`window.alert/confirm` 0件
未了・次の引き渡し: 前提③の実GUI D&D 操作観測および E2/E3 独立検証は WP-7 へ引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-012 / W-TEST-7（WP-7 / REQ-01〜REQ-15: 独立検証 E1 全回帰・E3 構造確認・E2 起動観測・EX 整理）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-tester / wp7-tester (dcb7c616-411e-439a-95ad-d2e4bb6ac980, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / baac6cb3）
結果 / 証跡への参照: 完了（Critical: 0, Must-fix: 0, Suggest: 0） / `docs/plan_20261123_core_rebuild/50_review_notes.md:"WP-7_E1_PASS"`, `"WP-7_E3_PASS"`, `"WP-7_E2_OBSERVED"`, `"WP-7_EX_SUMMARY"`, `"WP-7_E2_UNOBSERVED"`
未了・次の引き渡し: CLI環境限界により Windows GUI 実機操作（REQ-02〜REQ-14 の実操作 E2・前提③実D&D）および実課金 API（REQ-07/08 EX）が未観測/承認待ち / Lv.3 fm-dev-acceptance へ独立判定を引き渡し
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-013 / W-ACC-1（REQ-01〜REQ-15 独立最終受け入れ判定＋env_manifest.md 独立照合）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-acceptance / acc-judge (3a748e33-7a61-4354-86ef-75bb65710c62, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / ab2fd146）
結果 / 証跡への参照: 完了（Critical: 0, Must-fix: 0, Suggest: 0 / REQ-01, REQ-15: pass / REQ-02〜REQ-14: human-pending） / 独立再実行（Go 23件/Vitest 31件/build-frontend/wails build PASS）および `docs/plan_20261123_core_rebuild/50_review_notes.md:"WP-7_E1_PASS"`, `"WP-7_E3_PASS"`, `"WP-7_E2_UNOBSERVED"`, `"WP-7_EX_SUMMARY"`
未了・次の引き渡し: Windows 実機 GUI 確認（REQ-02〜REQ-14・前提③実D&D）および REQ-07/08 EX 利用者承認待ち / `needs_input` として利用者へ返却
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-014 / バージョン番号 0.6.0 反映（wails.json, frontend/package.json）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / ver-bump-dev (270673cc-5ed4-4d4b-a218-9dca4e11256d, gemini-4-hydrogen-medium) / r1（WC mssrrqzp / 56f9bb00）
結果 / 証跡への参照: 完了 / `wails.json` (`info.productVersion: "0.6.0"`), `frontend/package.json` (`version: "0.6.0"`), `mise run build` exit 0 (`build/bin/fm-doc-canvas.exe` の `FileVersionRaw: 0.6.0.0` 確認)
未了・次の引き渡し: 引き続き利用者の Windows 実機 GUI 確認・EX 承認待ち
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-015 / v0.5.0 からのアイコン・README 復元（build/appicon.png, build/windows/icon.ico, README.md）
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / assets-restore-dev (7087fc4a-92a7-4046-b2c1-860ff30911a4, gemini-4-hydrogen-medium) / r1（復元元 v0.5.0 `4be0b148` → WC mssrrqzp）
結果 / 証跡への参照: 完了 / `build/appicon.png`, `build/windows/icon.ico`, `README.md` 復元、`mise run build` exit 0 (`build/bin/fm-doc-canvas.exe` 12,199,424 bytes)
未了・次の引き渡し: README.md の 0.6.0 向け記述整理は利用者判断（または release 工程で対応） / 引き続き利用者の Windows 実機 GUI 確認・EX 承認待ち
```

```text
履歴ID / 対象（作業・REQ/WP・文書）: H-016 / README.md の v0.6.0 仕様準拠への全面書き直し
担当 / 実行参照 / 対象版: Lv.3 fm-dev-develop / readme-update-dev (6d3a9ffa-d760-43e6-8a1f-d1f25536f00c, gemini-4-hydrogen-medium) / r1（v0.6.0 / WC mssrrqzp）
結果 / 証跡への参照: 完了 / `README.md` 更新（未実装・旧機能記述およびリンク切れ残存 0 件、現行 UI ラベル・`mise.toml` タスク名と一致確認、`v0.6.0` 更新履歴追記）
未了・次の引き渡し: 引き続き利用者の Windows 実機 GUI 確認・EX 承認待ち
```
