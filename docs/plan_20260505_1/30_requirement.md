# Requirements

## Scope

この plan は画像生成プロバイダ選択、複数プロバイダ API Key 保持、画像カード上のプロンプト表示、画像カードからのプロンプト再利用、画像生成 API cheatsheet 整備を対象とする。現行のテキスト生成、キャンバス編集、ファイル入出力の仕様変更は最小限に留める。

## Functional Requirements

- Settings Drawer は OpenRouter / OpenAI / Google / xAI の設定を同時に保持できること。
- 設定保存時、現在選択中ではない画像生成プロバイダの API Key / model / baseURL を失わないこと。
- PromptBar の Image モードは、今回の画像生成に使う provider を選択できること。
- Text モードでは画像生成 provider selector が主操作を邪魔しないこと。
- 画像生成 API 呼び出しは、指定された provider override を優先し、未指定時は既存の `config.imageGen.provider` を使うこと。
- provider override は永続設定を暗黙に変更しないこと。
- 画像生成後の image node は、生成時プロンプトをノードデータに保持すること。
- image node はカード上に生成プロンプトを短く表示し、長いプロンプトでもレイアウトを破壊しないこと。
- image node 上に表示されたプロンプトをクリックすると、PromptBar の入力テキスト末尾へそのプロンプトを追加できること。
- プロンプト追加時、PromptBar に入力中のテキストを消さないこと。
- PromptBar の既存テキストと追加プロンプトの間には、読める区切りを入れること。既存テキストが空の場合は追加プロンプトのみを入れること。
- プロンプト追加操作は画像ノードの選択、リサイズ、画像オーバーレイ表示を不意に阻害しないこと。
- 既存の image node と canvas file `1.1` は読み込み可能であること。
- cheatsheet は既存コードの呼び出し形態を正本とし、公式 docs で確認した関連オプションと注意点を記録すること。

## Non-Functional Requirements

- API Key はローカル設定にのみ保存し、canvas JSON には含めないこと。
- リクエスト単位 provider override の追加により、既存の Wails メソッド利用箇所が破綻しないこと。
- TypeScript 型と Wails 生成コードの差異を放置しないこと。
- 画像ノードのプロンプト表示は視認性を優先し、画像そのものの表示領域を大きく阻害しないこと。
- 画像ノードのプロンプトクリック領域は、クリック可能であることが視覚的に分かること。
- 既存の画像生成タイムアウト 180 秒を維持すること。

## Constraints

- 開発・検証コマンドは `mise` 経由で実行する。
- 既存プロバイダ実装は `backend/openrouter.go`, `backend/openai.go`, `backend/google.go`, `backend/xai.go` を正本とする。
- Wails bound method を変更した場合は `frontend/wailsjs/` の再生成が必要になる。
- Settings Drawer の保存形式変更は、旧 flat `imageGen.baseURL/model/apiKey` との互換を維持する。

## Compatibility

- Existing config:
  - flat `imageGen.baseURL/model/apiKey` は provider-specific config へ移行して扱う。
  - provider-specific config が存在する場合は全プロバイダ分を保存・復元する。
- Existing canvas:
  - `ImageNodeData.alt` のみを持つ既存 image node を表示できる。
  - 新しい optional fields を追加しても `version: "1.1"` の読み込みを維持する。

## Out of Scope

- API Key の暗号化、keychain 保存。
- 外部モデル一覧の自動取得。
- プロバイダごとの課金、レート制限表示。
- 画像生成結果の履歴管理。
- 画像生成 API の完全なパラメータ UI 化。

## Acceptance Criteria

- Settings Drawer で複数プロバイダの API Key を入力して保存し、アプリ内 config reload 後も失われない。
- PromptBar Image モードで provider を切り替えて生成を実行できる。
- provider override を使った生成後も `config.imageGen.provider` は暗黙に変わらない。
- 生成された image node のカード上でプロンプト内容の冒頭が確認できる。
- image node 上のプロンプトをクリックすると、PromptBar の既存入力末尾にプロンプトが追加される。
- PromptBar に既存入力がある状態でプロンプト追加しても、既存入力が失われない。
- 長いプロンプトでも image node のカード表示が崩れない。
- `mise run build` が通る。
- `docs/cheatsheet/index.md`, `docs/cheatsheet/link.md`, provider cheatsheet が更新されている。
