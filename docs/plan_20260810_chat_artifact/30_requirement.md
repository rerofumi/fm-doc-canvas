# Requirements

## Scope

本計画は `fm-doc-canvas` のフロントエンド（`frontend/src/`）とバックエンド（`backend/`, `app.go`, `chat.go`）の両方に変更を加える。既存コードベースに対する非互換変更は `CanvasFile` のバージョン番号（V1_2 追加）で吸収し、後方互換を保つ。

新機能の追加範囲:
1. `ArtifactNodeData` 型の追加
2. `ArtifactNode.tsx` コンポーネントの追加
3. `CanvasArea.tsx` の `nodeTypes` 登録追加
4. `EditorDrawer.tsx` の artifact モード分岐追加
5. `useAppStore.ts` のアクション追加
6. `App.tsx` のヘッダー「+ Artifact」ボタン追加
7. `useChatStore.ts` 新規
8. `ChatDrawer.tsx` および `components/chat/` 配下の新規
9. `backend/chat_service.go` および `backend/agent/` 配下の新規
10. `backend/system_prompt.go` 新規
11. `backend/app.go` の `SendChat` / `CancelChat` メソッド追加
12. Wails イベント定義（`chat:stream`, `chat:tool_start`, `chat:tool_done`, `chat:done`, `chat:cancelled`）

## Functional Requirements

### Sprint A: Artifact ノード

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-A01 | ユーザーは「+ Artifact」ボタン押下で、新規 Artifact ノードがキャンバスに追加される | UI 操作 + DevTools で nodes 配列確認 | E2 |
| REQ-A02 | Artifact ノードは filename, language="markdown", content, summary, version, charCount, wordCount, lastEditedAt を data に持つ | `ArtifactNodeData` 型定義の型チェック | E1 |
| REQ-A03 | Artifact ノードをクリックすると、EditorDrawer が開いて Markdown 編集できる | UI 操作（クリック → textarea 表示） | E2 |
| REQ-A04 | EditorDrawer の Edit / Preview 切替で、編集と react-markdown プレビューを切り替えられる | UI 操作（プレビュー表示確認） | E2 |
| REQ-A05 | Artifact ノードカードに filename (バッジ), version, charCount (区切り文字付き) が表示される | UI スクリーンショット | E2 |
| REQ-A06 | `updateArtifactContent` 呼び出し時に charCount と wordCount が自動再計算される | unit test または手動確認 | E1 or E2 |
| REQ-A07 | CanvasFile V1.2 で PersistedArtifactNode を永続化できる | save → load ラウンドトリップで復元 | E1 |
| REQ-A08 | CanvasFile V1.0 / V1.1 を読み込んだ時もエラーなく開ける（後方互換） | 既存 V1_1 ファイル読み込みテスト | E1 |
| REQ-A09 | 起動時に空の Artifact ノードが 1 個自動生成される（`# 新しいチャプター` テンプレート） | UI 操作（アプリ起動時のキャンバス状態確認） | E2 |
| REQ-A10 | Artifact ノードは Text ノード / Image ノードと接続できる（Handle 互換） | UI 操作（ドラッグ接続） | E2 |

### Sprint B: 右ドロワーチャット

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-B01 | ChatDrawer（右ドロワー）をヘッダーの 💬 ボタンで開閉できる | UI 操作（ボタン押下 → translate-x 動作） | E2 |
| REQ-B02 | ChatHeader 上部に編集中ノードの filename と version バッジが表示される | UI スクリーンショット | E2 |
| REQ-B03 | ノードが選択されていない時は ChatHeader に「キャンバス全体（対象未選択）」と表示される | UI スクリーンショット | E2 |
| REQ-B04 | ChatHeader のセッションセレクタでチャットセッションを切り替えられる | UI 操作（ドロップダウン → 別セッション表示） | E2 |
| REQ-B05 | 「+ New」ボタンで新しいセッションを作成できる | UI 操作（ボタン押下 → 新規セッション追加） | E2 |
| REQ-B06 | ChatInput に入力したメッセージが Enter で送信できる（Shift+Enter で改行） | UI 操作（キーボード入力） | E2 |
| REQ-B07 | ストリーミング中は assistant メッセージに typewriter 効果（カーソル点滅）が表示される | UI スクリーンショット | E2 |
| REQ-B08 | ストリーミング中は ✕ Stop ボタンが表示され、押下でキャンセルできる | UI 操作（Stop 押下 → `chat:cancelled` イベント） | E2 |
| REQ-B09 | ノードを切り替えると targetNodeId も自動更新される | UI 操作（別ノードクリック → ChatHeader 表示変更） | E2 |
| REQ-B10 | EditorDrawer が閉じている時は targetNodeId が null になる | UI 操作（EditorDrawer 閉じる → ChatHeader 表示変更） | E2 |
| REQ-B11 | SendChat スタブ実装が echo で動作する（実際の LLM は呼ばない） | バックエンドログ + UI 表示 | E2 |

