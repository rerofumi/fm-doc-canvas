# Claim

## Purpose

`fm-doc-canvas` に「**思考のワークベンチ**」化と「**ChatGPT Artifact 風のエディタ統合**」を一気通貫で導入する。接続ノードを前提文脈として利用し、対象 Artifact をチャットから安全に反復編集でき、保存・再読込後も成果物と会話を継続できる執筆ワークベンチを提供する。具体的には以下の 3 つを縦串で実装する:

1. **Artifact ノード**: 1 ノード = 1 論理 Markdown 文書として内容をノード内に保持する新しいキャンバスノードタイプ。Markdown としてエクスポートでき、ノード上では Markdown 装飾をレンダリングし、EditorDrawer では pure text の Markdown として編集できる。小説 / プロット / 長文ドキュメントをチャプターごとに構造化する。
2. **右ドロワーチャット (ChatDrawer)**: 既存 `EditorDrawer`（左）と対称な右ドロワー。編集中（フォーカス中）のノードはチャット対象として自動連動し、そのノードが保持する情報を直接コンテキストへ渡す。
3. **エージェントループ**: 既存の `backend/llm.go` を tool calling 対応に拡張し、`write_artifact` / `apply_edit` / `read_artifact` / `list_artifacts` / `search_artifact` の編集・検索ツールに加え、キャンバス上の任意ノードを必要に応じてコンテキストへ取り込むツールを提供する。`fm-image-assistant` の `docs/cheatsheet/ollama-tool-calling.md` で確立された「役割 + ツール使用指示 + 結果後の応答形式（自然文、JSON 禁止）」のシステムプロンプト設計を継承する。

これにより、コードエディタ + コーディングエージェントで行っていた小説執筆・プロット作成を、キャンバスの構造とチャットによる反復編集を往復できる体験へ置き換える。思考の入口をチャットに置きながら、得られた内容をノードとして構造化し、エージェントに編集を任せられる統合キャンバスへ進化させる。

## Target Experience / Core Behavior

### Text / Artifact ノード

- ノード自身が Markdown の source text を保持する。
- ノード上では Markdown 装飾をレンダリングして内容を読める。
- EditorDrawer では Markdown を pure text として直接編集できる。
- 内容は Markdown ファイルとしてエクスポートできる。
- チャットからの `write_artifact` / `apply_edit` により内容を編集・更新できる。

### Image ノード

- ノード自身が画像と、その画像に対応する生成プロンプトを保持する。
- ノード上でプロンプトを確認し、コピーして再利用できる。
- チャットのコンテキストとして渡す場合は、画像とプロンプトを対になる情報として扱う。

### Chat / Agent Context

- 編集中（フォーカス中）のノードは、ユーザーが追加指定しなくてもチャットの直接コンテキストへ含める。
- ノードの接続関係は、そのノードに至る前提文脈を構成するために利用する。
- フォーカス中ノードと接続文脈だけでは不足する場合、エージェントはキャンバス上の任意ノードを読み込むツールを使い、必要な情報だけを追加コンテキストとして取得する。
- テキスト系ノードからは Markdown source text、Image ノードからは画像とプロンプトを取得する。

## Background

### 現状の制約

- 既存 `fm-doc-canvas` は **Wails v2 + React Flow + Zustand + Go** で構築され、テキストノード / 画像ノードを `traverseContextBackwards` で遡ってコンテキスト化する仕組みを持つ。
- `backend/llm.go` の `ChatCompletionRequest` には `Tools []interface{}` 型フィールドが**定義されているが実際には使われていない**。つまり tool calling を組み込める足場だけはある。
- LLM 呼び出しは **1 ショット**で、エージェントループは持たない。チャット履歴 / セッション管理も存在しない。
- キャンバスは「ノードを配置して接続する」体験だけで、「Markdown ファイルをチャプターごとに書く」体験は提供していない。

### 既存資産で再利用できるもの

