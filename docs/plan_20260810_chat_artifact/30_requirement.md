# Requirements

## Scope

本計画は `frontend/src/`、ルート `app.go`、`backend/` に変更を加え、次を一体として提供する。

1. Canvas 内に論理 Markdown 文書を保持する Artifact ノード
2. Text / Artifact の Markdown 表示・pure text 編集・export
3. Image の画像・プロンプト保持とプロンプト再利用
4. フォーカス中ノードと接続元ノードを直接コンテキストにする ChatDrawer
5. Canvas スナップショットから任意ノードを必要時に読むエージェントツール
6. revision 競合を防止する Artifact 編集
7. Canvas ごとに関連付けられたチャットセッションの永続化

既存 CanvasFile V1.0 / V1.1 の読込互換と、既存 Text / Image / PromptBar / SettingsDrawer の公開挙動を維持する。

## Functional Requirements

### Sprint A: ノード編集

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-A01 | 「+ Artifact」で新規 Artifact ノードを追加できる | UI 操作でノード追加を確認 | E2 |
| REQ-A02 | Artifact ノードは `filename`, `language`, `content`, `summary`, `revision`, `charCount`, `wordCount`, `lastEditedAt` を保持する | ノード生成と save/load の unit test | E1 |
| REQ-A03 | Artifact ノードをフォーカスすると EditorDrawer で Markdown source text を編集できる | UI 操作で textarea と保存後の内容を確認 | E2 |
| REQ-A04 | EditorDrawer の Edit / Preview 切替で source text と Markdown レンダリングを切り替えられる | UI 操作とスクリーンショット | E2 |
| REQ-A05 | Artifact ノードに filename、charCount を表示する | UI スクリーンショット | E2 |
| REQ-A06 | Text / Artifact の内容更新時に charCount と wordCount を定義済みアルゴリズムで再計算する | 日本語・英語・空文字を含む unit test | E1 |
| REQ-A07 | CanvasFile V1.2 で Artifact ノードと `canvasId` を save/load できる | save/load ラウンドトリップ test | E1 |
| REQ-A08 | CanvasFile V1.0 / V1.1 をエラーなく読み込み、既存 Text / Image を編集できる | V1.0 / V1.1 fixture の読込 test | E1 |
| REQ-A09 | ノードが空の新規 Canvas にだけ `# 新しいチャプター` を持つ Artifact を 1 個生成し、既存 Canvas 読込時には追加しない | 新規起動と既存 Canvas 読込の UI 確認 | E2 |
| REQ-A10 | Artifact ノードを Text / Image ノードと接続できる | UI で両方向の接続を確認 | E2 |
| REQ-A11 | Artifact ノード上で Markdown 装飾をレンダリングし、Text ノードのカードは Summary を表示する | 見出し・強調・リストを含む UI 確認 | E2 |
| REQ-A12 | Text / Artifact の source text を `.md` としてエクスポートできる | export 後のファイル内容を比較 | E2 |
| REQ-A13 | Image ノード上で保持済みプロンプトを表示・コピーできる | UI 操作と clipboard 内容確認 | E2 |
| REQ-A14 | Text ノードは競合検出用 `revision` を保持し、旧データで欠落している場合は 0 として読み込み、content mutation ごとに増加する | migration/store unit test | E1 |

### Sprint B: ChatDrawer / Session

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-B01 | ChatDrawer をヘッダーのチャットボタンで開閉・リサイズできる | UI 操作 | E2 |
| REQ-B02 | ChatHeader はフォーカス中ノードの種別と識別情報を表示する。Artifact は filename、Text は本文先頭、Image はプロンプト先頭を表示する | 3 種類のノードを使った UI 確認 | E2 |
| REQ-B03 | フォーカス対象がない時は「対象未選択」と表示し、全 Canvas の内容を自動送信しない | UI 表示と送信 payload の確認 | E2 |
| REQ-B04 | セッションセレクタで同一 Canvas のセッションを明示的に切り替えられる | UI 操作 | E2 |
| REQ-B05 | 「+ New」で現在の Canvas に紐づくセッションを作成できる | UI 操作と保存データ確認 | E2 |
| REQ-B06 | Enter で送信し、Shift+Enter で改行できる | UI キーボード操作 | E2 |
| REQ-B07 | ストリーミング中の assistant メッセージに進行中表示を出す | UI スクリーンショット | E2 |
| REQ-B08 | 実行中に Stop を押すと対象 run がキャンセルされ、未適用の編集結果は Canvas へ反映されない | 遅延モックを使った統合 test | E1 |
| REQ-B09 | ノードのフォーカス変更で `targetNodeId` と ChatHeader を更新する | UI 操作 | E2 |
| REQ-B10 | EditorDrawer を閉じるとフォーカスを解除し、`targetNodeId` を null にする | UI 操作 | E2 |
| REQ-B12 | フォーカス対象を変更しても現在のセッションを自動で切り替えない | UI 操作で sessionId 不変を確認 | E2 |

