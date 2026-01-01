# 設計仕様書 (Phase 3)

## 1. はじめに

本ドキュメントは Phase 3 の機能拡張に関する設計仕様書である。要求仕様書 (`docs/05_phase3_claim.md`) に基づき、以下を実装対象とする。

- エクスポート機能（Markdown / Marp）
- マルチモーダル（Vision）対応
- コンテキストトラバーサルの高度化（リンク構造に基づく文脈収集）
- UX 改善（Dangerous Zone からの Clear など）

本仕様書は、レビューおよび議論で確定した挙動（トラバーサル警告時の継続、Vision の content parts 方式、Marp Export 時の画像参照は絶対 file URL、Clear は AppStore 全初期化など）を反映する。

---

## 2. フロントエンド設計 (React)

### 2.1 コンテキストトラバーサル (Graph Logic)

#### 目的
ターゲットノード（通常はアクティブ/選択対象）に至るまでの「文脈（上流ノード）」をリンク構造から自動収集し、LLM の Context 生成や Export に利用する。

#### 実装場所
- `frontend/src/store/useAppStore.ts` 内の action
- または新規ユーティリティ `frontend/src/utils/graphUtils.ts`（推奨）

#### 前提（グラフ構造）
- Edge は `source -> target` の方向を持つ。
- 文脈収集は「ターゲットへ流入する Edge」を辿る（逆方向探索）。

#### アルゴリズム（逆方向探索）
1. ターゲットノードから開始し、`edge.target === currentNodeId` の Edge を検索する（上流探索）。
2. 上流が 0 件なら探索終了。
3. 上流が 1 件なら、その `edge.source` を次の `current` として探索を継続する。
4. **分岐チェック**：上流 Edge が 2 本以上の場合、**リンク構造エラー**として扱う。
5. **ループ検出**：訪問済みノードID集合を保持し、再訪問したら **リンク構造エラー**として扱う。

#### エラー（警告）時の挙動（確定）
- 分岐（上流 Edge 2 本以上）またはループが検出された場合：
  1. 探索をその時点で打ち切る。
  2. UI に **警告ダイアログ**を表示する。
     - 文言：`リンク構造にエラーがあります`
  3. ユーザーがダイアログを閉じたら、**それまでに辿れたノード列を用いて処理を続行する**。
     - 例：LLM 送信、Export は中断しない（部分コンテキストで続行）。
- 実装上は、トラバーサル関数は「ノード列 + warning 情報」を返す設計が望ましい。

#### 結果（返却値）
- 返却するノード列は「上流から下流（ターゲット）」の順序で並ぶこと。
- **ターゲットノード自身を必ず含める**（確定）。
- 返却値例（推奨）：
  - `nodes: AppNode[]`（上流→…→ターゲット）
  - `warning?: { kind: "branch" | "loop"; message: string }` など

---

### 2.2 エクスポート機能

#### 2.2.1 UI 拡張
- **ContextMenu** に以下を追加する：
  - `Export`（単一ノード用）
  - `Export as Slides (Marp)`（単一/複数ノード用）
- 実装：
  - `frontend/src/components/ui/ContextMenu.tsx` に項目とハンドラを追加
  - Store のアクション（`exportMarkdown`, `exportMarp` 等）を呼び出す

#### 2.2.2 Markdown / Marp 生成ロジック

##### テキストエクスポート
- 対象：テキストノード（`customNode`）の `data.content`
- 生成：`data.content` をそのまま `.md` として保存する

##### Marp エクスポート
- 入力：トラバーサル等で順序付けられたノード列
- ヘッダー：Frontmatter を付与する
  - 最低限 `marp: true`
  - `theme` は任意（例：`default`）
- ページ区切り：各スライドの間に `---` を挿入する
- スライド本文：
  - 基本はテキストノードの内容を配置する
  - 画像ノードが存在する場合は Marp/Markdown の画像記法で参照する（下記）

##### Marp エクスポートにおける画像参照（確定）
- **Marp export 時は画像参照を「絶対パスの file URL」に変換して出力する（要求）。**
  - 例：`file:///C:/.../Image/Import/foo.png`
