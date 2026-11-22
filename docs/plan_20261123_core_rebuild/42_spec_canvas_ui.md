# Specification Detail — Canvas-First UI, Graph Logic & Async State

全体構成・共通ポリシー・マップは [`40_specification.md`](./40_specification.md)、受入条件の正本は [`30_requirement.md`](./30_requirement.md) を参照する。

---

## 1. Canvas-First UI シェル・テーマトークン・通知基盤（REQ-14, REQ-02）

D-011: Canvas-First UI シェル・既定ライトテーマトークン・日本語UI・通知/ダイアログ基盤

- **対応 REQ**: `REQ-14`, `REQ-02`
- **画面構成（Low-Chrome 原則）**:
  - 画面全面を `CanvasViewport`（React Flow）として開放し、常設サイドバーや多層ドロワーは配置しない。
  - 常時表示する UI は以下の 2 要素のみ:
    1. **`TopToolbar`（中央上部フローティングバー）**: `+ メモ`, `整頓`, `開く`, `保存`, `設定` の 5 ボタン（すりガラス調ピル型）＋右上に控えめなズーム倍率表示（クリックで `fitView`）。
    2. **`CommandDock`（中央下部フローティングドック）**: 上部に `Context Strip`（現在のテキスト件数・参照画像枚数・警告バッジ）、下部にモード切替（`テキスト` / `画像`）・プロバイダー選択（`画像` モード時のみ表示、初期値は `config.imageGen.provider` でローカル状態のみ変更）・複数行オートリサイズ入力欄（`Ctrl+Enter` / `Cmd+Enter` 送信）・送信ボタンを配置。
- **既定ライトテーマとトークン構成（`frontend/src/index.css`）**:
  - `:root` にニュートラルなライトテーマの CSS カスタムプロパティ（`--bg-canvas: #f8fafc`, `--bg-surface: #ffffff`, `--bg-surface-muted: #f1f5f9`, `--text-primary: #0f172a`, `--text-secondary: #475569`, `--border-subtle: #e2e8f0`, `--accent-primary: #2563eb`, `--danger: #dc2626`, `--warning: #d97706` 等）を定義し、コンポーネントはこのトークンを参照する（将来のダークテーマ切替を CSS 変数差替のみで実現可能な構造）。
- **MVP 日本語 UI 固定**:
  - ボタンラベル、プレースホルダー、設定モーダル、確認ダイアログ、トースト通知はすべて簡潔な日本語で統一する。
- **インアプリ通知・確認ダイアログ**:
  - ブラウザ標準 `window.alert` / `window.confirm` は一切使用しない。
  - `ToastContainer`（`useToastStore`）: `info` / `success` / `warning` / `error` の 4 種、自動消去（`error` は長めまたは手動閉じ可）で画面右上（ズーム表示と重ならない位置）にスタック表示。
  - `ConfirmDialog`: Clear Canvas 等の破壊的操作時にモーダル表示（`Esc` または「キャンセル」で状態維持、「初期化する」確定時のみ実行）。

---

## 2. キャンバス基本操作と Clear Canvas（REQ-02, REQ-14）

D-012: キャンバスビューポート操作（パン・ズーム 0.1〜4.0・選択・確認付き Clear Canvas）

- **対応 REQ**: `REQ-02`, `REQ-14`
- **React Flow 設定（`CanvasViewport.tsx`）**:
  - `minZoom={0.1}`, `maxZoom={4.0}`。
  - パン（背景ドラッグ / ホイールまたはスペースドラッグ）、背景クリックで全選択解除、単一選択、複数選択（`Shift+クリック` および矩形選択 `selectionOnDrag`）。
  - `ContextMenu`: ノード/複数選択/エッジの右クリックでコンテキストメニューを表示（テキスト: 編集/Markdown出力/Marp出力/削除、画像: 拡大表示/画像出力/Marp出力/削除、複数選択: Marp出力/削除、エッジ: 削除）。
