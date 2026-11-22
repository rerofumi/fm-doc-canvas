# Review Notes

## Lessons Learned from August 2026 Changes

2026年8月の改変（`plan_20260810_chat_artifact` 〜 `plan_20260817_ui_i18n`）は高機能だったが、以下の理由で日常の使い勝手が悪化したため、今回の再構築では意図的に持ち込まない。

- **概念モデルの過剰複雑化**: Text role、Workspace scope、Candidate/Active Context、Proposal、Action Level、Orchestration などの概念が増えすぎ、シンプルな「メモを置いてAIに聞く」体験を阻害した。
- **UI の圧迫**: 右ドロワーチャット、制御バー、Proposal パネル、Cluster View などがキャンバス領域を圧迫し、主役であるはずのキャンバスが狭くなった。
- **導線の分散**: 「直接実行（Direct）」と「チャット（Dialogue）」の二重導線により、ユーザーがどちらを使うべきか迷う場面が増えた。

今回の再構築では、**「キャンバス上でノードを選び、下部コマンドドックから一発で Text / Image を生成する」**単一で明快な体験へ戻す。

## Technical Improvements Over v0.4.2

過去のソースコードはそのまま流用せず新規に組むが、v0.4.2 実装で発見された以下の小さな課題は最初から改善した設計にする。

1. **xAI 画像生成の URL レスポンスフォールバック**:
   - 旧実装では `xai.go` が `data[0].url` を返された際に `downloadAndSaveImage(url)` を呼んでいたが、`downloadAndSaveImage` は `data:image/` 形式しか受け付けない実装だった。新規実装では `saveImageFromDataURLOrHTTPURL` として HTTP(S) URL からのダウンロード保存にも対応する。
2. **ファイル名衝突の防止**:
   - 旧実装では生成画像が秒単位タイムスタンプ（`image_20260101_120000.png`）、インポート画像が `os.Getpid()` ベースだったため、連続生成や同名画像の再インポートで上書きが起き得た。新規実装ではタイムスタンプ＋ランダムサフィックス（またはUUID短縮）を付与する。
3. **複数プロバイダー設定の安全な永続化**:
   - フロントエンド・バックエンドともにプロバイダー別オブジェクト構造を正本とし、保存時にフラット形式へ潰さない。
4. **テスト容易性**:
   - 各プロバイダーアダプタにベースURL / `http.Client` を注入できるようにし、`httptest.Server` による自動テストを最初から組み込む。
5. **非ブロッキング通知**:
   - `window.alert()` による操作中断を減らし、トースト通知＋確認ダイアログ（`ConfirmDialog`）で一貫したデスクトップ体験を提供する。

## Open Questions / Confirmation Points

実装に入る前にユーザーと確認したい点（現状は仮置きで進めている項目）：

1. **ビジュアルテーマ**: 新規UIのデフォルトテーマはライトモード・ダークモードのどちらを希望するか（現状は視認性の高いニュートラルなライトテーマを基本とし、将来テーマ切替可能なトークン構成を想定）。
2. **UI言語**: 当面はシンプルな日本語UI固定でよいか（将来 i18n を追加しやすいよう文言はある程度まとめる）。
3. **画像保存先**: 現行どおり実行ファイル相対 `Image/`（または設定の絶対パス）を維持するか。
4. **自動レイアウトの方向**: Dagre の既定レイアウト方向は左→右（`LR`、左右コネクタと整合）でよいか。

## Deferred / Future Candidates

- 同一プロバイダー内の複数プロファイル（複数APIキー・モデル切替）。
- 画像ノードからのワンクリック再生成・プロバイダー変更再生成。
- テーマ切替（Light / Dark）と i18n（ja / en）。
- OS キーチェーンによる API Key 保護。
- ストリーミング応答表示。

## Documentation Feedback

- 実装完了後、`docs/claim.md`, `docs/app_requirement.md`, `docs/requirement.md`, `docs/specification.md` を新アーキテクチャに合わせて刷新する。
- `docs/cheatsheet/image_generation_providers.md` は新ファイル名（`backend/provider_*.go`）に合わせて参照パスを更新する。

---

