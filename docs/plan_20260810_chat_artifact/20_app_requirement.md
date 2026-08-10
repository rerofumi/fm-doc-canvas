# App Requirements

## Purpose

`fm-doc-canvas` に「Artifact ノード」「右ドロワーチャット (ChatDrawer)」「エージェントループ」を導入し、思考整理・小説執筆・プロット作成を 1 つのキャンバスで完結できるようにする。既存 `fm-doc-canvas` のキャンバスパラダイム（ノード配置 + 接続による文脈トラバース）は維持したまま、編集体験を拡張する。

## Target Environment

### Runtime

- **OS**: Windows 10/11 + PowerShell（既存 AGENTS.md と同一）
- **Framework**: Wails v2（既存）
- **Backend**: Go（既存 `app.go`, `backend/llm.go`, `backend/openrouter.go` 等の構造を継承）
- **Frontend**: React 18 + TypeScript + Zustand + Tailwind CSS + `@xyflow/react` 12.x（既存）

### Toolchain

- `mise` 経由で Go, Node.js, Wails CLI を管理（既存 AGENTS.md）
- パッケージマネージャ: `go mod`, `npm`
- VCS: `jj`（既存リポジトリ）

### LLM Provider

- OpenAI 互換 API（既存設定済み）: OpenRouter, OpenAI, Google Generative Language, xAI
- Ollama native tool calling（`fm-image-assistant` の `docs/cheatsheet/ollama-tool-calling.md` で `meromero-26b-vision:latest` 動作確認済み）

### External Integrations（将来）

- `fm-link-stash` MCP サーバー（`POST /mcp/bookmark`）- JSON-RPC 2.0
- `fm-memo-chunk` MCP サーバー - JSON-RPC 2.0
- `fm-image-assistant` `comfyui_generate` tool（HTTP 経由）

## User Experience

### UX1: Artifact ノードの作成・編集

1. ユーザーがアプリ起動すると、最初の空 Artifact ノードが 1 個だけ自動生成される（`# 新しいチャプター` テンプレート入り）。
2. ユーザーは「+ Artifact」ボタンまたはコンテキストメニューから新しい Artifact ノードを追加できる。
3. Artifact ノードをクリックすると、左の `EditorDrawer` が開いて Markdown を編集できる。
4. `EditorDrawer` の Edit / Preview 切替で、編集とレンダリング済みプレビューを切り替えられる（既存 `react-markdown` + `remark-gfm`）。
5. Artifact ノードカードには `filename`, `version`, `charCount`, 末尾 100 字の `summary` が表示される。

### UX2: 右ドロワーチャット

1. ユーザーはヘッダーの � ボタンで右ドロワーの ChatDrawer を開閉できる。
2. ChatDrawer を開いた状態でノードをクリックすると、チャットヘッダー上部にそのノードのファイル名（例: `📝 chapter_01.md`）と version が表示される。
3. チャット入力欄にメッセージを入力して送信すると、右ドロワー内でメッセージが縦に積み上がる。
4. ストリーミング中は、チャットペインの assistant メッセージだけ typewriter 効果で伸びる。キャンバス上のノードは**触らない**。
5. ストリーム完了時に `apply_edit` / `write_artifact` ツールが走った場合、ToolCard がチャットに表示され、その**完了後**にキャンバス上の対象ノードが更新される。
6. `EditorDrawer`（左）が閉じている（`isEditorOpen === false`）時は、`targetNodeId` は null になり、チャットはキャンバス全体に対する対話になる。

### UX3: エージェント編集

1. チャット送信後、エージェントはツールを使って次の操作を実行する:
   - `read_artifact`: 既存ファイルの内容を読む（編集前に必ず呼ぶ）
   - `apply_edit`: search/replace で差分編集
   - `write_artifact`: 新規ファイル作成または全体書き換え
   - `list_artifacts`: ファイル一覧の取得
   - `search_artifact`: 全文検索
2. 各ツール呼び出しはチャット内に ToolCard として可視化される:
   - `apply_edit` の場合は赤緑ハイライトの diff が表示される
   - `write_artifact` の場合は作成されたファイルの概要が表示される
3. ユーザーはストリーミング中に **Stop ボタン**で中断できる。

### UX4: 既存 UI の温存

- `EditorDrawer`（左）、`PromptBar`（下）、`SettingsDrawer` は**変更しない**。
- `PromptBar` は「シンプル送信」として残し、「エージェント重い、ライトに送信したい」時の逃げ道とする。

