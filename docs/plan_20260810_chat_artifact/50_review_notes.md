# Review Notes

## Review Findings

本計画は `fm-dev-process` の Full tier ドキュメントセットとして作成された。実装着手前のレビュー観点をまとめる。

### 1. 既存資産の最大活用

`fm-image-assistant`（Python）の `src/fm_image_assistant/agent/`、`fm-mindmap`（React）の `src/components/ChatSidebar.tsx`, `src/lib/store.ts`, `src/lib/prompts.ts`、`fm-my-canvas`（Wails + Svelte）の `artifacts/manager.go`, `tools/edit_engine.go`, `chat.go` の各実装パターンを Go / React に書き写すことで、ゼロからの設計リスクを最小化している。

#### 検証済み事項

- **`fm-image-assistant` の `docs/cheatsheet/ollama-tool-calling.md`** で「**システムプロンプト無しで tool calling すると content に幻覚 JSON が出る**」問題が検証・記録済み。本計画のプロンプト設計はこれを踏襲する。
- **`fm-image-assistant` の `AGENT_TOOLS` パターン**（`loop.py`）でツール定義とディスパッチの構造が確立済み。
- **`fm-my-canvas` の `tools/edit_engine.go`** の search/replace は文字列マッチベースで実装されている。Go に書き写すだけ。

#### 要追加検証

- **Ollama tool calling の `apply_edit` 挙動**: `fm-image-assistant` の検証は `comfyui_generate`（値を返すツール）のみ。`apply_edit`（ファイル変更ツール）は本計画で新規実装のため、Ollama モデルが `search_text` / `replacement` の引数スキーマを正しく解釈できるかは実装後の動作確認が必要。→ REQ-C12 で実機検証を要件化済み。

### 2. 状態管理のアーキテクチャ判断

`useAppStore`（既存）と `useChatStore`（新規）を分離する設計は、チャット履歴の頻繁な更新がキャンバスコンポーネントの不要な再レンダリングを引き起こさないための意図的な選択。

#### 却下案

- **A. `useAppStore` に統合**: 却下理由: チャット履歴の更新ごとに `nodes`, `edges`, `isEditorOpen`, `activeNodeId`, `config`, `promptInput` 等の購読コンポーネントが再評価される懸念。Zustand の selector ベース購読でも、selector を厳格に管理しないとレンダリング漏れが起きる。
- **B. Redux / Recoil 等の追加ライブラリ**: 却下理由: 既存プロジェクトが Zustand に統一されており、依存追加は避けた。
- **C. React Context**: 却下案: 採用しない。既存が Zustand で統一されており、混在は混乱を招く。

### 3. UI 配置の判断

「右ドロワー」「左ドロワー対称」「対象ノード自動連動」の組み合わせは、既存 `EditorDrawer` のリサイズ / transform / z-index パターンを踏襲することで実装リスクを抑えている。

#### 却下案

- **A. 下部チャットペイン**: 却下理由: 「ChatGPT 風」だが、既存 UI との統一性が低く、`EditorDrawer` の実装パターンを再利用するメリットが活きない。右ドロワーの方が「編集と対話を分離する」意図が UI 上で明確。
- **B. フローティングチャットウィンドウ**: 却下理由: ドラッグ・リサイズ・z-index 管理が複雑化、Canvas 操作との z-index 競合が起きやすい。
- **C. チャットを Artifact ノード内に埋め込む**: 却下理由: 1 ノード 1 ファイルのコンセプトを壊す。

### 4. Markdown レンダリングの判断

「レイアウトが必要になったら拡張する」方針で `react-markdown` のデフォルト挙動に任せる。`remark-gfm` ですでに GitHub Flavored Markdown 対応済み。

#### 却下案

- **A. HTML / CSS / JS の iframe プレビュー**: 却下理由: `fm-my-canvas` の本領だが、本 MVP のスコープ外。Markdown のみで 80% のユースケースをカバーできる。Sprint D 以降の将来候補 F-D9。
- **B. Mermaid 図のインラインレンダリング**: 却下理由: Mindmap 整列トグル（Sprint D）で代替する。チャプター内のフローチャート需要は当面小さい想定。
- **C. 数式レンダリング（KaTeX）**: 却下理由: 技術文書用途は将来候補、現時点では優先度低。

### 5. エージェントループの最大ステップ数の判断

`fm-image-assistant` のチートシートには明示的な上限はないが、`fm-my-canvas` の `chat.go` で `maxToolRounds = 10` が定義されている。本計画もこれに合わせる。

#### 却下案

- **A. 無制限**: 却下理由: 暴走防止がない。`fm-my-canvas` でも 10 で止めている前例あり。
- **B. 5 ステップ**: 却下理由: 「read_artifact → apply_edit」の 2 ステップは最低必要、加えて LLM が自律的にリトライする可能性を考慮すると 10 が妥当。
- **C. 設定可能化**: 却下理由: 本 MVP のスコープ外。Settings に追加するのは Sprint D。