- 画像の `src` はアプリ内部では相対パスで保持される（例：`Import/foo.png`）。Export 時に解決して file URL に変換する。
- 推奨出力形式：
  - `![](file:///Absolute/Path/To/Image/foo.png)`
  - または Marp 記法（例：`![bg right:40%](file:///...)`）は将来拡張とし、Phase 3 では最小限の標準記法でも可。

##### 画像解決失敗時の挙動（確定）
- 画像が存在しない/解決できない場合：
  1. 警告ダイアログを表示する（文言は `リンク構造にエラーがあります` に限定しない。画像の場合は別文言でもよいが、実装簡易性優先で共通化も可）。
  2. ダイアログを閉じたら **当該画像はスキップして Export を続行する**。

---

### 2.3 マルチモーダル UI（Vision）

#### 目的
テキストと画像を同時に入力として LLM に送信し、回答テキストを生成する。

#### PromptBar の UI 挙動
- 選択中ノード群に `imageNode` が含まれる場合：
  - `ImageIcon` とともに「+ N Image」バッジを表示する（N は画像ノード数）。
- 送信時は、テキストと画像を以下のように扱う（確定）：
  - テキストノード：複数選択されていれば **結合して 1 つのテキスト**にする
  - 画像ノード：**画像 1 枚ごとに content の 1 要素**として扱う（テキストに埋め込まない）

#### 送信データ（Frontend → Backend）
- 画像はローカルパスではなく、**data URL（Base64）として送る**（確定）。
  - 既存の画像表示用の仕組み（相対パス → data URL 変換）と整合させる。
- Backend へ送る引数（例）：
  - `prompt: string`
  - `contextText: string`（トラバーサルで得たテキストノードを結合）
  - `imageDataURLs: string[]`（選択/文脈に含まれる画像ノードの data URL）

---

## 3. バックエンド設計 (Go)

### 3.1 LLM Service 拡張（Vision / Content Parts 対応）

#### 対象プロバイダ（確定）
- 今回は **OpenRouter に限定**する。
- OpenRouter 内での細かな差異は Phase 3 では許容し、まず動作優先とする。

#### 背景
OpenAI 互換の Vision では `messages[].content` が以下の union になり得る：
- 文字列（従来）
- `[{type:"text",...},{type:"image_url",...}]` のようなオブジェクト配列（Vision）

#### 構造体変更
`ChatMessage.Content` を union 型として扱えるように変更する。

```go
// 変更前
type ChatMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

// 変更後（Phase 3）
type ChatMessage struct {
    Role    string      `json:"role"`
    Content interface{} `json:"content"` // string or []ContentPart
}

type ContentPart struct {
    Type     string    `json:"type"` // "text" or "image_url"
    Text     string    `json:"text,omitempty"`
    ImageURL *ImageURL `json:"image_url,omitempty"`
}

type ImageURL struct {
    URL string `json:"url"` // "data:image/png;base64,..." など
}
```

#### GenerateTextWithImages メソッド追加（確定）
既存の `GenerateText(prompt, contextData)` は温存し、Vision 用に別メソッドを追加する。

```go
func (s *LLMService) GenerateTextWithImages(prompt string, contextData string, imageDataURLs []string) (string, error)
```

- `imageDataURLs` は **既に data URL**（`data:image/...;base64,...`）であることを前提とする（確定）。
- リクエスト構築：
  - user message の `content` を `[]ContentPart` にする
  - 先頭に `{type:"text", text:"Context...\nPrompt..."}` を入れ、続けて画像分 `{type:"image_url", image_url:{url:dataURL}}` を追加する
- レスポンスは従来通り `choices[0].message.content`（文字列）を扱う。

#### 注意
- `ChatCompletionResponse` の message content は通常 string だが、プロバイダ差異は Phase 3 では深追いしない。
- 画像サイズが巨大な場合の取り扱い（上限/エラー文言）は必要に応じて追加する。

---

### 3.2 Export Service（File Service 拡張）

#### ExportMarkdown（確定）
- 引数：`content string`（生成された Markdown / Marp Markdown 全文）
- 処理：
  - `SaveFileDialog` を開く
  - 拡張子 `.md` を保存する

#### ExportImage（将来/任意）
- Phase 3 の必須ではない（Marp は絶対 file URL リンク方式で対応するため）。
- 実装する場合：
  - 引数：元画像の App 内相対パス
  - `SaveFileDialog` で保存先選択 → コピー

