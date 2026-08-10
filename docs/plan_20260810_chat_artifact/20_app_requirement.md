# App Requirements

## Purpose

`fm-doc-canvas` に「Artifact ノード」「右ドロワーチャット (ChatDrawer)」「エージェントループ」を導入し、接続関係で表した思考構造と、チャットによる Markdown の反復編集を 1 つのキャンバスで往復できるようにする。

編集対象としてフォーカス中のノードは常に直接コンテキストへ含める。接続元ノードは前提文脈として含め、それ以外のノードはエージェントが必要な場合だけツールで読み込む。キャンバス全体を毎回 LLM へ送信しない。

## Target Environment

### Runtime

- **OS**: Windows 10/11 + PowerShell
- **Framework**: Wails v2
- **Backend**: Go（既存のルート `app.go` と `backend/` の構造を継承）
- **Frontend**: React 18 + TypeScript + Zustand 5.x + Tailwind CSS + `@xyflow/react` 12.x

### Toolchain

- `mise` 経由で Go、Node.js、Wails CLI を利用する。
- Go は `go mod`、Frontend は既存の `npm` / `package-lock.json` を利用する。
- VCS は既存の `jj` を利用する。

### LLM Provider

- MVP は既存の OpenAI 互換 API 経路と Ollama tool calling 経路を利用する。
- tool calling とストリーミングの実機確認対象となる provider / model / version は、実装前調査と受理時の証拠に記録する。
- Image ノードのコンテキストは画像参照とプロンプトを対で保持する。選択モデルが画像入力非対応の場合はプロンプトのみを渡し、画像未送信を UI またはログで確認可能にする。

### External Integrations（将来）

- `fm-link-stash` MCP サーバー
- `fm-memo-chunk` MCP サーバー
- `fm-image-assistant` の画像生成 tool

## User Experience

### UX1: Text / Artifact / Image ノード

1. Text ノードと Artifact ノードは Markdown の source text をノード内に保持する。
2. Artifact ノード上では Markdown 装飾をレンダリングして内容を読める。Text ノードのカードは従来どおり Summary を表示する。
3. `EditorDrawer` では Markdown を pure text として直接編集し、Preview へ切り替えられる。
4. Text / Artifact ノードの内容は Markdown ファイルとしてエクスポートできる。
5. Text / Artifact ノードの Markdown source text はチャットから差分編集・更新できる。
6. Artifact ノードは論理 Markdown 文書として `filename`, `summary`, `charCount`, `lastEditSummary` を表示する。`summary` は Canvas カード下部に表示する。`filename` は Canvas 内の表示名兼エクスポート時の既定名であり、外部 `.md` ファイルとの常時同期を意味しない。競合検出用の `revision` は内部値として保持し、UI には表示しない。
7. 新規の空キャンバスを開始した時だけ、`# 新しいチャプター` を持つ Artifact ノードを 1 個生成する。既存 Canvas の読込時には追加しない。
8. Image ノードは画像と生成プロンプトを保持し、ノード上でプロンプトを表示・コピーできる。

### UX2: 右ドロワーチャット

1. ユーザーはヘッダーのチャットボタンで `ChatDrawer` を開閉できる。
2. ノードを編集対象としてフォーカスすると、ChatHeader に対象ノードの種別と識別情報を表示する。Artifact は `filename`、Text は本文の短い先頭表示、Image はプロンプトの短い先頭表示を使う。
3. `EditorDrawer` を閉じた場合はフォーカスを解除し、`targetNodeId` を null にする。この状態では任意ノードを自動送信せず、エージェントが一覧・読込ツールで必要なノードを取得する。
4. フォーカス対象を変更しても、現在のチャットセッションは自動で切り替えない。セッション切替はユーザーが明示的に行う。
5. チャット送信時には、フォーカス中ノードと `traverseContextBackwards` で取得した接続元ノードを直接コンテキストとして渡す。
6. ストリーミング中は assistant メッセージだけを更新し、キャンバス上のノードは変更しない。
7. `apply_edit` / `write_artifact` の結果は ToolCard で diff または概要を表示した後、対象ノードの内部 revision が送信時から変わっていない場合だけ適用する。
8. revision が変わっている場合は自動上書きせず、ToolCard に競合を表示する。

### UX3: エージェント編集

エージェントは次のツールを利用する。

