# Requirements

## Scope

この文書は 2026-08-11 時点の実装コードと受理済み計画から確認できる現行機能を対象とする。過去フェーズの計画や未実装案は `docs/plan_*` に保管する。

## Functional Requirements

- アプリは Wails のネイティブウィンドウとして起動し、React フロントエンドを表示する。
- ユーザーはテキストノードを追加し、Markdown 本文と summary を編集できる。
- ユーザーは Artifact ノードを追加し、Markdown 本文、filename、summary を編集し、Edit / Preview を切り替えられる。
- Text / Artifact は content mutation ごとに内部 revision と文字数情報を更新する。
- ユーザーはテキストノード、Artifact ノード、画像ノードをキャンバス上で移動、リサイズ、削除できる。
- ユーザーはノード間に typed Relation を作成し、kind、方向、reasonを編集・反転・削除できる。描画時はsource/target handle roleを維持する。
- 選択ノードから上流方向へ文脈を収集し、Text モードではテキストノード本文と画像ノードの data URL を生成 API に渡す。
- Image モードでは上流テキストをプロンプト文脈として結合し、上流画像を参照画像として画像生成 API に渡す。
- Image モードでは画像生成リクエストごとに OpenRouter / OpenAI / Google / xAI の provider を選択できる。
- 画像生成リクエストごとの provider 選択は、設定ドロワに保存された既定 provider を暗黙に変更しない。
- 生成された画像ノードは生成時プロンプトを保持し、カード上に短いプロンプト preview を表示する。
- ユーザーは画像ノードのプロンプト preview をクリックして、Prompt bar の入力末尾へそのプロンプトを追記できる。
- 複数の上流入力やループを検出した場合は警告を表示する。
- ユーザーは右側 ChatDrawer を開閉・リサイズし、現在の対象ノードを確認して、active Workspace内のmemory-only Dialogue sessionを作成・切替できる。
- ChatDrawer は対象ノードと接続元を direct context に含め、対象がない場合は Canvas 全文を初期送信しない。
- Agent loop は request-local Canvas snapshot を保持し、`list_canvas_nodes` / `read_canvas_node` 等で非接続ノードを必要時に取得できる。
- Agent loop は Text / Artifact の read 済み revision と Frontend acknowledgment を確認し、一致する編集提案だけを適用する。
- ユーザーが Stop した run は cancel され、停止後または stale revision の未適用編集を Canvas に反映しない。
- ChatDrawer は assistant text、tool 実行状態、編集 diff / status を run と session に相関付けて表示する。
- ユーザーは設定ドロワで LLM、画像生成、要約文字数、画像保存先を編集し保存できる。
- 画像生成設定は OpenRouter / OpenAI / Google / xAI の provider 別設定を同時に保持し、provider 切替や保存で非選択 provider の API Key / model / baseURL を失わない。
- ユーザーはキャンバスを JSON ファイルとして保存し、保存済み JSON を読み込める。
- アプリは旧 canvas file をmigrationして読み込み、保存時はWorkspace/Canvas tree、Artifact、Relation、provenanceを含む`1.3`を出力する。
- Dialogue sessionはCanvas JSONやbackend設定領域へ保存せず、アプリ終了・New Workspace・Discard後に復元しない。
- ユーザーはroot / nested SubCanvasを移動でき、`Parent`は閲覧履歴やUndoではなく構造上の親へ1階層移動する。
- 明示選択したText-bearing Nodeをsummarize / compare / counterpointし、元Nodeを変更せずderived Nodeとprovenanceを作成できる。
- Dialogue / Agentのtransformは適用前Proposalとして比較・Modify・Accept・Rejectできる。Direct Actionは明示操作を承認として即時適用し、適用後diffとUndoを提示する。
- derived Nodeとaccepted Relationは一つのatomic transactionで適用し、失敗時はdocument/history/revision/selectionを部分更新しない。
- ユーザーは `.txt` / `.md` / `.png` / `.jpg` / `.jpeg` / `.webp` をドラッグアンドドロップでインポートできる。
- ユーザーは Text / Artifact ノードを Markdown として、画像ノードを画像ファイルとしてエクスポートできる。
- ユーザーは選択ノードとその上流文脈を Marp Markdown としてエクスポートできる。

## Non-Functional Requirements

- API 通信のタイムアウトはテキスト生成で 120 秒、画像生成で 180 秒を基準とする。
- 外部 API エラー、レスポンス形式不正、ファイル I/O エラーはユーザー操作側へエラーとして返す。
- 画像パス解決では絶対パスと `..` を拒否し、設定された画像保存先からの相対パスを基準にする。
- API キーはリポジトリに含めず、ユーザー設定ファイルに保存する。
- API キーは canvas JSON へ保存しない。
- Agent loop は最大 10 tool round で停止し、run / session / tool call を相関付けて処理する。
- Agent による Text / Artifact mutation は Frontend が正本であり、revision conflict 時は適用しない。

## Constraints

- 開発コマンドは `mise` 経由で実行する。
- フロントエンド生成コードは Wails の `frontend/wailsjs/` に依存する。
- 画像表示はバックエンドが画像ファイルを data URL に変換してフロントエンドへ返す。
- 画像保存先の相対パスは実行ファイルディレクトリ基準で解決される。

## Compatibility

- Canvas file `1.0`: text node only.
- Canvas file `1.1`: text node と image node の混在。
- Canvas file `1.2`: legacy text / image / Artifact node と `metadata.canvasId`。
- Canvas file `1.3`: Workspace / Canvas tree、Text / Artifact / image、typed Relation、reason、provenance。
- 旧形式はruntime load時に不足するWorkspace/Canvas/revisionを補い、次回の明示saveでV1.3にする。
- 旧形式の画像生成設定はバックエンドとフロントエンドでプロバイダ別設定へ移行して扱う。
- 旧 OpenRouter default model `sourceful/riverflow-v2-standard-preview` は、現行 default `sourceful/riverflow-v2-fast` へ移行して扱う。

## Out of Scope

- Canvas 全体の自動保存と復元。Dialogue sessionの永続化も対象外。
- 暗号化されたシークレット管理。
- 画像生成以外の外部アセット管理。
- Marp Markdown から実際のスライドファイルへの変換。
- 複数ユーザーによるリアルタイム共同編集。

## Acceptance Criteria

- `mise run build` で Wails アプリのビルドが通ること。
- テキストノード作成、編集、要約、保存、読込ができること。
- 有効な API 設定でテキスト生成と画像生成ができること。
- OpenRouter 画像生成は `sourceful/riverflow-v2-fast` と image-only modality で実生成できること。
- Prompt bar Image モードの provider selector で選択した provider が、そのリクエストの画像生成に使われること。
- 画像ノードの prompt preview をクリックすると、既存入力を消さずに Prompt bar へ追記されること。
- 画像ファイルをインポートし、画像ノードとして表示できること。
- ノード単体と Marp Markdown のエクスポートができること。
- Artifact を作成・編集・Preview・Markdown export でき、Workspace V1.3 で保存／復元できること。
- ChatDrawer で対象ノードを文脈にした通常応答と tool calling が動作し、Dialogue sessionがactive Workspace内だけで保持されること。
- Agent の edit は read revision と acknowledgment を必要とし、Stop または競合時に未適用変更を反映しないこと。