### 6. チャットセッションの永続化判断

別ファイル（`~/.config/fm-doc-canvas/chat-sessions.json`）に保存する。Canvas ファイルとは独立。

#### 却下案

- **A. Canvas ファイル内に埋め込み**: 却下理由: Canvas の save/load サイクルでチャット履歴が意図せず失われる。チャット履歴は「作業中のセッション」であり、Canvas ファイルは「成果物」と性質が違う。
- **B. SQLite 等の DB**: 却下理由: 過剰。JSON ファイルで十分。
- **C. メモリのみ（永続化なし）**: 却下理由: アプリ再起動で履歴が失われるのは UX として許容できない。REQ-N08 で永続化を要件化済み。

### 7. システムプロンプト設計の判断

`fm-image-assistant` で確立された「役割 + ツール使用指示 + 結果後の応答形式（自然文、JSON 禁止）」の 3 要素を必ず含める。

#### 検証済み事項

- `docs/cheatsheet/ollama-tool-calling.md` 検証 1b:
  > システムプロンプト無しで round-trip すると、最終応答の content に幻覚のツール風 JSON（`{"action": "dalle.text2im", ...}`）を出力した。
  > 役割定義 +「ツール結果を受けたら次のツール呼び出しか日本語の自然文で報告する。ツール呼び出し以外で JSON を出力しない」を含むシステムプロンプトを付けると正常化。

## Fixed Items

実装中に以下を修正済み:

- （実装未着手のため、現時点では修正なし）

## Deferred Items

### Sprint D 以降の将来課題

- **F-D1 文体プリセット**: ChatInput にセレクタ追加、Settings にプリセット管理
- **F-D2 Mindmap 整列トグル**: `fm-mindmap` の `alignNodes` 移植
- **F-D3 進捗カウンター**: Artifact ノードに目標文字数設定
- **F-D4 キャラクター相関図**: キャラクターノード + ラベル付きエッジ
- **F-D5 fm-link-stash MCP 連携**: URL 取り込みツール
- **F-D6 fm-memo-chunk MCP 連携**: テキストメモツール
- **F-D7 fm-image-assistant 画像生成ツール**: 挿絵生成
- **F-D9 Consistency Check ツール**: 複数 Artifact 横断整合性検証
- **iFrame プレビュー**: HTML/CSS/JS artifact
- **多言語 UI**: 英語版
- **E2E テストフレームワーク**: Playwright 導入

## Rejected Options

- `useAppStore` へのチャット統合（再却下、§2 参照）
- 下部チャットペイン（§3 参照）
- フローティングチャット（§3 参照）
- iframe プレビューの MVP 組み込み（§4 参照）
- Mermaid / KaTeX の MVP 組み込み（§4 参照）
- エージェントループの無制限 / 5 ステップ（§5 参照）
- Canvas ファイルへのチャット埋め込み（§6 参照）
- システムプロンプトの簡略化（§7 参照、`fm-image-assistant` 検証で幻覚 JSON 問題が確認済みのため必須）

## Current Non-Goals

- モバイル / タッチ UI
- リアルタイム共同編集
- 音声入力・読み上げ
- クラウド同期
- Web 版（Wails デスクトップのみ）

## Future Plans

### 次のプラン候補

1. **plan_chat_artifact_d**: Sprint D 機能（文体プリセット、Mindmap 整列、進捗カウンター、キャラクター相関、外部 MCP 統合）
2. **plan_e2e_framework**: Playwright 導入による E2E テスト自動化
3. **plan_iframe_preview**: HTML/CSS/JS artifact の iframe プレビュー
4. **plan_multilang_ui**: 英語版 UI

## Documentation Feedback

### `docs/claim.md` への反映候補（本 MVP 完了後）

- 「Artifact ノード」「ChatDrawer」「エージェントループ」が利用可能である旨を追記
- 「ローカル LLM（Ollama）対応」の言及を追加

### `docs/requirement.md` への反映候補

- 「Artifact ノード」「チャット編集」「エージェント編集」の各要件セクションを追加

### `docs/specification.md` への反映候補

- 「Artifact ノードのデータモデル」を追加
- 「チャットメッセージのデータモデル」を追加
- 「エージェントループのアーキテクチャ図（Mermaid）」を追加

### `docs/cheatsheet/` への追加候補

- `ollama_tool_calling.md`: `fm-image-assistant` の既存チートシートを `fm-doc-canvas` 用に再構成
- `apply_edit_engine.md`: `fm-my-canvas` の `edit_engine.go` のロジックを Go で再利用するための解説
- `wails_events_pattern.md`: `EventsEmit` / `EventsOn` でのストリーミング配信パターン

## Amend History

- 2026-08-10: 初版作成（本ファイル）
