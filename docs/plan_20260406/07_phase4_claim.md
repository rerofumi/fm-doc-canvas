# 要求仕様書 (Phase 4)

## 改良したいところ

### システムプロンプト枠の追加

- 設定にシステムプロンプトを追加
- 新規で追加したシステムプロンプトをコンフィグファイルにも保存する
- そのシステムプロンプトを LLM 問い合わせ＆サマリー生成に使う
- 日本語で返ってこないことがあるので調整したい

### OpenAI 画像生成での参照画像有効化

- 今は edit API を使っているがこれはやはり違うので、複数参照画像(最大5つ)あるときは responses API を使う
- picture edit のドキュメント
  - https://platform.openai.com/docs/guides/image-generation#edit-images
  - https://platform.openai.com/docs/api-reference/responses/create
- responses API の Model はイメージモデル(コンフィグ値)で指定
- 参照画像がない場合は今ある /images/generations API 利用の物をそのまま使う