`REQ-B11` は echo スタブという実装途中のチェックだったため、最終プロダクトの受理要件から廃止する。ID は再利用しない。

### Sprint C: Agent / Context / Editing

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-C01 | エージェントループは最大 10 tool round で停止する | モック LLM による unit test | E1 |
| REQ-C02 | `write_artifact`, `apply_edit`, `read_artifact`, `list_artifacts`, `search_artifact`, `list_canvas_nodes`, `read_canvas_node` が個別に動作する | 各 Tool の unit test | E1 |
| REQ-C03 | `apply_edit` は read 済みの Text / Artifact で search_text が 1 件だけ一致した場合に置換し、0 件または複数件では変更せずエラーを返す | node type・正常・0件・複数件・Unicode の unit test | E1 |
| REQ-C04 | LLM HTTP request と agent loop を Go の `context.Context` でキャンセルできる | 遅延 HTTP server を使った unit test | E1 |
| REQ-C05 | assistant のテキストチャンクを `chat:stream` で逐次送信する | runId を含むイベント列の統合 test | E1 |
| REQ-C06 | tool 実行開始・mutation 適用要求・完了・失敗を `chat:tool_start` / `chat:tool_apply` / `chat:tool_done` で送信する | イベント列の統合 test | E1 |
| REQ-C07 | 正常終了時は `chat:done`、中断時は `chat:cancelled`、失敗時は `chat:error` を各 run につき終端イベント 1 件だけ送信する | 状態別の統合 test | E1 |
| REQ-C08 | システムプロンプトに役割、ツール使用指示、編集前 read、ツール結果後の自然文応答、ツール呼出し以外の JSON 禁止を含める | prompt 文字列の unit test | E1 |
| REQ-C09 | Text / Artifact への `apply_edit` 結果は `nodeId` と `baseRevision` が現在値に一致した時だけ反映する。共通して content/revision/count を更新し、Artifact は lastEditSummary も更新する | store unit test | E1 |
| REQ-C10 | `write_artifact` はユーザーが新規文書を明示した場合だけ新規 Artifact を追加する。作成指示がなく対象もない場合は変更せず確認を求める。対象がある場合の全体置換には対象 nodeId と baseRevision を要求する | Tool / run state unit test | E1 |
| REQ-C11 | `apply_edit` の ToolCard に対象、結果、赤緑 diff を表示し、失敗・競合時は成功表示にしない | UI 確認 | E2 |
| REQ-C12 | Ollama の受理対象 version / model を記録し、その組合せで read → apply_edit → 自然文応答が完了する | 実機手順・ログ・スクリーンショット | E2 |
| REQ-C13 | チャット送信時にフォーカス中ノードの最新スナップショットを直接コンテキストへ含める。Text / Artifact は Markdown source、Image は画像参照とプロンプトを含む | request builder unit test | E1 |
| REQ-C14 | フォーカス中ノードから `traverseContextBackwards` で得た接続元ノードを順序どおり、重複なく直接コンテキストへ含める。branch / loop 警告時は既存 traversal の停止結果と警告を保持する | graph fixture を使った unit test | E1 |
| REQ-C15 | `list_canvas_nodes` は本文を含まない全 node の index を返し、`read_canvas_node` は request 開始時の Canvas snapshot から任意の Text / Artifact / Image を nodeId で取得して追加コンテキストとして返す | index、3 種類の read、不存在の unit test | E1 |
| REQ-C16 | 全 chat event に `runId` と `sessionId` を含め、編集イベントには `targetNodeId` と `baseRevision` を含める | event schema とルーティングの unit test | E1 |
| REQ-C17 | run 中に対象ノードが手動更新された場合、古い編集結果を自動適用せず revision 競合として表示する | revision 競合の store unit test | E1 |
| REQ-C18 | Text / Artifact を変更する前に、同じ run 内で `read_canvas_node` または `read_artifact` により同じ revision を読んでいなければ `apply_edit` / 対象あり `write_artifact` を拒否する | Tool registry / run state の unit test | E1 |
| REQ-C19 | targetNodeId が null の時、全ノード本文を初期プロンプトへ含めず、一覧・検索・読込ツールで必要なノードだけ取得する | request builder unit test | E1 |
| REQ-C20 | mutation tool は Frontend の applied / conflict / cancelled / error acknowledgment を待ち、applied の場合だけ LLM へ成功結果を返す | acknowledgment の統合 test | E1 |
| REQ-C21 | OpenAI-compatible provider が tool call に返した provider 拡張 metadata（例: Gemini `extra_content.google.thought_signature`）を、同一 agent loop の次 request へ無変更で再送する | 2 round の request payload regression test | E1 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-N01 | V1.0 / V1.1 は読込時にそのまま runtime node へ変換し、次回保存時に V1.2 と `canvasId` を付与する。元ファイルを読込だけで書き換えない | REQ-A07 / A08 の受理結果を代替証拠とし、専用 fixture test は closure waiver | EX |
| REQ-N02 | 同一 PC・同一 build で cold start を各 5 回測定した中央値が変更前の 1.5 倍を超えない | 専用測定は closure waiver。通常利用で問題が生じた場合に再計測 | EX |
| REQ-N03 | 30 秒のチャットストリーミング中にノード移動と Drawer 開閉を行い、100ms を超える main-thread Long Task を新規に発生させない | 専用測定は closure waiver。操作の引っ掛かりが生じた場合に再計測 | EX |
| REQ-N04 | `mise run build` が exit code 0 で完了する | コマンド出力 | E1 |
| REQ-N05 | `mise x -- npm --prefix frontend run build` が exit code 0 で完了し、TypeScript 型検査と Vite build が成功する | コマンド出力 | E1 |
| REQ-N06 | API key は既存 `backend/config.go` の設定経路だけで扱い、source / test fixture / plan evidence に実値を保存しない | 専用 secret scan は closure waiver。credential 経路変更時に再検証 | EX |
| REQ-N07 | Markdown に script、event handler、javascript URL を入力しても実行されない | 専用 payload test は closure waiver。外部由来の未信頼本文を扱う計画で再検証 | EX |
| REQ-N08 | チャット履歴を Wails backend 経由でアプリ設定領域へ保存し、再起動後に復元できる | 保存 → アプリ再起動 → 復元の UI 確認 | E2 |
| REQ-N10 | セッションは `canvasId` で分離し、別 Canvas のセッションを表示・送信対象にしない | 2 Canvas を使った persistence test | E1 |