- **`fm-image-assistant`** (Python, FastAPI): `src/fm_image_assistant/agent/` に `loop.py`, `improvement.py`, `llm_client.py`, `prompts.py`, `tools/` の完全なエージェントループ実装がある。`docs/cheatsheet/ollama-tool-calling.md` で「**システムプロンプト無しで tool calling すると幻覚 JSON が出る**」問題が検証・記録されており、これと同じプロンプト構成を継承する。
- **`fm-mindmap`** (React + Vite + React Flow): `src/components/ChatSidebar.tsx` でチャット履歴のスクロール追従、`src/lib/store.ts` で `chatAndCreateNode`, `getContext` パターン、`src/lib/prompts.ts` でプロンプト集中管理。Mindmap 整列トグル (`autoLayoutAsMindmap`) も今後移植可能。
- **`fm-my-canvas`** (Wails + Svelte + Go): `artifacts/manager.go`, `artifacts/server.go`, `chat.go` で **ArtifactManager の完全な実装**を持つ。`tools/edit_engine.go` の search/replace による `apply_edit` を移植するのが最短経路。`Provider` 抽象、`ToolManager`、`SessionManager` の設計パターンも流用可能。
- **`fm-link-stash`**, **`fm-memo-chunk`**: いずれも **MCP サーバー実装済み**で、`POST /mcp/bookmark` / `POST /mcp/memo` で JSON-RPC 2.0 経由でアクセスできる。`fm-doc-canvas` 側では MCP クライアントツールを書くだけで情報源として接続可能。

### 思考スタイルとの整合

`docs/claim.md` に記載された `fm-doc-canvas` のコンセプト「ノード間の接続関係を前提文脈として明示する」と、エージェントループ + Artifact 編集は**直交しない**。むしろ:
- ノード接続 = 思考の構造（依存関係・前提の明示）
- Artifact 編集 = 思考の内容（チャプターの執筆・推敲）

の両方を 1 つのキャンバス上で扱えるようになり、コンセプトを**強化**する方向。

## Problem

### 思考の摩擦

`思考整理ツール振り返り`（BotMemo）で分析されたように、`fm-doc-canvas` は「テキストベースの情報構築もやりやすくはあるんだけれども、やっぱり課題は検索、調査、質問から始まることが多いのでいきなりこのアプリを開こうとならない」という課題を持つ。LLM への質問・編集をチャット履歴の中で繰り返しながらキャンバスに反映する体験が必要。

### 小説・プロット執筆の代替

`rerofumi` はこれまで小説執筆・プロット作成にコードエディタ + コーディングエージェントを使っていた。これを `fm-doc-canvas` で代替するには、ChatGPT Artifact のように「チャットのやりとりで 1 つの Markdown を段階的に編集していく」体験が必要。

### 既存ツールとの重複回避

- `fm-mindmap` が Mindmap + チャットを持っている
- `fm-image-assistant` が画像用のエージェントループを持っている
- `fm-my-canvas` が Artifact 編集のエージェントを持っている

これらを「置き換える」のではなく、`fm-doc-canvas` に「**良い形にアレンジ**」して統合する。各ツールは今後も独立した軽量ツールとして残す。

## Target Users / Environment

### Primary users

- Wails が動作するデスクトップ環境で、ローカル LLM（Ollama）と外部 LLM API（OpenRouter / OpenAI / Google / xAI）を使い分ける利用者。
- 思考整理・小説執筆・プロット作成を 1 つのキャンバス上で行いたい利用者。
- 既存の `fm-doc-canvas` のキャンバスパラダイムに慣れた利用者。

### Environment