### Sprint C: エージェントループ

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-C01 | エージェントループは最大 10 ステップで停止する | unit test（モック LLM で 11 ステップ試行） | E1 |
| REQ-C02 | 各ツール（write_artifact, apply_edit, read_artifact, list_artifacts, search_artifact）が個別に動作する | unit test（各ツールの Execute 動作確認） | E1 |
| REQ-C03 | apply_edit の search/replace が正しく動作する（`fm-my-canvas` の `edit_engine` 移植） | unit test（正常系・異常系・複数候補系） | E1 |
| REQ-C04 | LLM 呼び出しがキャンセル可能（`CancellationToken` 経由） | unit test または手動確認 | E1 or E2 |
| REQ-C05 | ストリーミング中のテキストチャンクが `chat:stream` イベントで逐次送信される | UI 操作（typewriter 表示 + DevTools イベントログ） | E2 |
| REQ-C06 | ツール呼び出しが `chat:tool_start` / `chat:tool_done` で送出される | UI 操作（ToolCard 表示 + DevTools イベントログ） | E2 |
| REQ-C07 | ストリーム完了時に `chat:done` が送出され、isStreaming が false になる | UI 操作（カーソル点滅停止） | E2 |
| REQ-C08 | システムプロンプトに「役割 + ツール使用指示 + 結果後の応答形式（自然文、JSON 禁止）」が含まれる | `system_prompt.go` の静的検査 | E3 |
| REQ-C09 | apply_edit 完了後、対応する Artifact ノードの content, version, lastEditSummary が更新される | UI 操作（ToolCard 完了 → ノードカード更新確認） | E2 |
| REQ-C10 | write_artifact 完了後、新規 Artifact ノードがキャンバスに追加される（既存ノードがなければ） | UI 操作（ToolCard 完了 → 新規ノード表示確認） | E2 |
| REQ-C11 | apply_edit の diff（赤緑ハイライト）が ToolCard に表示される | UI スクリーンショット | E2 |
| REQ-C12 | Ollama tool calling 対応モデルで apply_edit が正しく動作する | Ollama 環境での実機動作確認 | E2 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-N01 | 既存キャンバス JSON（V1_1）を開いた時に V1_2 にマイグレーションされ、エラーなく編集可能 | 既存サンプルファイル読み込みテスト | E1 |
| REQ-N02 | 起動時間が既存ビルドと比べて 1.5 倍を超えない（Artifact ノード 1 個 + チャット初期化込み） | `wails build` 後のアプリ起動時間測定 | E2 |
| REQ-N03 | チャットストリーミング中の UI 操作（ノード移動、ドロワー開閉）が遅延なく応答する | 体感 + DevTools Performance プロファイル | E4 |
| REQ-N04 | `mise x -- wails build` が成功する | build コマンドの exit code 0 確認 | E1 |
| REQ-N05 | `mise x -- npm run lint` が成功する（既存 ESLint 設定） | lint コマンドの exit code 0 確認 | E1 |
| REQ-N06 | API キー等の秘密情報は `backend/config` 経由で読み込まれ、Git にコミットされない | リポジトリ grep で `apiKey:` 直書きがないこと | E3 |
| REQ-N07 | Markdown レンダリングが XSS に対して安全（`react-markdown` のデフォルト挙動） | 既知 XSS ペイロードの入力テスト | E1 |
| REQ-N08 | チャット履歴がアプリ再起動後も永続化される（`~/.config/fm-doc-canvas/chat-sessions.json`） | 再起動テスト | E2 |
| REQ-N09 | エージェントループの `maxSteps=10` を超えない（暴走防止） | unit test + 仕様書の定数確認 | E1 |

