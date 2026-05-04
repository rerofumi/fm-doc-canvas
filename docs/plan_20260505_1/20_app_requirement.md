# App Requirements

## Purpose

画像生成時にプロバイダをすばやく選び替え、プロバイダごとの API Key を保持したまま、生成結果とプロンプトの対応をキャンバス上で確認できるようにする。

## Target Environment

- Wails v2 desktop application.
- Backend: Go.
- Frontend: React 18, TypeScript, Zustand, React Flow, Tailwind CSS.
- Toolchain: `mise.toml` に定義された Go / Node.js / Wails。開発・検証コマンドは `mise` 経由で実行する。

## User Experience

- ユーザーは Settings Drawer で OpenRouter / OpenAI / Google / xAI の API Key とモデル設定をまとめて登録できる。
- ユーザーは PromptBar の Image モードで、設定保存を開かずに今回の画像生成プロバイダを選択できる。
- 画像生成後、生成された画像ノードのカード上にプロンプトの短いプレビューが表示される。
- 画像ノードの `alt` 相当情報は画像オーバーレイや export 時にも失われない。
- 既存の「画像ノードとは別にプロンプト用テキストノードを作る」挙動は、互換性のため当面維持する。ただし画像カード上の表示が主導線になる。
- 画像ノードに表示されているプロンプトをクリックすることで、チャットエリアのチキストボックスにそのプロンプトが追加される。入力中のプロンプトを消さないように、現在のテキストの後ろに追加される形を取る。

## MVP Features

- Image モード専用の provider selector。
- リクエスト単位 provider override による画像生成。
- プロバイダ別 API Key / model / baseURL の同時保存。
- 画像ノードへの生成プロンプト表示。
- 既存 canvas `1.1` の読み込み互換維持。
- 画像生成プロバイダ API の cheatsheet 整備。

## Future Candidates

- 同一プロバイダ内の複数 profile 登録。
- 画像ノードに provider / model / generatedAt / reference image count を表示する詳細メタデータ。
- 生成結果ごとの再生成、プロバイダ変更再生成、プロンプト編集。
- provider ごとのモデル候補取得や画像対応モデルのフィルタリング。
- API Key の OS keychain 保存。

## Initial Non-Goals

- 既存の画像生成プロバイダ自体の追加。
- 外部 API 通信の網羅的な自動テスト。
- canvas ファイル内への API Key 保存。
- 画像生成のストリーミング表示。
- 同一リクエストで複数プロバイダへ同時生成する比較モード。