- **OS**: Windows + PowerShell（既存 AGENTS.md と同じ）
- **Toolchain**: `mise` 経由で Go, Node.js, Wails CLI（既存 AGENTS.md と同じ）
- **VCS**: `jj`（既存リポジトリが jj 管理）
- **Backend**: Wails v2 + Go
- **Frontend**: React 18 + TypeScript + Zustand + Tailwind CSS + `@xyflow/react` 12.x
- **LLM**: OpenAI 互換 API（OpenRouter / OpenAI / Google / xAI）、および Ollama の tool calling 対応モデル

### Out of immediate scope (将来検討)

- モバイル対応
- リアルタイム共同編集
- 音声入力・読み上げ

## Initial Scope

### Sprint A: Artifact ノード（最小実装）

- `ArtifactNodeData` 型を `frontend/src/types/index.ts` に追加
- `ArtifactNode.tsx` を新規作成（`CustomNode.tsx` を踏襲）
- `CanvasArea.tsx` の `nodeTypes` に `artifactNode` を登録
- `useAppStore.ts` に `addArtifactNode`, `updateArtifactContent`, `incrementArtifactVersion`, `setArtifactLastEditSummary` アクションを追加
- `EditorDrawer.tsx` に artifact モード分岐を追加（ヘッダーにファイル名表示、フッターに文字数表示）
- `App.tsx` ヘッダーに「+ Artifact」ボタンを追加
- `CanvasFileV1_2` への後方互換のある save/load 対応

### Sprint B: 右ドロワー ChatDrawer

