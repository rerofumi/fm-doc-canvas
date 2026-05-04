docs/08_phase4_specification.md
```

```markdown
# 設計仕様書 (Phase 4)

## 1. はじめに

本ドキュメントは Phase 4 の機能拡張に関する設計仕様書である。要求仕様書 (`docs/07_phase4_claim.md`) に基づき、以下を実装対象とする。

- **システムプロンプトの導入**: LLM の応答品質（特に日本語化）の向上。
- **OpenAI 画像生成の参照画像対応**: 複数の参照画像を用いた生成フローの適正化。

---

## 2. バックエンド設計 (Go)

### 2.1 システムプロンプト (System Prompt)

#### 目的
LLM に対して「常に日本語で回答する」「簡潔に答える」などの振る舞いを指示するためのシステムプロンプトを設定・永続化し、リクエスト時に適用する。

#### 設定 (`Config`) の拡張
`backend/config.go` の `LLMConfig` 構造体にフィールドを追加する。

```go
type LLMConfig struct {
    BaseURL      string `json:"baseURL"`
    Model        string `json:"model"`
    APIKey       string `json:"apiKey"`
    SystemPrompt string `json:"systemPrompt"` // 新規追加
}
```

- デフォルト値: 空文字 `""` (ユーザーが未設定の場合)。
- ユーザーが設定画面で入力した値を `config.json` に保存する。

#### LLM Service (`backend/llm.go`) の変更
`GenerateText` および `GenerateTextWithImages` メソッドにおいて、API リクエスト構築時に `system` ロールのメッセージを先頭に追加する。

**処理フロー**:
1. `config.LLM.SystemPrompt` を読み込む。
2. 空でなければ、`messages` 配列の先頭に以下を追加する:
   ```json
   { "role": "system", "content": "設定されたシステムプロンプト" }
   ```
3. 続いて `user` ロールのメッセージ（Prompt + Context）を追加する。
4. LLM プロバイダへ送信する。

---

### 2.2 OpenAI 画像生成の参照画像対応

#### 現状の課題
現在、参照画像がある場合に `editImage` (`/images/edits`) を使用しているが、これは本来「マスク編集」などのための API であり、複数の参照画像をもとにした新規生成（Image-to-Image / Style Reference）としては不適切である。

#### 要求仕様
- 参照画像が **ない** 場合: 既存の `/images/generations` (DALL-E 3 等) を使用（変更なし）。
- 参照画像が **ある** 場合 (1〜5枚): **Responses API** (`POST /v1/responses`) を使用する。
  - 画像生成を行うために `tools: [{ "type": "image_generation" }]` が必須。

#### 実装方針 (`backend/openai.go`)

`Generate` メソッド内の分岐ロジックを変更する。

1. **参照画像なし**: `generateImage` (既存) を呼ぶ。
2. **参照画像あり**: `generateWithChatCompletion` (新規/修正) を呼ぶ。

#### `generateWithChatCompletion` の仕様

本機能で参照する "responses API" は **Responses API** (`POST /v1/responses`) を指す。従来の `image edit` (`/images/edits`) は廃止し、参照画像がある場合は Responses API の **image generation tool** を用いて生成する。

*   **Endpoint**: `/responses` (BaseURL に依存。`BaseURL + "/responses"`)
*   **モデルの扱い (重要)**:
    - Responses API の top-level `model` は **controller**（ツール呼び出しを決定するチャット/推論モデル）。
    - 実際に画像を生成するモデルは `tools: [{"type":"image_generation","model":"..."}]` の `model`（= **image tool model**）。
    - 実装では `ImageGen.OpenAI.Model`（= `p.config.Model`）の値によって意味が変わる:
        1. `gpt-image-*` が設定されている場合: それを **image tool model** として扱う（例: `gpt-image-1.5`）。controller は `gpt-5` 系を使用。
        2. `gpt-*` の chat モデルが設定されている場合: それを controller に使う（fallback あり）。image tool model は未指定（プロバイダ側デフォルト）
*   **controller のフォールバック**:
    - provider/org の対応状況差を吸収するため、controller は複数候補を順に試す（例: `gpt-5` → `gpt-5-mini` → `gpt-4o-mini`）。
*   **Payload**:
    - 参照画像は `data:image/...;base64,...` の **data URL** を `input_image.image_url` に渡す。
    - テキストは `input_text.text` に渡す。
    - 参照画像は最大 5 枚に制限する。
    - 画像生成には `tools: [{ "type": "image_generation" }]` が必須。
    - `tool_choice: {"type":"image_generation"}` を指定し、**text 応答ではなく tool 呼び出しを強制**する（`image_generation_call` を確実に得るため）。
    - 追加の tool オプション（実装済み）:
        - `quality: "medium"`
        - `size: "1536x1024"`
        ※ これらは image tool model（`gpt-image-*`）が指定されている場合に tool に付与される。

    ```json
    {
      "model": "controller model (例: gpt-5)",
      "input": [
        {
          "role": "user",
          "content": [
            { "type": "input_text", "text": "(tool 呼び出しの指示) + Prompt + Context..." },
            { "type": "input_image", "image_url": "data:image/png;base64,..." }
            // ... 参照画像分（最大5枚）
          ]
        }
      ],
      "tools": [
        {
          "type": "image_generation",
          "model": "gpt-image-1.5",
          "quality": "medium",
          "size": "1536x1024"
        }
      ],
      "tool_choice": { "type": "image_generation" }
    }
    ```

*   **Response Handling**:
    *   API レスポンスは `choices[0].message.content` ではなく、`response.output[]` に **image_generation_call** が含まれる。
    *   生成画像は `output[].result` に **Base64**（拡張子は `output_format` に依存。未指定なら通常 PNG/JPEG）として格納される。
    *   実装では以下の流れを取る:
        1. `response.output` から `type === "image_generation_call"` の要素を抽出する
        2. 最初の `result`（Base64）を取得する
        3. `data:image/...;base64,` の data URL に変換して既存の `downloadAndSaveImage` で保存する
    *   `image_generation_call` が存在しない場合はエラーとして扱う（レスポンス全体をログ/エラーに残す）。

---

## 3. フロントエンド設計 (React)

### 3.1 設定画面 (Settings Modal)

#### LLM 設定
- **System Prompt** 入力エリアを追加 (`Textarea`)。
- `LLM Model` 設定の下あたりに配置。
- 値は `config.llm.systemPrompt` とバインドする。

### 3.2 画像生成フロー

- ユーザー操作に変更はない（画像を選択してプロンプト入力）。
- バックエンド側で API の切り替えが行われるため、フロントエンドは「成功時に返却された画像パスを表示する」という既存の動きを踏襲する。

---

## 4. 補足: 互換性と制約

- **Responses API の画像生成**:
  - Responses API で画像生成を行うには `tools: [{ "type": "image_generation" }]` が必須。
  - リクエストは `messages` ではなく `input` 形式（`input_text` / `input_image`）で組み立てる。
  - レスポンスは `response.output[]` に `image_generation_call` として返り、画像は `result` の Base64 で取得する。
- **OpenAI 純正 DALL-E 系**:
  - DALL-E 3 等は（本設計では）参照画像なしのケースで `/images/generations` を利用する。
  - 参照画像ありのケースは `/responses` + `image_generation` tool を利用するため、設定するモデルが tool 呼び出しに対応している必要がある。
- 参考: `https://platform.openai.com/docs/api-reference/responses/create`