- **SettingsModal（3タブ構成）と Clear Canvas**:
  - タブ 1「LLM 設定」: Base URL, Model, API Key（マスク/表示切替）, System Prompt, サマリー最大文字数。
  - タブ 2「画像生成」: デフォルトプロバイダー、保存先パス（`downloadPath`）、4 プロバイダー（OpenRouter / OpenAI / Google / xAI）のサブタブまたはカード一覧。どのタブを編集しても全4プロバイダーを保持して `SaveConfig` へ渡す。
  - タブ 3「キャンバス管理」: Danger Zone に「キャンバスを初期化（Clear Canvas）」ボタンを配置。押下時に `ConfirmDialog` を開き、キャンセル時は何も変更せず、確定時のみ全ノード・全エッジ・選択状態・インスペクター・ライトボックスを消去し `canvasEpoch` をインクリメントする（`[D-018]`）。

---

## 3. テキストノードと詳細エディタ（REQ-03, REQ-07）

D-013: テキストノードとスライドイン詳細エディタ（NodeInspector・切替自動確定・サマリー再生成）

- **対応 REQ**: `REQ-03`, `REQ-07`
- **`TextCardNode`（`type: "customNode"`）**:
  - 左右コネクタ: 左に `target`（`id="left"`）、右に `source`（`id="right"`）。
  - ボディ: `summary` が非空なら `summary` を表示、空なら `content` を最大 8〜10 行で `line-clamp` 表示し、長文でもカードが過度に縦長にならないようにする。
  - フッター（**`originalPrompt` が非空の生成ノードのみ表示**。手動作成・D&D インポートノードには非表示）:
    - `Prompt:` ラベル＋最大 3 行省略表示（`title` 属性で全文ツールチップ表示）。
    - クリックで `e.stopPropagation()` のうえ `appendPromptInput(originalPrompt)` を実行し、トーストで「プロンプトを入力欄に追加しました」と通知。
  - 削除操作: ホバー時ヘッダー削除アイコン、右クリックメニュー、選択時の `Delete` / `Backspace`（入力フォーカス中を除く）で削除可能。
- **`NodeInspector`（スライドイン詳細エディタ）**:
  - テキストノードのダブルクリックまたは編集アイコンで画面右側からスライドイン表示（幅ドラッグリサイズ可）。
  - 機能: `編集` / `プレビュー`（`react-markdown` + `remark-gfm` + `@tailwindcss/typography`）タブ、`Markdown 出力` ボタン、閉じるボタン、フッターにサマリー編集欄＋「サマリー生成」ボタン、生成ノードなら `originalPrompt` 全文表示＋「入力欄へ追記」ボタン。
  - **状態遷移と失効時の振る舞い**:
    - 編集中のドラフト（`draftContent`, `draftSummary`）はストアの `commitInspectorDraft()` で対象ノードへ確定反映する。
    - **別テキストノード選択時**: 現在のドラフトを自動確定してから新ノードへ切り替える。
    - **画像ノード選択・閉じるボタン・JSON 保存実行時**: 現在のドラフトを自動確定する（JSON 保存時は確定後の最新内容がシリアライズされる）。
    - **編集中ノードが削除された場合 / Clear Canvas / Load Canvas 実行時**: ドラフトを破棄してインスペクターを即座に閉じる。
    - **サマリー手動再生成中に対象ノードが削除・切替された場合**: 完了時に `canvasEpoch` と対象ノード生存を確認し、失効していれば結果を破棄する（`[D-018]`）。

---

## 4. 画像ノードとライトボックス（REQ-04）

D-014: 画像ノードとライトボックス拡大オーバーレイ（欠損フォールバック・非破壊プロンプト追記）