`REQ-N09` は `REQ-C01` と重複していたため廃止する。ID は再利用しない。

## Constraints

- コマンドは `mise` の task または `mise x -- ...` を使う。
- Canvas の runtime state は Frontend Zustand store を正本とする。
- Backend agent は chat 送信時の request-local Canvas snapshot を参照し、Frontend state を直接変更しない。
- Canvas への変更は相関情報を持つ event を Frontend が検証して適用する。
- 既存 Text / Image / PromptBar / SettingsDrawer の公開挙動を維持する。
- 新しい外部依存を追加しない。必要になった場合は pre-implementation research と計画改訂を行う。
- ツール結果後の応答は自然文とし、ツール呼出し以外の JSON 出力を禁止する。

## Compatibility

### Canvas File

- V1.0 / V1.1 は読み込める。
- V1.0 / V1.1 を読み込んだだけでは元ファイルを書き換えない。
- 次回保存時は V1.2 として保存する。
- V1.2 の旧版形式への downgrade export は提供しない。

### API / Node

- 既存 Wails binding の signature を変更しない。
- 新規 binding はルート `app.go` に追加する。
- `useChatStore` は `useAppStore` と分離するが、snapshot 作成と編集結果適用は明示的な adapter を介する。
- `customNode` / `imageNode` の既存データを読み込める。

## Verification / Completion Conditions

### Automated

- `mise run build`
- `mise x -- npm --prefix frontend run build`
- `mise x -- go test ./...`
- Tool、agent loop、event routing、snapshot、revision conflict、persistence の plan-defined unit / integration test

### Core E2E: closure waiver（当初 in scope）

1. 新規 Canvas を開き、初期 Artifact と Text を Markdown 表示・pure text 編集・export する。
2. Text と Image を Artifact の上流へ接続し、Artifact をフォーカスして送信する。
3. request に Artifact、接続 Text、画像参照とプロンプトが含まれることを確認する。
4. エージェントが `list_canvas_nodes` から非接続ノードを見つけ、`read_canvas_node` で追加取得する。
5. Text / Artifact で read → apply_edit → diff → revision 更新を確認する。
6. 実行中に手動編集し、古い tool result が競合として拒否されることを確認する。
7. Stop 後に未適用編集が反映されないことを確認する。
8. Canvas とチャットを保存し、再起動後に同じ `canvasId` の成果物と会話を復元する。
9. V1.0 / V1.1 fixture を読み、編集後に V1.2 として保存する。

E2E framework は本計画では追加せず、UI 操作は手動 E2、ロジックと event routing は E1 test で補完する。

2026-08-11 の closure 判断により、上記 1〜9 を一続きにした追加の Core E2E は実施しない。Sprint A〜C の個別受理と自動検証を代替証拠とし、横断回帰が疑われる場合に再導入する。

## Out of Scope

- 外部 Markdown ファイルとの常時同期
- 複数 Artifact への原子的な一括編集
- モバイル / タッチ UI
- リアルタイム共同編集
- 音声入力・読み上げ
- iframe preview
- 文体 preset、Mindmap 自動整列、進捗カウンター、キャラクター相関図
- 外部 MCP 統合、画像生成 tool 統合
- 多言語 UI

## Acceptance Criteria

- 全ての有効な REQ が `90_status.md` に存在する。
- 各 REQ に verification method と単一の evidence class がある。
- 実装セッションは implementer state と evidence だけを更新する。
- 別の受理セッションまたは人間が証拠を確認し、acceptance を記録する。
- 全ての有効な REQ が pass、または理由・代替証拠・残余リスク・再検討条件を記録した EX として人間に受理された場合だけ `state: done` とする。