## MVP Features

### MVP-Sprint A: Artifact ノード（必須）

| ID | 機能 | 優先度 |
|---|---|---|
| F-A1 | Artifact ノードの作成（`+ Artifact` ボタン） | P0 |
| F-A2 | Artifact ノードのクリックで EditorDrawer を開く | P0 |
| F-A3 | EditorDrawer での Markdown 編集・プレビュー切替 | P0 |
| F-A4 | Artifact ノードカードに filename, version, charCount 表示 | P0 |
| F-A5 | CanvasFile V1.2 への save/load 対応（後方互換） | P0 |
| F-A6 | 起動時の最初の空 Artifact ノード自動生成 | P1 |

### MVP-Sprint B: 右ドロワーチャット（必須）

| ID | 機能 | 優先度 |
|---|---|---|
| F-B1 | ChatDrawer（右ドロワー）の開閉 | P0 |
| F-B2 | ChatHeader に編集中ノードのファイル名表示 | P0 |
| F-B3 | MessageList, MessageBubble, ChatInput の動作 | P0 |
| F-B4 | チャットセッションの作成・切替 | P1 |
| F-B5 | ノードクリック時の targetNode 自動連動 | P0 |
| F-B6 | Wails SendChat スタブ（echo） | P0 |

### MVP-Sprint C: エージェントループ（必須）

| ID | 機能 | 優先度 |
|---|---|---|
| F-C1 | エージェントループ（最大 10 ステップ） | P0 |
| F-C2 | 5 種類のツール実装（write/apply/read/list/search） | P0 |
| F-C3 | ストリーミングイベント送出（Wails EventsEmit） | P0 |
| F-C4 | フロントエンド側 EventsOn フック | P0 |
| F-C5 | apply_edit 完了時のキャンバス反映 | P0 |
| F-C6 | CancellationToken による中断 | P0 |
| F-C7 | システムプロンプト（役割+ツール指示+応答形式） | P0 |

## Future Candidates

### Post-MVP（Sprint D 以降）

| ID | 機能 | 備考 |
|---|---|---|
| F-D1 | 文体プリセット（ラノベ調 / 文芸調 / 脚本調 / カスタム） | Settings に追記、ChatInput にセレクタ追加 |
| F-D2 | Mindmap 整列トグル | `fm-mindmap` の `alignNodes` 移植、`graphUtils.ts` に `autoLayoutAsMindmap` 追加 |
| F-D3 | 進捗カウンター（Artifact ノードカードの文字数目標%） | `ArtifactNodeData` に `targetChars` 追加 |
| F-D4 | キャラクター相関図 | 色分けキャラクターノード + ラベル付き関係エッジ |
| F-D5 | `fm-link-stash` MCP クライアントツール | Web URL の取り込み |
| F-D6 | `fm-memo-chunk` MCP クライアントツール | テキストメモバックエンド |
| F-D7 | `fm-image-assistant` `comfyui_generate` tool 統合 | チャプター挿絵の自動生成 |
| F-D8 | 多言語 UI（英語版） | 既存 `fm-my-canvas/README.en.md` パターンを踏襲 |
| F-D9 | Consistency Check ツール（章またぎ整合性） | 別 LLM での検証、`fm-image-assistant` の `DreamSim` パターンを参考 |

### Out of Scope

- モバイル / タッチ UI
- リアルタイム共同編集（複数ユーザー）
- クラウド同期
- 音声入力・読み上げ
- Web 版（Wails デスクトップのみ）

## Initial Non-Goals

### 短期的にやらないこと

- **チャットセッションのキャンバスファイルへの埋め込み**: セッションは別ファイル（`~/.config/fm-doc-canvas/chat-sessions.json`）に保存する。
- **複数 Artifact ノード横断編集の自動最適化**: 「章 1 と章 3 の整合性を取って」は F-D9 の将来課題。
- **リアルタイム Markdown 共同編集**: シングルユーザー前提。
- **iFrame プレビュー**: ChatGPT Artifact の HTML プレビュー相当は将来候補だが、本 MVP では Markdown レンダリングのみ。
- **チャット UI からの画像生成トリガ**: 別途 PromptBar の `image` モードで実現済み。新規実装しない。
- **チャット UI からのノード新規作成のトリガ**: エージェントループの `write_artifact` で新規 artifact ノードを作成できるが、チャット UI からの明示的な「ノードを作って」コマンドは将来課題。
