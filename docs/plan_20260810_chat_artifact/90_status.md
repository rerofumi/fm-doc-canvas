# Status

state: planned  # planned / implementing / accepting / done / abandoned

tier: Full
plan: plan_20260810_chat_artifact

## Acceptance Table

### Sprint A: Artifact ノード

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-A01 | 「+ Artifact」ボタンで新規 Artifact ノードがキャンバスに追加される | UI 操作 + DevTools で nodes 配列確認 | E2 | WP-A4 | todo | - | - |
| REQ-A02 | Artifact ノードが filename, language, content, summary, version, charCount, wordCount, lastEditedAt を data に持つ | `ArtifactNodeData` 型定義の型チェック | E1 | WP-A1 | todo | - | - |
| REQ-A03 | Artifact ノードクリックで EditorDrawer が開いて Markdown 編集できる | UI 操作（クリック → textarea 表示） | E2 | WP-A3 | todo | - | - |
| REQ-A04 | Edit / Preview 切替で編集と react-markdown プレビューを切り替えられる | UI 操作（プレビュー表示確認） | E2 | WP-A3 | todo | - | - |
| REQ-A05 | Artifact ノードカードに filename, version, charCount が表示される | UI スクリーンショット | E2 | WP-A2 | todo | - | - |
| REQ-A06 | `updateArtifactContent` 呼び出し時に charCount と wordCount が自動再計算される | unit test または手動確認 | E1 | WP-A2 | todo | - | - |
| REQ-A07 | CanvasFile V1.2 で PersistedArtifactNode を永続化できる | save → load ラウンドトリップ | E1 | WP-A5 | todo | - | - |
| REQ-A08 | CanvasFile V1.0 / V1.1 を読み込んだ時もエラーなく開ける | 既存 V1_1 ファイル読み込みテスト | E1 | WP-A5 | todo | - | - |
| REQ-A09 | 起動時に空の Artifact ノードが 1 個自動生成される | UI 操作（アプリ起動時のキャンバス状態確認） | E2 | WP-A4 | todo | - | - |
| REQ-A10 | Artifact ノードは Text / Image ノードと接続できる | UI 操作（ドラッグ接続） | E2 | WP-A2 | todo | - | - |

### Sprint B: 右ドロワーチャット

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-B01 | ChatDrawer をヘッダーの 💬 ボタンで開閉できる | UI 操作 | E2 | WP-B1 | todo | - | - |
| REQ-B02 | ChatHeader 上部に編集中ノードの filename と version バッジが表示される | UI スクリーンショット | E2 | WP-B2 | todo | - | - |
| REQ-B03 | ノード未選択時は ChatHeader に「キャンバス全体（対象未選択）」と表示される | UI スクリーンショット | E2 | WP-B2 | todo | - | - |
| REQ-B04 | セッションセレクタでチャットセッションを切り替えられる | UI 操作 | E2 | WP-B2 | todo | - | - |
| REQ-B05 | 「+ New」ボタンで新しいセッションを作成できる | UI 操作 | E2 | WP-B2 | todo | - | - |
| REQ-B06 | Enter で送信、Shift+Enter で改行できる | UI 操作 | E2 | WP-B3 | todo | - | - |
| REQ-B07 | ストリーミング中は assistant メッセージに typewriter 効果が表示される | UI スクリーンショット | E2 | WP-B3 | todo | - | - |
| REQ-B08 | ストリーミング中は ✕ Stop ボタンが表示され、押下でキャンセルできる | UI 操作 | E2 | WP-B3 | todo | - | - |
| REQ-B09 | ノード切り替えで targetNodeId も自動更新される | UI 操作 | E2 | WP-B2 | todo | - | - |
| REQ-B10 | EditorDrawer 閉じ時は targetNodeId が null になる | UI 操作 | E2 | WP-B2 | todo | - | - |
| REQ-B11 | SendChat スタブ実装が echo で動作する | バックエンドログ + UI 表示 | E2 | WP-B4 | todo | - | - |