- **対応 REQ**: `REQ-04`
- **`ImageCardNode`（`type: "imageNode"`）**:
  - 左右コネクタ（`id="left"` / `id="right"`）と React Flow `NodeResizer`（選択時のみリサイズハンドル表示）。
  - 画像読み込み: マウント時・`src` 変更時に `GetImageDataURL(src)` を呼び出し表示。読み込み中はスケルトン表示。
  - **画像ファイル欠損・読込失敗時のフォールバック表示**: `GetImageDataURL` がエラーを返した場合や `src` が空の場合は、クラッシュさせず「画像を読み込めません」アイコン＋相対パス `src`＋エラー概要をカード内に表示する（カード自体の選択・削除・エッジ編集は継続可能）。
  - フッター（**`prompt` が非空の生成画像ノードのみ表示**。D&D インポート画像には非表示）:
    - `provider` があれば小さなバッジ（`OpenRouter` / `OpenAI` / `Google` / `xAI`）を表示。
    - プロンプトを最大 3 行省略表示し、クリック（`e.stopPropagation()`）で `appendPromptInput(prompt)` を実行。
- **非破壊プロンプト追記仕様（`appendPromptInput(text)`）**:
  - 現在の `promptInput` が空（空白のみ含む）なら `text` をそのまま設定。
  - 既存の非空入力がある場合は `promptInput + "\n\n" + text` として既存入力を消さずに末尾追記する。
- **`ImageLightbox`**:
  - 画像ノードのダブルクリックまたは右クリック「拡大表示」で中央モーダル表示（`Esc` または背景クリックで閉じる）。
  - 拡大画像（欠損時はフォールバック表示）、`provider` / `model` 情報、`prompt` 全文（存在時）、「入力欄へ追記」ボタン、「画像をエクスポート」ボタンを提供。対象ノードが削除・Clear Canvas された場合は自動的に閉じる。

---

## 5. 有向エッジ連結と循環防止（REQ-05）

D-015: 有向エッジ連結と循環事前検出・拒否通知

- **対応 REQ**: `REQ-05`
- **担当ファイル**: `frontend/src/utils/graphContext.ts`（純粋関数 `wouldCreateCycle(edges, sourceId, targetId)`）
- **循環検出アルゴリズム**:
  - `sourceId === targetId`（自己ループ `A→A`）は即座に `true`。
  - それ以外は `targetId` から既存有向エッジを順方向に BFS/DFS 探索し、`sourceId` に到達可能なら `true`（直接ループ `A→B→A` および間接ループ `A→B→C→A` をすべて検出）。
- **接続・削除時の振る舞い**:
  - `onConnect` で `wouldCreateCycle` が `true` を返した場合、エッジを追加せず警告トースト「循環（ループ）する接続は作成できません」を表示する。
  - 同一 `(source, target)` の重複エッジも無視または抑止する。
  - エッジ選択＋`Delete`/`Backspace` または右クリックメニュー「エッジを削除」で削除可能。

---

## 6. 上流コンテキスト収集と可視化（REQ-06）

D-016: 上流コンテキスト収集・分岐/ループ停止警告・Context Strip 可視化

- **対応 REQ**: `REQ-06`
- **担当ファイル**: `frontend/src/utils/graphContext.ts`（純粋関数 `collectCanvasContext(nodes, edges, selectedNodeIds)`）
- **収集仕様**:
  - 戻り値: `{ textItems: Array<{ nodeId: string; text: string }>, imageSrcs: Array<{ nodeId: string; src: string }>, warnings: string[] }`。
  - **ケース 0（選択 0 件）**: `textItems: []`, `imageSrcs: []`, `warnings: []`（ユーザー入力のみで送信）。
  - **ケース 1（選択 1 件）**: 選択ノードから上流（`edge.target === current`）へ再帰追跡し、**源流 → 選択ノード順**で収集する。
    - 上流エッジが 2 本以上（分岐合流）を検出した場合: それ以上の上流追跡を停止し、`warnings` に「上流の分岐を検出したため、手前までをコンテキストとして使用します」を追加する。
    - 訪問済みノードへの再到達（既存 JSON 等に含まれるループ）を検出した場合: 追跡を停止し、`warnings` に「循環を検出したため上流追跡を停止しました」を追加する。
  - **ケース 2（選択 2 件以上）**: 選択されたノード集合内の有向エッジに基づき Kahn 法でトポロジカルソートし、未接続・同順位ノードは選択順（または座標 `x`→`y` 昇順）で決定的に並べる。選択集合内に循環がある場合は未処理ノードを配置順で補完しつつ `warnings` に循環警告を追加する。
  - **テキスト/画像分離**: `customNode` は `content`（空なら `summary`）を `textItems` へ（複数件は `\n\n---\n\n` で結合して `contextData` 化）、`imageNode` は `src` を `imageSrcs` へ分離する（送信直前に `GetImageDataURL` で Data URL 配列へ解決。個別画像が欠損して解決失敗した場合は警告トーストを出して当該画像をスキップし、他コンテキストで続行または全失敗時エラー）。