#### 画像 file URL 生成（Marp 用、確定）
- Marp export のために、Backend 側で以下のいずれかを提供する（推奨）：
  - `GetImageFileURL(src string) (string, error)`：相対 `src` を安全に解決して `file:///...` を返す
- 解決できない場合はエラーを返し、Frontend 側で警告→スキップで続行する。

---

## 4. データフロー詳細

### 4.1 LLM Request（Vision）

1. **Frontend**
   - ターゲットノードを決定（active node 等）。
   - トラバーサルで「上流→…→ターゲット」を取得（ターゲット含む）。
     - 分岐/ループ検出時は警告 `リンク構造にエラーがあります` を表示し、閉じられたら部分コンテキストで続行。
   - テキストノードは結合して `contextText` を作る。
   - 画像ノードは `GetImageDataURL(src)` 等を利用して `imageDataURLs[]` を作る。
   - `GenerateTextWithImages(prompt, contextText, imageDataURLs)` を呼ぶ（画像がなければ従来の `GenerateText` を呼ぶ）。

2. **Backend**
   - JSON Payload 構築（OpenAI互換の content parts）：
     ```json
     {
       "model": "gpt-4o",
       "messages": [
         {
           "role": "user",
           "content": [
             { "type": "text", "text": "Context: ...\nPrompt: ..." },
             { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
           ]
         }
       ]
     }
     ```
   - API 送信 & レスポンス受信。

3. **Frontend**
   - 生成されたテキストを受け取り、新規テキストノードとして追加。

---

### 4.2 Marp Export

1. **Frontend**
   - エクスポート対象ノード列を決定（選択中 or トラバーサル結果）。
   - Marp Markdown 文字列構築：
     ```markdown
     ---
     marp: true
     theme: default
     ---

     # Slide 1 (Node 1)
     Content...

     ---

     # Slide 2 (Node 2)
     ![](file:///Absolute/Path/To/Image/foo.png)
     ```
   - 画像ノードの `src`（相対）を、Backend の `GetImageFileURL` 等で **絶対 file URL** に変換して埋め込む（確定）。
   - 画像解決に失敗した場合は警告表示後、その画像はスキップして続行する（確定）。
   - `Backend.ExportMarkdown(markdownString)` をコール。

2. **Backend**
   - 保存ダイアログ表示 → `.md` ファイル保存。

---

## 5. UX 改善（Clear / Dangerous Zone）

### 5.1 Clear（キャンバス初期化）の仕様（確定）
- 設定ダイアログの **Dangerous Zone** から実行する。
- **確認ダイアログは不要**（即時実行）。
- 実行後は **起動時と同等の状態**に戻る：
  - `AppStore` を全初期化（nodes/edges/activeNodeId/isDrawerOpen 等）
- undo 機能は存在しないため考慮外。

---

## 6. 実装ステップ（更新版）

1. **Frontend**: トラバーサルロジック実装（ノード列 + warning を返す）。warning 時は `リンク構造にエラーがあります` を表示し、閉じたら部分コンテキストで続行。
2. **Frontend**: PromptBar 改修
   - ターゲット含むコンテキスト生成（テキストは結合、画像は data URL 配列）
   - 画像がある場合は `GenerateTextWithImages`、ない場合は従来 `GenerateText` を呼ぶ
   - 画像数バッジ表示（`+ N Image`）
3. **Backend**: `LLMService` 改修（`ChatMessage.Content` を union 対応に変更）
4. **Backend**: `GenerateTextWithImages(prompt, contextData, imageDataURLs)` 実装 + `App` 経由で公開
5. **Backend**: ExportMarkdown 実装（FileService 拡張、SaveFileDialog → `.md` 保存）
6. **Backend**: Marp 用 `GetImageFileURL(src)`（または同等）実装（相対 src → 絶対 file URL）
7. **Frontend**: Marp Markdown 生成ロジック実装（画像は絶対 file URL、解決失敗は警告→スキップ）
8. **Frontend**: ContextMenu に Export / Marp Export を追加し Store アクションに接続
9. **Frontend**: Settings の Dangerous Zone に Clear（全初期化）を実装（確認なし）

---