# 設計仕様書 (Phase 3)

## 1. はじめに

本ドキュメントは Phase 3 の機能拡張に関する設計仕様書である。
要求仕様書 (`docs/05_phase3_claim.md`) に基づき、エクスポート機能、マルチモーダル対応、コンテキストトラバーサルの高度化、および UX 改善の実装詳細を定義する。

## 2. フロントエンド設計 (React)

### 2.1 コンテキストトラバーサル (Graph Logic)

ノード選択時に、そのノードに至るまでの「文脈（上流ノード）」を自動収集するロジックを実装する。

*   **実装場所**: `useAppStore.ts` または新規ユーティリティ `src/utils/graphUtils.ts`
*   **アルゴリズム**:
    *   ターゲットノードから開始し、Edge の `target` が現在のノードであるものを検索（逆方向探索）。
    *   再帰的に上流（Source）を辿る。
    *   **分岐チェック**: あるノードに対して `target` となる Edge が 2本以上ある場合、探索を中止しエラー（または警告）を返す。
    *   **ループ検出**: 訪問済みノードリストを保持し、再訪問時は探索を打ち切る（基本的なDAG構造なら発生しないはずだが念のため）。
*   **結果**:
    *   探索されたノードのリストを「上流から下流」の順序でソートして返す。
    *   このリストを LLM の Context 生成に使用する。

### 2.2 エクスポート機能

#### 2.2.1 UI 拡張
*   **ContextMenu**: `Export` (単一ノード用) および `Export as Slides (Marp)` (複数/単一ノード用) を追加。
*   **実装**: `ContextMenu.tsx` にハンドラを追加し、Store のアクションを呼び出す。

#### 2.2.2 Markdown / Marp 生成ロジック
*   **テキストエクスポート**: ノードの `data.content` をそのままファイルに書き出す。
*   **Marp エクスポート**:
    *   トラバーサル等で順序付けられたノードリストを入力とする。
    *   ヘッダー: `marp: true` を含む Frontmatter を付与。
    *   ページ区切り: 各ノードのコンテンツ間に `---` を挿入。
    *   画像処理:
        *   `![bg right:40%](path/to/image.png)` のような Marp 記法、または標準的な `![](...)` 記法を使用。
        *   画像パスは**絶対パス**または**Markdownファイルからの相対パス**である必要がある。
        *   エクスポート時に画像ファイルも一緒にエクスポート先フォルダへコピーするか、あるいは Data URL 埋め込み (Base64) を行うか検討が必要。
        *   **Phase 3 方針**: シンプルさのため、まずは「Markdownテキストのみ出力」とし、画像パスは元の保存場所（`Image/`）への絶対パス、または相対パスを記述する。スライド配布用には「画像埋め込み」オプションがあると良いが、まずはリンク方式とする。

### 2.3 マルチモーダル UI
*   **PromptBar**:
    *   選択中のノードに `imageNode` が含まれる場合、`ImageIcon` と共に「+ 1 Image」のようなバッジを表示する。
    *   送信時、テキストノードのコンテンツ（文字列）と画像ノードのパス（文字列配列）を分けて Backend に送信する。

## 3. バックエンド設計 (Go)

### 3.1 LLM Service 拡張 (Vision API 対応)

OpenAI 互換 API の Vision 機能 (`gpt-4o`, `claude-3-opus` 等) に対応するため、リクエスト構造体を動的に扱えるように変更する。

#### 構造体変更
現在の `ChatMessage` 構造体は `Content string` となっているが、Vision API では `Content` が「文字列」または「オブジェクトの配列」になり得る。

```go
// 変更前
type ChatMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

// 変更後 (Custom Marshaling または interface{} 使用)
type ChatMessage struct {
    Role    string      `json:"role"`
    Content interface{} `json:"content"` // string or []ContentPart
}

type ContentPart struct {
    Type     string     `json:"type"` // "text" or "image_url"
    Text     string     `json:"text,omitempty"`
    ImageURL *ImageURL  `json:"image_url,omitempty"`
}

type ImageURL struct {
    URL string `json:"url"` // "data:image/jpeg;base64,..." or http url
}
```

#### GenerateTextWithImages メソッド追加
既存の `GenerateText` とは別に（あるいは拡張して）、画像を受け取るメソッドを追加する。

```go
func (s *LLMService) GenerateTextWithImages(prompt string, contextData string, imagePaths []string) (string, error)
```

1.  `imagePaths` (ローカルパス) を受け取る。
2.  各画像を読み込み、Base64 エンコードして Data URL (`data:image/png;base64,...`) に変換する。
3.  `ContentPart` 配列を作成し、テキスト（Prompt + Context）と画像を格納する。
4.  API リクエストを送信する。

### 3.2 Export Service (File Service 拡張)

#### ExportMarkdown
*   引数: ファイル名、コンテンツ内容。
*   処理: `SaveFileDialog` を開き、指定場所に `.md` ファイルを保存する。

#### ExportImage
*   引数: 元画像のパス (App内相対パス)。
*   処理: `SaveFileDialog` (フィルタ: png, jpg) を開き、元画像を読み込んで指定先にコピー（書き込み）する。

## 4. データフロー詳細

### 4.1 LLM Request (Vision)

1.  **Frontend**:
    *   ユーザーがノード選択（テキスト + 画像）。
    *   PromptBar で指示入力 & 送信。
    *   `GenerateText(prompt, contextText, imagePaths)` をコール。
2.  **Backend**:
    *   画像パス (`Image/foo.png`) からファイルを読み込み Base64 化。
    *   JSON Payload 構築:
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
    *   API 送信 & レスポンス受信。
3.  **Frontend**:
    *   生成されたテキストを受け取り、新規ノードとして追加。

### 4.2 Marp Export

1.  **Frontend**:
    *   エクスポート対象ノードを決定（選択中 or トラバーサル結果）。
    *   Markdown 文字列構築:
        ```markdown
        ---
        marp: true
        theme: default
        ---
        # Slide 1 (Node 1)
        Content...
        ---
        # Slide 2 (Node 2)
        ![bg right](file:///Absolute/Path/To/Image/foo.png)
        ```
    *   `Backend.ExportMarkdown(markdownString)` をコール。
2.  **Backend**:
    *   保存ダイアログ表示 -> ファイル保存。

## 5. 実装ステップ

1.  **Backend**: `LLMService` の改修。`Content` フィールドの型変更と Vision API 対応リクエスト構築ロジックの実装。
2.  **Backend**: `GenerateTextWithImages` メソッドの実装と `App` 構造体への公開。
3.  **Frontend**: `useAppStore` にトラバーサルロジック (`getFlowNodes`) を実装。
4.  **Frontend**: `PromptBar` の改修。画像選択時の表示と、Backend メソッド呼び出しの分岐（画像あり/なし）。
5.  **Backend & Frontend**: エクスポート機能（Markdown保存、画像保存）の実装。
6.  **Frontend**: Marp 用 Markdown 生成ロジックの実装。
7.  **Frontend**: キャンバス初期化（Clear）機能の実装。