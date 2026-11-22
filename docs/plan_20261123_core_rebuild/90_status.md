# Status — plan_20261123_core_rebuild

```text
tier: Full
state: planned
worklog: disabled
```

## 現在の進行

| 項目 | 値 |
| --- | --- |
| 現在の工程 / 担当 | plan（返却済み・`ready`） / 次の担当: Lv.2 implement leader（または利用者判断後） |
| 担当leaderの実行参照 | conversation `3dabb194-1ff7-450a-b997-d2c949d13ea7` |
| 呼び出し元 / 返却先 | 利用者 / 利用者 |
| 工程の結果 | `ready`（`Critical: 0`, `Must-fix: 0`, `Suggest: 3` 記録済み。`WP-1` から開始可能） |
| 採用計画 | 未採用（利用可能計画版: `r1`、基準親 commit `70773a33b236` + 作業コピー `xqmmzvlzmozo`、`docs/plan_20261123_core_rebuild/` 一式） |
| 改訂案 | なし（初回計画 `r1` 完成） |
| 再計画要求 | なし |
| 指摘対応モード | 通常（`Critical` / `Must-fix` のみ修正対象、`Suggest` は `50_review_notes.md` に記録） |
| 現在の作業 / 次の作業 | 計画工程完了（未回収の子agentなし） / 利用者確認後、`implement` 工程で `WP-1`（未確認前提①ゲート＋プロジェクト基盤構築）から着手可能 |
| 保留理由 / 再開条件 | なし（未確認前提①〜③はそれぞれ `WP-1` / `WP-3` / `WP-6` の観測ゲートとして `41_work_packages.md` §3 に定義済み） |
| 反復累積カウント | REQごとの差し戻し・確認再実行上限: 3回（現在 全REQ 0/3）。ゴール全体の再計画 `RP` 上限: 2回（現在 0/2） |

## 環境宣言

- `docs/plan_20261123_core_rebuild/env_manifest.md`

## REQの実装・受け入れ

| ID | Requirement summary | 対象設計ID | 状態 | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-01 | `mise` 管理による Wails v2 + React/TS ビルド・テスト基盤構築 | `D-001, D-002` | 今回実装 | `mise run build`・Go/Frontend テスト終了コード 0 確認 | E1 | `WP-1, WP-3, WP-7` | todo | — | unverified |
| REQ-02 | キャンバス基本操作（パン、ズーム 0.1〜4.0、選択、確認付き Clear Canvas） | `D-011, D-012, D-018` | 今回実装 | 実アプリでのパン・ズーム境界・選択・Clear キャンセル/確定観測 | E2 | `WP-5, WP-6, WP-7` | todo | — | unverified |
| REQ-03 | テキストノード機能（追加、行数制限表示、生成元プロンプト表示/追記、詳細エディタ・切替自動確定、削除） | `D-013, D-018` | 今回実装 | 実アプリでの作成・編集・切替自動確定・プレビュー・追記・削除観測 | E2 | `WP-5, WP-6, WP-7` | todo | — | unverified |
| REQ-04 | 画像ノード・ライトボックス機能（Data URL 表示、操作、生成プロンプト非破壊追記、拡大・出力起動） | `D-014, D-008, D-005` | 今回実装 | 実アプリでの画像表示・リサイズ・追記（空/非空）・ライトボックス操作観測 | E2 | `WP-2, WP-5, WP-6, WP-7` | todo | — | unverified |
| REQ-05 | 有向エッジ連結と循環防止（作成・削除・ループ事前検出と拒否通知） | `D-015` | 今回実装 | 循環検出単体テスト＋実アプリでの接続・ループ拒否・削除観測 | E1 / E2 | `WP-4, WP-5, WP-7` | todo | — | unverified |
| REQ-06 | コンテキスト収集・上流トラバーサル（0/1/複数件、分岐/ループ停止警告、テキスト/画像分離）と可視化 | `D-016` | 今回実装 | グラフ探索・収集単体テスト＋実アプリでのコンテキストチップ・警告観測 | E1 / E2 | `WP-4, WP-5, WP-7` | todo | — | unverified |
| REQ-07 | LLM テキスト生成・Vision 入力・自動サマリー（OpenAI互換、空API Key対応、サマリー失敗時本文維持） | `D-006, D-013, D-018` | 今回実装 | `httptest` モック Go 単体テスト＋実アプリ（ローカルモック/実API）観測（未接続時は EX 条件適用） | E1 / E2 (EX可) | `WP-3, WP-6, WP-7` | todo | — | unverified |
| REQ-08 | マルチプロバイダー画像生成（OpenRouter/OpenAI/Google/xAI）・リクエスト単位切替・衝突回避ローカル保存 | `D-007, D-008, D-018` | 今回実装 | `httptest` 4プロバイダー＋保存単体テスト＋実アプリ切替生成観測（実キー未提供分は EX 条件適用） | E1 / E2 (EX可) | `WP-2, WP-3, WP-6, WP-7` | todo | — | unverified |
| REQ-09 | ファイルインポート（D&D で `.txt`/`.md`/画像を取込み、衝突回避コピー、非対応拡張子エラー通知） | `D-009, D-005` | 今回実装 | インポート・衝突回避・拡張子検証 Go 単体テスト＋実アプリ D&D 観測 | E1 / E2 | `WP-2, WP-3, WP-6, WP-7` | todo | — | unverified |
| REQ-10 | オートレイアウト（接続関係を保った全ノード自動再配置） | `D-017` | 今回実装 | レイアウト計算単体テスト＋実アプリ整頓操作観測 | E1 / E2 | `WP-4, WP-5, WP-7` | todo | — | unverified |
| REQ-11 | キャンバス JSON 保存/読込と v1.0/v1.1 互換（ハンドル補完・欠損安全処理・秘匿情報非混入） | `D-004, D-002` | 今回実装 | シリアライザ・v1.0/v1.1 fixture 読込単体テスト＋実アプリ保存/読込観測 | E1 / E2 | `WP-2, WP-3, WP-4, WP-6, WP-7` | todo | — | unverified |
| REQ-12 | エクスポート機能（単体 `.md`、単体画像コピー、Marp スライド `.md`） | `D-010, D-005` | 今回実装 | Marp 変換・出力単体テスト＋実アプリ保存ダイアログ出力観測 | E1 / E2 | `WP-2, WP-3, WP-4, WP-6, WP-7` | todo | — | unverified |
| REQ-13 | ローカル設定管理（`config.json` 永続化、4プロバイダー非破壊保持、旧フラット形式自動マイグレーション） | `D-003, D-002` | 今回実装 | 設定読み書き・非破壊切替・マイグレーション Go 単体テスト＋設定モーダル再起動確認 | E1 / E2 | `WP-2, WP-3, WP-6, WP-7` | todo | — | unverified |
| REQ-14 | 新規 Canvas-First UI/UX と非同期状態・通知（上部バー＋下部ドック、ローディング多重送信防止、トースト通知） | `D-011, D-018` | 今回実装 | 実アプリ画面構成・非同期多重送信抑止・トースト通知観測 | E2 | `WP-5, WP-6, WP-7` | todo | — | unverified |
| REQ-15 | セキュリティ（画像パストラバーサル拒否、API Key の `config.json` 限定保存・ログ/JSON 非出力） | `D-005, D-003, D-004, D-006, D-007, D-008, D-009, D-010` | 今回実装 | パス検証・マスキング Go 単体テスト＋実装箇所確認 | E1 / E3 | `WP-2, WP-3, WP-4, WP-7` | todo | — | unverified |

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