### Sprint C: エージェントループ

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-C01 | エージェントループは最大 10 ステップで停止する | unit test（モック LLM で 11 ステップ試行） | E1 | WP-C3 | todo | - | - |
| REQ-C02 | 各ツールが個別に動作する | unit test | E1 | WP-C2 | todo | - | - |
| REQ-C03 | apply_edit の search/replace が正しく動作する | unit test | E1 | WP-C2 | todo | - | - |
| REQ-C04 | LLM 呼び出しがキャンセル可能 | unit test または手動確認 | E1 | WP-C3 | todo | - | - |
| REQ-C05 | ストリーミング中のテキストチャンクが `chat:stream` イベントで逐次送信される | UI 操作 + DevTools | E2 | WP-C4 | todo | - | - |
| REQ-C06 | ツール呼び出しが `chat:tool_start` / `chat:tool_done` で送出される | UI 操作 + DevTools | E2 | WP-C4 | todo | - | - |
| REQ-C07 | ストリーム完了時に `chat:done` が送出され、isStreaming が false になる | UI 操作 | E2 | WP-C4 | todo | - | - |
| REQ-C08 | システムプロンプトに「役割 + ツール使用指示 + 結果後の応答形式（自然文、JSON 禁止）」が含まれる | `system_prompt.go` の静的検査 | E3 | WP-C1 | todo | - | - |
| REQ-C09 | apply_edit 完了後、対応する Artifact ノードの content, version, lastEditSummary が更新される | UI 操作 | E2 | WP-C4 | todo | - | - |
| REQ-C10 | write_artifact 完了後、新規 Artifact ノードがキャンバスに追加される | UI 操作 | E2 | WP-C4 | todo | - | - |
| REQ-C11 | apply_edit の diff が ToolCard に表示される | UI スクリーンショット | E2 | WP-C4 | todo | - | - |
| REQ-C12 | Ollama tool calling 対応モデルで apply_edit が正しく動作する | Ollama 環境での実機動作確認 | E2 | WP-C5 | todo | - | - |

### Non-Functional

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-N01 | 既存キャンバス JSON（V1_1）を開いた時に V1_2 にマイグレーションされる | 既存サンプルファイル読み込みテスト | E1 | WP-A5 | todo | - | - |
| REQ-N02 | 起動時間が既存ビルドと比べて 1.5 倍を超えない | アプリ起動時間測定 | E2 | (性能測定) | todo | - | - |
| REQ-N03 | チャットストリーミング中の UI 操作が遅延なく応答する | DevTools Performance プロファイル | E4 | (性能測定) | todo | - | - |
| REQ-N04 | `mise x -- wails build` が成功する | build exit code 0 | E1 | (統合検証) | todo | - | - |
| REQ-N05 | `mise x -- npm run lint` が成功する | lint exit code 0 | E1 | (統合検証) | todo | - | - |
| REQ-N06 | API キー等の秘密情報が Git にコミットされない | リポジトリ grep | E3 | (統合検証) | todo | - | - |
| REQ-N07 | Markdown レンダリングが XSS に対して安全 | 既知 XSS ペイロード入力テスト | E1 | WP-A3 | todo | - | - |
| REQ-N08 | チャット履歴がアプリ再起動後も永続化される | 再起動テスト | E2 | WP-B5 | todo | - | - |
| REQ-N09 | エージェントループの maxSteps=10 を超えない | unit test + 仕様書定数 | E1 | WP-C3 | todo | - | - |

## Evidence Class Notes

- **E1**: 自動化された検証コマンドとその出力（test/build/typecheck/core E2E）
- **E2**: 実行時の観察（CLI/API 応答/スクリーンショット/ログ/手動 UI 確認）
- **E3**: 実装ポインタ（ファイル + シンボル/行/diff 抜粋）
- **E4**: 受理セッションまたは人間の判断（UX/コピー/品質項目）
- **EX**: 直接検証不能。reason, fallback verification, residual risk, decision condition を記録

本計画で EX 該当の要件は**なし**。

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| - | - | - | 受理セッション未実施 |

## Abandoned / No-Go Reason

使用しない（`state: abandoned` の場合のみ）。