## Plan Review Record（W-REV: 初回計画レビュー r1）

- **レビュー担当**: Lv.3 `fm-dev-reviewer`（subagent `0c8b4ae8-9077-4497-a5f0-60a254c63e20`）
- **対象版**: 改訂案 `r1`（基準親 commit: `70773a33` / `recreating_20261123`）
- **レビュー対象文書**: `10_claim.md`, `20_app_requirement.md`, `30_requirement.md`, `40_specification.md`, `41_work_packages.md`, `42_spec_core_data_security.md`, `42_spec_providers_io.md`, `42_spec_canvas_ui.md`
- **参照基準**: `AGENTS.md`, `docs/cheatsheet/image_generation_providers.md`, `docs/cheatsheet/multimodal_vision.md`
- **次の作業**: `implement` 工程 `WP-1` の開始可否判定（指摘対応モード: 通常）

### 1. 進められる範囲と開始条件

| 範囲 | 進行可否 | 根拠 | 開始条件 |
| --- | --- | --- | --- |
| `W-PACK` → `implement` 工程 `WP-1` | **進行可** | `REQ-01`〜`REQ-15`、`D-001`〜`D-018`、`WP-1`〜`WP-7` の ID 一意性・対応関係に重複・抜け漏れなし。代表シナリオ `S-1`〜`S-5`・反例・失敗/失効動作（`canvasEpoch`・ドラフト確定/破棄・画像欠損・API エラーマスク・パストラバーサル拒否）、既存 `config.json`/`canvas.json` (v1.0/v1.1) 互換、4 プロバイダー API 仕様（cheatsheet 根拠）との不一致なし（`Critical: 0`, `Must-fix: 0`）。 | `W-PACK` にて `env_manifest.md`・`60_review_packet.md`・`90_status.md` 最終化を完了し `ready` 返却すること。 |
| `WP-2`・`WP-4`（並列区間）〜`WP-7` | **条件付き進行可** | 編集範囲の非競合条件と未確認前提 3 点の判定ゲートが `41_work_packages.md` §2-3 に明確化されている。 | 未確認前提①（`WP-1` での `mise`/Wails/WebView2 ビルド観測）の Go 確定後に `WP-2`・`WP-4` を開始。前提②（`WP-3`）および前提③（`WP-6`）の Go（または代替実測解消）を `WP-7` 該当 E2 完了条件とする。 |

### 2. 指摘サマリー

- `Critical`: **0 件**
- `Must-fix`: **0 件**
- `Suggest`: **3 件**（通常モードでは進行阻害とせず記録のうえ見送り可）

### 3. 指摘詳細

```text
所見ID: RV-001
分類 / 対象版 / 対象箇所: Suggest / r1 / docs/plan_20261123_core_rebuild/42_spec_core_data_security.md:"WP-1/WP-4 で実測確認する"
Evidence class / Evidence: E3 / docs/plan_20261123_core_rebuild/41_work_packages.md:"前提②"（観測 WP は WP-3、WP-7 で再確認。WP-4 はフロントエンド純粋関数群）
未実施・未解決: [D-005] 内の注記にある未確認前提②の実測担当 WP 参照（WP-1/WP-4）が、作業計画正本（41_work_packages.md §3 の WP-3/WP-7）とずれている。
次の作業への影響: 実行手順の正本は 41_work_packages.md であるため WP-1 開始や実装の進行は阻害しないが、42_spec_core_data_security.md のみを参照した際に誤読する恐れがある。
対応候補 / 解消を確認する方法: 機会があれば 42_spec_core_data_security.md の該当注記を「WP-3/WP-7 で実測確認する」へ更新する（通常モードでは見送り可）。
```

