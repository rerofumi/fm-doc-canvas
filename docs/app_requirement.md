# App Requirements

## Purpose

利用者がノードベースのキャンバスで情報を整理し、選択ノードと接続関係を元に AI と対話しながら、文書の作成・編集と生成結果の追加を行えるデスクトップアプリケーションを提供する。

## Target Environment

- Runtime: Wails v2 desktop application.
- Backend: Go.
- Frontend: React, TypeScript, Vite, React Flow, Zustand, Tailwind CSS.
- Toolchain: `mise.toml` に定義された Go と Node.js。開発コマンドは `mise run` または `mise x --` 経由で実行する。

## User Experience

- 起動時に空キャンバスであれば初期 Artifact ノードを 1 つ追加する。
- ヘッダーから新規 Text / Artifact ノード追加、オートレイアウト、ChatDrawer、設定ドロワ表示を行える。
- Text / Artifact ノードはクリックで選択し、ダブルクリックで左側エディタドロワを開く。
- 画像ノードはキャンバス上で表示し、ダブルクリックでオーバーレイ表示できる。
- 画面下部のプロンプトバーで Text / Image モードを切り替え、選択中ノードを文脈として生成できる。
- 右側の ChatDrawer では、対象ノードと接続元を直接文脈にし、必要に応じて Canvas 上の別ノードを tool で読ませながら AI と対話できる。
- ChatDrawer から AI が提案した Text / Artifact 編集は、revision が一致する場合だけ Canvas へ適用する。
- チャットセッションは Canvas ごとに分離して保持し、明示的に切り替えられる。
- 右クリックメニューからノード/エッジ削除、ノード単体エクスポート、選択ノードの Marp エクスポートを実行できる。

## MVP Features

- テキストノードの Markdown 編集とプレビュー。
- Artifact ノードの Markdown 編集、プレビュー、filename / summary / count 表示、Markdown export。
- LLM によるテキスト生成と要約生成。
- ChatDrawer のセッション管理、ストリーミング応答、Stop、ToolCard 表示。
- request-local Canvas snapshot と、任意ノードの列挙・検索・読込、Text / Artifact の競合安全な編集を行う agent loop。
- 画像生成プロバイダの選択と画像ノード生成。
- 画像ノードを参照画像としてテキスト生成または画像生成に利用。
- キャンバス JSON の保存/読込。
- Canvas file V1.2 の `canvasId` と Artifact 永続化、V1.0 / V1.1 読込互換。
- Canvas ごとのチャットセッション永続化。
- テキストファイルと画像ファイルのインポート。
- Markdown、画像、Marp Markdown のエクスポート。

## Non-Goals

- キャンバスの自動保存。
- API キーの暗号化保存。
- 複数ユーザーの共同編集。
- プロジェクトファイル形式以外の完全な互換性保証。