- `useChatStore.ts` を新規作成（`useAppStore` と分離してチャット履歴の頻繁な更新がキャンバスの再レンダリングを引き起こさないように）
- `ChatDrawer.tsx` を新規作成（`EditorDrawer` の構造を踏襲: resize / transform / z-index / ヘッダー / フッター）
- `ChatHeader.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `ToolCard.tsx`, `ChatInput.tsx` を新規作成
- `App.tsx` に `ChatDrawer` を配置し、`activeNodeId` 連動の `setTarget` useEffect を追加
- チャット送信時に、編集中ノードとその接続元ノードから直接コンテキストを構成する
- `ChatToggleButton.tsx` を新規作成（ヘッダーの 💬 ボタン）
- Wails `SendChat` のスタブ実装（まだ LLM は呼ばず echo するだけ）

### Sprint C: エージェントループ導入

- `backend/chat_service.go` を実装（`fm-image-assistant` の `loop.py` を Go に移植、`CancellationToken` 付き、最大 10 ステップ）
- `backend/system_prompt.go` を実装（役割 + ツール指示 + 結果後の応答形式は自然文、JSON 禁止）
- `backend/agent/tools/*.go` を実装:
  - `write_artifact`（全体書き換え）
  - `apply_edit`（search/replace、`fm-my-canvas` の `tools/edit_engine.go` から移植）
  - `read_artifact`
  - `list_artifacts`
  - `search_artifact`
  - キャンバス上の任意ノードを追加コンテキストとして読み込むツール（名称・入出力は Requirements / Specification で確定）
- Wails `EventsEmit` でストリームイベント送信（`chat:stream`, `chat:tool_start`, `chat:tool_done`, `chat:done`, `chat:cancelled`）
- フロントエンドの `EventsOn` フックを完成
- `apply_edit` 完了時のキャンバス反映ロジックを完成（ToolCard 表示後にノード更新）

## Initial Technical Hypotheses

- `ArtifactNodeData` を `TextNodeData` / `ImageNodeData` と並ぶ `NodeData` の union に追加するだけで、`CanvasArea.tsx` の `nodeTypes` 登録だけで動作する（React Flow の `NodeTypes` が `Record<string, ComponentType>` を持つため）。
- `EditorDrawer.tsx` の既存 Markdown 編集・プレビュー構造は `artifactNode` でもそのまま再利用できる（`isEditMode` フラグ + `react-markdown` + `remark-gfm`）。追加変更は「ヘッダーにファイル名表示」「フッターに文字数表示」程度。
- `useChatStore` を `useAppStore` と分離することで、チャット履歴の頻繁な更新がキャンバスコンポーネントの不要な再レンダリングを引き起こさない（Zustand の selector ベース購読）。
- `fm-image-assistant` の `docs/cheatsheet/ollama-tool-calling.md` で確立された「**役割 + ツール使用指示 + 結果後の応答形式（自然文、JSON 禁止）**」のプロンプト構成は、`fm-doc-canvas` の `backend/system_prompt.go` でもそのまま機能する（Ollama の native tool calling 仕様は OpenAI 互換 API と共通のため）。
- `apply_edit` ツールの search/replace は `fm-my-canvas` の `tools/edit_engine.go` のロジックを Go に書き直すだけで実装できる（パターンマッチ + 単一置換 / 全置換フラグ）。
- Wails の `EventsEmit` / `EventsOn` は `fm-image-assistant` の `EventsEmit("llm-event")` で実証済みのため、新規パターンなし。
- 既存の `CanvasFileV1_0` / `V1_1` は `V1_2` への移行時に `nodes` 配列を `PersistedArtifactNode` を含む union として扱えば後方互換を保てる。

## Uncertainties

### 技術的不確実性

1. **Ollama tool calling の `apply_edit` 挙動**: `fm-image-assistant` の検証では `comfyui_generate` など「値を返す」ツールは検証済みだが、search/replace でファイルを変更するツールは新規実装のため、Ollama モデル（特に `meromero-26b-vision` 以外）が引数スキーマを正しく解釈できるかは要検証。
2. **Wails の `EventsEmit` のバッファリング**: ストリーミング中の `chat:stream` イベントが高頻度で発生する場合に、Go → TypeScript 間のイベントキュー詰まりが起きないか要確認。
3. **React 18 の `ReactMarkdown` と大容量 Markdown のレンダリング**: チャプター単位の Markdown（数万字）を `EditorDrawer` で編集・プレビューした時のパフォーマンスは要検証。必要なら `react-virtualized` などで仮想スクロール化。

### 設計的不確実性

4. **チャットセッションの永続化先**: 既存の `CanvasFile` には含めず、別ファイル（`~/.config/fm-doc-canvas/chat-sessions.json`）に保存するのが綺麗だが、Canvas ファイルと chat session を 1 つの「プロジェクト」として扱う需要が発生する可能性がある。
5. **複数 Artifact ノードにまたがる編集**: 1 ノード = 1 論理 Markdown 文書が基本だが、「章 1 と章 3 の整合性を取って」のような複数 artifact 編集を `apply_edit` でどう表現するかは要検討。任意ノードの読み込みはコンテキスト取得までとし、複数ノードへの同時書き込みを許可するかは Requirements / Specification で決定する。
6. **ストリーミング中の `apply_edit` 競合**: ストリーム完了前の `chat:tool_done` で部分的に `apply_edit` が走った場合に、キャンバス上のノード更新が連鎖してレースコンディションが起きないか要検証。

### ユーザビリティ不確実性

7. **「対象」自動連動の明示性**: ノードをクリックしたら自動でチャット対象になるのは便利だが、「クリック前はチャット対象だった別ノードとの会話履歴が切り替わる」挙動が混乱を生まないか。
8. **ストリーミング中の UI 反応**: 「ストリーミング中はチャットだけ更新、完了時にキャンバス反映」という方針は、ユーザーが「今 LLM が何を書いているか」を把握できるかどうかで成否が分かれる。

## Next Documents

1. `20_app_requirement.md` - プロダクト要求・対象環境・MVP 機能・将来候補
2. `30_requirement.md` - 機能要件 / 非機能要件 / REQ ID 採番 / 検証方法
3. `40_specification.md` - 実装仕様 / WP 分割 / トレーサビリティ
4. `50_review_notes.md` - レビュー指摘 / 却下案 / 将来のプラン候補
5. `90_status.md` - 受理テーブル / 実装者ステート / 証拠