```text
所見ID: RV-002
分類 / 対象版 / 対象箇所: Suggest / r1 / docs/plan_20261123_core_rebuild/42_spec_canvas_ui.md:"別テキストノード選択時"（および 40_specification.md §4.1 規則 5）
Evidence class / Evidence: E4 / docs/plan_20261123_core_rebuild/30_requirement.md:"REQ-03"・"REQ-06"・"REQ-12"
未実施・未解決: NodeInspector 編集中の未確定ドラフト自動確定は「別ノード切替・閉じる・JSON 保存」で定義済み（REQ-03 充足）。一方で、編集中ノードを選択したまま CommandDock から送信した場合や右クリックから Markdown/Marp エクスポートを実行した場合のドラフト確定タイミングは明示されていない。
次の作業への影響: REQ-03 の受入条件は満たしており進行阻害ではない。ただし WP-6 実装時に送信・エクスポート前にも commitInspectorDraft() を呼ぶと、編集直後の本文がコンテキスト・出力へ確実に反映される。
対応候補 / 解消を確認する方法: WP-6 実装時に CommandDock 送信および単体 Markdown/Marp エクスポート実行前にも commitInspectorDraft() を経由させる（通常モードでは任意改善として見送り可）。
```

```text
所見ID: RV-003
分類 / 対象版 / 対象箇所: Suggest / r1 / docs/plan_20261123_core_rebuild/50_review_notes.md:"Open Questions / Confirmation Points"
Evidence class / Evidence: E3 / docs/plan_20261123_core_rebuild/30_requirement.md:"利用者の判断が必要な矛盾・未決（B）"・docs/plan_20261123_core_rebuild/40_specification.md:"委譲された既定方針の反映"
未実施・未解決: 本ファイル上部の「Open Questions / Confirmation Points」4 点（テーマ・UI 言語・画像保存先・Auto-layout 方向）は初期仮置き記述のままだが、30_requirement.md および 40_specification.md §4.3 で設計委譲の既定方針として確定済み（60_review_packet.md で利用者へ共有予定）。
次の作業への影響: 30/40 が正本であるため進行阻害ではない。
対応候補 / 解消を確認する方法: 60_review_packet.md に既定方針として明記し、利用者へ共有する（本記録により経緯を整理済み）。
```

### 4. 未確認事項（設計・WP ゲートで適切に管理済み）

| 項目 | 影響範囲 | 確認方法 / ゲート参照 |
| --- | --- | --- |
| 前提①: `mise` / Go / Node.js / Wails v2.12・WebView2 ビルド環境 | `WP-2`〜`WP-7` 全般 | `WP-1` 冒頭で実測。Go まで `WP-2` 以降を開始しない（`41_work_packages.md` §3） |
| 前提②: `wails dev` 時の `-tags dev` 付与と `os.Getwd()` 基準 | `REQ-08`/`REQ-09` の `wails dev` パス解決 | `WP-3` で実測、`WP-7` で再確認。不成立時は `path_base_dev.go` に `wails.json` 探索フォールバック（`41_work_packages.md` §3） |
| 前提③: Windows WebView2 上での `EnableFileDrop` / `OnFileDrop` と React Flow 操作の両立 | `REQ-09` 実機 D&D | `WP-6` で実測、`WP-7` で最終確認。両立不能時は `replan_required`（`41_work_packages.md` §3） |
| 実課金外部 API 通信（`REQ-07`, `REQ-08`） | 実キー未提供プロバイダーの最終受け入れ | `30_requirement.md` Verification Scope §3 の `EX` 運用条件（`httptest` E1＋ローカルモック E2＋残存リスク明示・利用者承認）に従う |

### 5. 採否記録（Lv.2 plan leader 記入欄）

- `RV-001` (`Suggest`): **見送り（記録のみ）** — 通常モードのため任意改善として記録。作業計画の正本は `41_work_packages.md` §3（`WP-3`/`WP-7`）であり、`WP-1` 開始および実装進行への阻害なし。
- `RV-002` (`Suggest`): **見送り（`WP-6` 実装時の任意改善メモとして保持）** — `REQ-03` の受入条件は現行設計で充足済み。`WP-6` 実装時に `CommandDock` 送信・エクスポート前の `commitInspectorDraft()` 呼び出しを任意検討可。
- `RV-003` (`Suggest`): **対応済み（`60_review_packet.md` へ反映）** — 4 点の既定方針（ライトテーマ既定トークン、MVP 日本語 UI 固定、`Image/` 相対パス基準、Auto-layout `LR`）を `60_review_packet.md` に明示し、利用者へ共有する形とした。
