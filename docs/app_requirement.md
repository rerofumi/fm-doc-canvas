# App Requirements

## Purpose

利用者がノードベースのキャンバスで情報を整理し、選択ノードと接続関係を元に AI 生成結果を追加できるデスクトップアプリケーションを提供する。

## Target Environment

- Runtime: Wails v2 desktop application.
- Backend: Go.
- Frontend: React, TypeScript, Vite, React Flow, Zustand, Tailwind CSS.
- Toolchain: `mise.toml` に定義された Go と Node.js。開発コマンドは `mise run` または `mise x --` 経由で実行する。

## User Experience

- 起動時に空キャンバスであればウェルカム用のテキストノードを 1 つ追加する。
- ヘッダーから新規テキストノード追加、オートレイアウト、設定ドロワ表示を行える。
- テキストノードはクリックで選択し、ダブルクリックで左側エディタドロワを開く。
- 画像ノードはキャンバス上で表示し、ダブルクリックでオーバーレイ表示できる。
- 画面下部のプロンプトバーで Text / Image モードを切り替え、選択中ノードを文脈として生成できる。
- 右クリックメニューからノード/エッジ削除、ノード単体エクスポート、選択ノードの Marp エクスポートを実行できる。

## MVP Features

- テキストノードの Markdown 編集とプレビュー。
- LLM によるテキスト生成と要約生成。
- 画像生成プロバイダの選択と画像ノード生成。
- 画像ノードを参照画像としてテキスト生成または画像生成に利用。
- キャンバス JSON の保存/読込。
- テキストファイルと画像ファイルのインポート。
- Markdown、画像、Marp Markdown のエクスポート。

## Non-Goals

- キャンバスの自動保存。
- API キーの暗号化保存。
- 複数ユーザーの共同編集。
- プロジェクトファイル形式以外の完全な互換性保証。