- `read_artifact`: Artifact の source text と revision を読む。既存 Artifact は `read_artifact` または `read_canvas_node` で同じ revision を読んだ後だけ編集できる。
- `apply_edit`: read 済みの Text / Artifact に対して、一意に一致する search/replace で差分編集する。
- `write_artifact`: ユーザーが明示的に新規文書を求めた場合の作成、または read 済み対象 Artifact の全体置換を行う。対象がなく作成指示もない場合は勝手に新規作成しない。
- `list_artifacts`: Artifact の一覧と識別情報を取得する。
- `search_artifact`: Artifact の source text を全文検索する。
- `list_canvas_nodes`: Canvas 内の全ノードについて nodeId、種別、短い識別情報だけを一覧する。本文や画像 binary は返さない。
- `read_canvas_node`: 一覧で選んだ任意の Text / Artifact / Image ノードを追加コンテキストとして読む。Text / Artifact は Markdown source text、Image は画像参照とプロンプトを返す。

ツール呼び出しは ToolCard として可視化する。ユーザーは実行中に Stop できる。Stop 後に未適用の編集結果がキャンバスへ反映されてはならない。

### UX4: セッション継続

- チャットセッションは Canvas 本体とは別のアプリ設定領域へ保存する。
- セッションには `canvasId` を持たせ、Canvas を再読込した時に同じ Canvas の会話だけを復元する。
- メッセージには送信時の `targetNodeId` と target revision を記録し、後から対象を確認できるようにする。

### UX5: 既存 UI の温存

- `EditorDrawer` は Artifact 対応を追加するが、既存 Text / Image ノードの公開挙動を維持する。
- `PromptBar` は既存のシンプル送信経路として維持する。
- `SettingsDrawer` の既存設定と保存形式を壊さない。

## MVP Features

### MVP-Sprint A: ノード編集

| ID | 機能 | 優先度 |
| --- | --- | --- |
| F-A1 | Artifact ノードの作成 | P0 |
| F-A2 | Markdown の表示・pure text 編集・Preview | P0 |
| F-A3 | Markdown export | P0 |
| F-A4 | Artifact の filename / charCount 表示 | P0 |
| F-A5 | Image のプロンプト表示・コピー | P0 |
| F-A6 | CanvasFile V1.2 の save/load と旧版読込 | P0 |
| F-A7 | 空キャンバスだけに初期 Artifact を生成 | P1 |

### MVP-Sprint B: ChatDrawer

| ID | 機能 | 優先度 |
| --- | --- | --- |
| F-B1 | ChatDrawer の開閉・入力・メッセージ表示 | P0 |
| F-B2 | フォーカス中ノードとの target 自動連動 | P0 |
| F-B3 | フォーカス中ノードと接続元ノードの直接コンテキスト化 | P0 |
| F-B4 | セッションの作成・明示的な切替 | P1 |
| F-B5 | run / session / target を識別できるストリーム表示 | P0 |
| F-B6 | Canvas ごとのチャット履歴永続化 | P0 |

### MVP-Sprint C: エージェントループ

| ID | 機能 | 優先度 |
| --- | --- | --- |
| F-C1 | 最大 10 ステップのエージェントループ | P0 |
| F-C2 | Text / Artifact 編集と Artifact 検索の 5 ツール | P0 |
| F-C3 | 任意ノードを発見・取得する `list_canvas_nodes` / `read_canvas_node` | P0 |
| F-C4 | Wails ストリームイベントと ToolCard | P0 |
| F-C5 | revision 照合と Frontend acknowledgment による競合防止 | P0 |
| F-C6 | `context.Context` による中断 | P0 |
| F-C7 | 役割・ツール指示・自然文応答形式を含むシステムプロンプト | P0 |

## Future Candidates

| ID | 機能 | 備考 |
| --- | --- | --- |
| F-D1 | 文体プリセット | Settings / ChatInput |
| F-D2 | Mindmap 整列トグル | `fm-mindmap` の整列処理を検討 |
| F-D3 | 進捗カウンター | 目標文字数 |
| F-D4 | キャラクター相関図 | 関係エッジ |
| F-D5 | `fm-link-stash` MCP 連携 | Web 情報源 |
| F-D6 | `fm-memo-chunk` MCP 連携 | メモ情報源 |
| F-D7 | `fm-image-assistant` 連携 | 挿絵生成 |
| F-D8 | 多言語 UI | 英語版 |
| F-D9 | 複数 Artifact の整合性検査・一括編集 | 章またぎ編集 |

## Initial Non-Goals

- 外部 `.md` ファイルとの常時同期
- 複数 Artifact への原子的な一括編集
- チャットセッションの Canvas JSON への埋め込み
- モバイル / タッチ UI
- リアルタイム共同編集
- クラウド同期
- 音声入力・読み上げ
- HTML / CSS / JS Artifact の iframe プレビュー
- チャット UI からの画像生成
- Web 版

チャットからの新規 Artifact 作成は `write_artifact` で許可するが、専用のコマンド UI は MVP に含めない。