## Constraints

- **AGENTS.md**: 既存の `mise x -- <command>` 規約に従う。`go`, `npm`, `wails` を直接実行しない。
- **既存ファイルの後方互換**: `CanvasFileV1_0` / `V1_1` を読み込める状態を維持する。
- **既存 UI の非破壊**: `EditorDrawer`, `PromptBar`, `SettingsDrawer` の公開挙動を変更しない。
- **LLM プロンプト**: `fm-image-assistant` の `docs/cheatsheet/ollama-tool-calling.md` で確立された「**ツール結果後の応答は自然文のみ、JSON 出力禁止**」を必ず `system_prompt.go` に含める。
- **既存パッケージマネージャ**: Go は `go mod`, Node は `npm`（既存 `package-lock.json` が存在するため）。

## Compatibility

### Canvas File 互換性

- **V1_0** → V1_2 への読込: マイグレーション不要（`PersistedTextNode[]` は `PersistedNode[]` の subtype）。
- **V1_1** → V1_2 への読込: マイグレーション不要（`PersistedTextNode | PersistedImageNode` は `PersistedNode` の subtype）。
- **V1_2** → V1_0 / V1_1 への書き出し: **非対応**（`artifactNode` を含む V1_2 を旧バージョンで開こうとするとエラー表示）。

### API 互換性

- 既存の Wails バインディング（`App.GenerateText`, `App.GenerateImage`, `App.GenerateSummary` 等）は変更しない。
- 新規バインディング（`App.SendChat`, `App.CancelChat`）を追加する。
- 既存の `useAppStore` の API シグネチャは変更しない。新規アクションを追加する。
- `useChatStore` は新規追加で、既存の `useAppStore` とは独立。

### Node 互換性

- 既存 `customNode`（Text ノード）と `imageNode`（Image ノード）の挙動・表示は変更しない。
- `artifactNode` を新規追加し、既存の `nodeTypes` マップに登録する。

## Verification / Completion Conditions

### Build

- `mise x -- wails build` が exit code 0 で完了する
- フロントエンドのアセットが `frontend/dist/` に生成される
- Wails の `embed.FS` でフロントエンドがバインドされる

### Typecheck

- `mise x -- npm run lint` が exit code 0 で完了する（TypeScript の型エラーなし）
- Go の `go build ./...` がエラーなく完了する（明示的な確認が必要であれば `mise x -- go build ./...` を実行）

### Unit test

- `backend/agent/tools/*.go` の `apply_edit` に対する unit test が pass する
- `backend/chat_service.go` のループ上限・キャンセル処理に対する unit test が pass する

### Core E2E in scope: yes

### Core E2E REQ IDs

- REQ-A01〜A10: UI 動作確認（Artifact ノード）
- REQ-B01〜B11: UI 動作確認（ChatDrawer）
- REQ-C05〜C07, C09〜C12: ストリーミングとツールカード動作確認
- REQ-N01: 既存キャンバス JSON のマイグレーション

E2E テストフレームワークは `fm-doc-canvas` には**未導入**。本 MVP では手動 UI 確認 + DevTools イベントログで代替する。Playwright 等の導入は Sprint D 以降の将来課題。

## Out of Scope

- モバイル / タッチ UI
- リアルタイム共同編集
- 音声入力・読み上げ
- iFrame プレビュー（HTML / CSS / JS artifact）
- 文体プリセット（Sprint D）
- Mindmap 整列トグル（Sprint D）
- 進捗カウンター（Sprint D）
- キャラクター相関図（Sprint D）
- 外部 MCP 統合（fm-link-stash, fm-memo-chunk, fm-image-assistant）- Sprint D
- 多言語 UI
- Consistency Check ツール

## Acceptance Criteria

- 各 REQ に verification method と evidence class が割り当てられている
- 直接検証できない要件は EX として reason, fallback verification, residual risk, decision condition を記録する（本計画では EX の要件は無い見込み）
- `90_status.md` の受理テーブルに全 REQ 行が初期化されている
- 実装セッションは implementer state と evidence のみ更新し、acceptance 列には記載しない
- 受理セッション（または人間）が acceptance 列を埋めて、`state: done` を宣言する
