# Requirements

## Scope

この文書は 2026-05-05 時点の実装コードから確認できる現行機能を対象とする。過去フェーズの計画や未実装案は `docs/plan_20260406/` に保管する。

## Functional Requirements

- アプリは Wails のネイティブウィンドウとして起動し、React フロントエンドを表示する。
- ユーザーはテキストノードを追加し、Markdown 本文と summary を編集できる。
- ユーザーはテキストノードと画像ノードをキャンバス上で移動、リサイズ、削除できる。
- ユーザーはノード間にエッジを作成できる。接続時は `right-source` から `left-target` への接続を標準化する。
- 選択ノードから上流方向へ文脈を収集し、Text モードではテキストノード本文と画像ノードの data URL を生成 API に渡す。
- Image モードでは上流テキストをプロンプト文脈として結合し、上流画像を参照画像として画像生成 API に渡す。
- Image モードでは画像生成リクエストごとに OpenRouter / OpenAI / Google / xAI の provider を選択できる。
- 画像生成リクエストごとの provider 選択は、設定ドロワに保存された既定 provider を暗黙に変更しない。
- 生成された画像ノードは生成時プロンプトを保持し、カード上に短いプロンプト preview を表示する。
- ユーザーは画像ノードのプロンプト preview をクリックして、Prompt bar の入力末尾へそのプロンプトを追記できる。
- 複数の上流入力やループを検出した場合は警告を表示する。
- ユーザーは設定ドロワで LLM、画像生成、要約文字数、画像保存先を編集し保存できる。
- 画像生成設定は OpenRouter / OpenAI / Google / xAI の provider 別設定を同時に保持し、provider 切替や保存で非選択 provider の API Key / model / baseURL を失わない。
- ユーザーはキャンバスを JSON ファイルとして保存し、保存済み JSON を読み込める。
- アプリは canvas file version `1.0` と `1.1` を読み込める。保存時は `1.1` を出力する。
- ユーザーは `.txt` / `.md` / `.png` / `.jpg` / `.jpeg` / `.webp` をドラッグアンドドロップでインポートできる。
- ユーザーはテキストノードを Markdown として、画像ノードを画像ファイルとしてエクスポートできる。
- ユーザーは選択ノードとその上流文脈を Marp Markdown としてエクスポートできる。

## Non-Functional Requirements

- API 通信のタイムアウトはテキスト生成で 120 秒、画像生成で 180 秒を基準とする。
- 外部 API エラー、レスポンス形式不正、ファイル I/O エラーはユーザー操作側へエラーとして返す。
- 画像パス解決では絶対パスと `..` を拒否し、設定された画像保存先からの相対パスを基準にする。
- API キーはリポジトリに含めず、ユーザー設定ファイルに保存する。
- API キーは canvas JSON へ保存しない。

## Constraints

- 開発コマンドは `mise` 経由で実行する。
- フロントエンド生成コードは Wails の `frontend/wailsjs/` に依存する。
- 画像表示はバックエンドが画像ファイルを data URL に変換してフロントエンドへ返す。
- 画像保存先の相対パスは実行ファイルディレクトリ基準で解決される。

## Compatibility

- Canvas file `1.0`: text node only.
- Canvas file `1.1`: text node と image node の混在。
- 旧形式の画像生成設定はバックエンドとフロントエンドでプロバイダ別設定へ移行して扱う。
- 旧 OpenRouter default model `sourceful/riverflow-v2-standard-preview` は、現行 default `sourceful/riverflow-v2-fast` へ移行して扱う。

## Out of Scope

- 自動保存と復元。
- 暗号化されたシークレット管理。
- 画像生成以外の外部アセット管理。
- Marp Markdown から実際のスライドファイルへの変換。

## Acceptance Criteria

- `mise run build` で Wails アプリのビルドが通ること。
- テキストノード作成、編集、要約、保存、読込ができること。
- 有効な API 設定でテキスト生成と画像生成ができること。
- OpenRouter 画像生成は `sourceful/riverflow-v2-fast` と image-only modality で実生成できること。
- Prompt bar Image モードの provider selector で選択した provider が、そのリクエストの画像生成に使われること。
- 画像ノードの prompt preview をクリックすると、既存入力を消さずに Prompt bar へ追記されること。
- 画像ファイルをインポートし、画像ノードとして表示できること。
- ノード単体と Marp Markdown のエクスポートができること。