- **Context Strip 可視化**:
  - `CommandDock` 直上に選択状態の変化へ追従してリアルタイム表示（例: `コンテキスト: テキスト 2件 / 画像 1枚`）。0 件時は `コンテキストなし` を控えめに表示。`warnings` が 1 件以上ある場合は警告バッジと理由を表示する。

---

## 7. オートレイアウト（REQ-10）

D-017: オートレイアウト（Dagre 左→右 LR 整頓）

- **対応 REQ**: `REQ-10`
- **担当ファイル**: `frontend/src/utils/autoLayout.ts`（純粋関数 `applyAutoLayout(nodes, edges)`）
- **仕様**:
  - `dagre.graphlib.Graph` を `rankdir: "LR"`（左右コネクタと整合する左→右配置）、`nodesep: 60`, `ranksep: 100` で構成。
  - 各ノードの幅・高さ（`node.measured?.width ?? node.width ?? defaultWidth`、テキスト既定 `280x160`、画像既定 `260x220`）を登録し、エッジ接続関係を維持したまま新座標（中心座標から左上座標へ変換）を算出する。
  - 実行後は React Flow の `fitView({ padding: 0.2 })` を呼び出して全体を見やすく収める。ノード 0 件時は何もしない。

---

## 8. 非同期生成の排他制御・世代トークンによる状態失効破棄（REQ-14, 07, 08, 03, 02）

D-018: 非同期生成の排他制御・世代トークンによる状態失効破棄・フロントエンド状態管理（Zustand）

- **対応 REQ**: `REQ-14`, `REQ-07`, `REQ-08`, `REQ-03`, `REQ-02`
- **担当ファイル**: `frontend/src/store/useCanvasStore.ts`
- **状態フィールド（主要部）**:
  - `nodes`, `edges`, `selectedNodeIds`
  - `canvasEpoch: number`（初期値 `0`。`Clear Canvas` および `Load Canvas` 成功時に `+1` インクリメント）
  - `isGenerating: boolean`（LLM テキスト生成・画像生成の実行中フラグ）
  - `summarizingNodeIds: Record<string, boolean>`（ノード単位のサマリー生成中フラグ）
  - `activeInspectorNodeId: string | null`, `inspectorDraft: { content: string; summary: string } | null`
  - `lightboxNodeId: string | null`
  - `promptInput: string`, `commandMode: "text" | "image"`, `selectedImageProvider: string`
- **多重送信防止**:
  - `isGenerating === true` の間、`CommandDock` の送信ボタンを無効化してスピナー表示し、`Ctrl+Enter` / `Cmd+Enter` 送信もブロックする。
- **状態失効（Stale Async Response）時の破棄ルール**:
  1. **LLM テキスト生成 / 画像生成**:
     - リクエスト開始時に `const startEpoch = get().canvasEpoch` を捕捉する。
     - 完了時に `get().canvasEpoch !== startEpoch`（生成中に Clear Canvas または Load Canvas が実行された）であれば、**新規ノードをキャンバスへ追加せず破棄**し、`isGenerating = false` に戻す（画像生成の場合は保存済み物理ファイルはディスクに残る）。
     - 正常時（`canvasEpoch` 一致）: 選択ノード（またはビューポート中央）の右隣に重複しない座標で新規ノードを 1 つ追加する（画像生成時は画像ノードのみ 1 つ追加、余計なプロンプトテキストノードは作らない）。テキスト生成時は続けて自動サマリー生成を非同期実行する。
  2. **自動サマリー生成 / NodeInspector 手動サマリー生成**:
     - 開始時に `startEpoch` と対象 `targetNodeId` を捕捉する。
     - 完了時に `get().canvasEpoch !== startEpoch` または `nodes` に `targetNodeId` が存在しない（生成中に削除された）場合は結果を破棄する。
     - 対象ノードが `NodeInspector` で現在編集中かつユーザーが `summary` を手動変更済みの場合も、ユーザー編集を上書きせずトースト通知に留める。
