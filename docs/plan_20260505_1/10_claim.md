# Claim

## Purpose

2026-05-05 のアップデートとして、画像生成の実行時にプロバイダを柔軟に選択できるようにし、複数プロバイダの API Key を保持したまま使い分けられるようにする。

## Background

現行実装では `imageGen.provider` により OpenRouter / OpenAI / Google / xAI の画像生成プロバイダを切り替えられる。設定ドロワにはプロバイダ別設定があるが、画像生成リクエストごとの切り替えは設定保存を伴うグローバル状態に寄っている。

画像生成時には画像ノードと別にプロンプト文字列のテキストノードが作られるが、画像カード自体にはプロンプト内容が見えないため、キャンバスを眺めたときにどの画像がどのプロンプトから生成されたか判別しにくい。

## Problem

- 画像生成リクエストごとにプロバイダを切り替えたい。
- 複数プロバイダの API Key を登録し、設定に保持しておきたい。
- 画像ノード上、または画像カード内で生成プロンプトの内容を確認できるようにしたい。
- 既存のプロバイダ実装を正本として、外部 API の呼び出し形態を cheatsheet に残したい。

## Target Users / Environment

- 対象ユーザーは、同じキャンバス上で OpenRouter / OpenAI / Google / xAI などを比較しながら画像生成する利用者。
- 対象環境は現行の Wails v2 / Go / React / TypeScript / Zustand / React Flow 構成。
- 開発コマンドは `mise` 経由で実行する。

## Initial Scope

- PromptBar の Image モードに、今回の画像生成だけに使うプロバイダ選択 UI を追加する。
- 設定ドロワでは各プロバイダの API Key とモデル設定を同時に保持できる状態を維持・改善する。
- backend の画像生成 API はリクエスト単位でプロバイダ指定を受け取れるようにする。
- 画像ノードの `data.alt` または拡張フィールドに生成プロンプトを保持し、カード上で短く表示する。
- cheatsheet に OpenRouter / OpenAI / Google Gemini / xAI の画像生成 API 呼び出し形態をまとめる。

## Initial Technical Hypotheses

- 現行の `ImageGenService.GenerateImage(prompt, contextData, refImages)` はグローバル `config.ImageGen.Provider` を読むため、リクエスト単位の provider override を受け取る API が必要になる。
- `ImageGenConfig` はプロバイダ別設定を保持しているが、frontend の `saveConfig` は現在選択中プロバイダ以外を flat 形式に落としやすいため、複数 API Key 保持要件では保存形式の見直しが必要になる。
- 画像ノードは `ImageNodeData.alt` に生成プロンプトを入れているため、表示だけなら frontend 側の変更で対応できる。ただし将来の履歴・provider 表示を考えるなら `prompt` / `provider` などの明示フィールド追加が望ましい。

## Uncertainties

- 画像生成ごとの provider 選択を PromptBar のみで行うか、画像生成ボタン近くの詳細メニューとして扱うか。
- 既存 canvas file version `1.1` のまま optional field 追加で互換を保つか、新しい version を切るか。
- API Key の複数保持をプロバイダ単位で十分とするか、同一プロバイダに複数 profile を持てるようにするか。

## Next Documents

1. `20_app_requirement.md`: ユーザー体験と MVP 範囲を定義する。
2. `docs/cheatsheet/image_generation_providers.md`: 既存コードと公式 API 情報からプロバイダ別呼び出しを整理する。
3. `30_requirement.md`: 機能要件、制約、受け入れ条件を定義する。
4. `40_specification.md`: 実装対象ファイル、データ構造、UI、バックエンド API を設計する。
5. `50_review_notes.md`: 事前レビュー、保留事項、実装後反映事項を記録する。