- **配置座標の決定**:
  - 参照元ノード（単一選択または最終選択ノード）がまだ生存していればその右側（`x + width + 80`, `y`、既存ノードと重なる場合は `y` を `+40` ずつオフセット）、未選択または削除済みならビューポート中央付近へ配置する。

---

## 9. 受入確認手順（`30_requirement.md` 対応）

| REQ | 対象設計 ID | 確認種別 | 具体的な確認手順・期待結果 |
| --- | --- | --- | --- |
| REQ-02 | `[D-011]`, `[D-012]`, `[D-018]` | E2 | 実アプリで (a) パン操作、(b) ズームアウト下限 `0.1`〜ズームイン上限 `4.0`、(c) 背景クリック選択解除・`Shift`/矩形複数選択、(d) Clear Canvas でキャンセル時状態維持・確定時全消去を確認する。 |
| REQ-03 | `[D-013]`, `[D-018]` | E2 | 実アプリで (a) `+ メモ` 作成ノードに `originalPrompt` 非表示、(b) 長文入力時の行数クランプ、(c) 生成ノードの `originalPrompt` 表示・クリック追記、(d) NodeInspector の編集/プレビュー・別ノード切替時の自動確定・サマリー再生成、(e) 削除操作を確認する。 |
| REQ-04 | `[D-014]`, `[D-008]`, `[D-005]` | E2 | 実アプリで (a) 生成画像ノード表示・リサイズ・プロンプト非破壊追記（入力空時そのまま／入力あり時 `\n\n` 区切り）、(b) インポート画像でプロンプト欄非表示、(c) ダブルクリックでライトボックス拡大・全文確認・追記・エクスポート起動、(d) 存在しない `src` 読込時のフォールバック表示を確認する。 |
| REQ-05 | `[D-015]` | E1 / E2 | **E1**: `graphContext.test.ts` で自己ループ（A→A）、直接ループ（A→B→A）、間接ループ（A→B→C→A）の検出と正常 DAG 許容を確認。<br>**E2**: 実アプリで左右コネクタ接続、ループ接続試行時の拒否＋警告トースト、エッジ削除を確認する。 |
| REQ-06 | `[D-016]` | E1 / E2 | **E1**: `graphContext.test.ts` で 0件・1件上流チェーン（源流→選択順）・複数選択トポロジカル順・テキスト/画像分離・分岐合流停止警告・ループ停止警告を確認。<br>**E2**: 実アプリでノード選択切替に追従して CommandDock の Context Strip 件数と分岐警告バッジが更新されることを確認する。 |
| REQ-10 | `[D-017]` | E1 / E2 | **E1**: `autoLayout.test.ts` で複数ノード＋エッジに対し `LR` 方向で重複なく座標更新されエッジが維持されることを確認。<br>**E2**: 実アプリで乱雑配置後に `整頓` ボタンを押し、接続を保って左→右へ整列することを確認する。 |
| REQ-14 | `[D-011]`, `[D-018]` | E2 | 実アプリで (a) 上部バー＋下部ドックのみの Canvas-First 構成（常設サイドバーなし）、(b) 生成中のローディング表示と多重送信ブロック、(c) 生成中に Clear Canvas 実行しても古い応答がキャンバスへ混入しないこと、(d) エラー・完了が `alert()` ではなくインアプリトーストで通知されることを確認する。 |
