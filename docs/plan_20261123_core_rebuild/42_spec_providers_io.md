# Specification Detail — External Providers, Image Assets & File I/O

全体構成・共通ポリシー・マップは [`40_specification.md`](./40_specification.md)、パス解決・セキュリティ共通規則は [`42_spec_core_data_security.md`](./42_spec_core_data_security.md)、受入条件の正本は [`30_requirement.md`](./30_requirement.md) を参照する。

---

## 1. LLM テキスト生成・Vision 入力・自動サマリー（REQ-07, REQ-15）

D-006: LLM テキスト生成・Vision 入力・自動サマリーサービス（LLMService）

- **対応 REQ**: `REQ-07`, `REQ-15`
- **担当ファイル**: `backend/llm.go`, `backend/llm_test.go`
- **依存注入**: `ConfigService` と `*http.Client`（デフォルト Timeout `120s`）をコンストラクタ注入し、`httptest.Server` による単体テストを成立させる。
- **通信仕様（確認済み知識: `docs/cheatsheet/multimodal_vision.md`）**:
  - **Endpoint**: `POST {strings.TrimRight(cfg.LLM.BaseURL, "/")}/chat/completions`
  - **Headers**:
    - `Content-Type: application/json`
    - `Authorization: Bearer {apiKey}` は **`strings.TrimSpace(cfg.LLM.APIKey) != ""` の場合のみ付与**（Ollama 等のローカル LLM で空キーを許容）。
  - **System Prompt**: `cfg.LLM.SystemPrompt` が非空ならそのまま使用。空なら既定値 `"You are a helpful assistant that generates documentation in Markdown format. Be concise and professional."` を使用。
  - **User メッセージ構築**:
    - 結合テキスト `userText`: `contextData != ""` なら `"Context:\n" + contextData + "\n\nUser Prompt:\n" + prompt`、空なら `prompt`。
    - `GenerateText`（画像なし）: `content` は文字列 `userText`。
    - `GenerateTextWithImages`（`len(imageDataURLs) > 0`）: `content` はパーツ配列 `[{ "type": "text", "text": userText }, { "type": "image_url", "image_url": { "url": dataURL } }, ...]`。`len(imageDataURLs) == 0` の場合は `GenerateText` と同等の文字列形式へフォールバック。
  - **サマリー生成（`GenerateSummary`）**:
    - `maxChars := cfg.Generation.SummaryMaxChars`（`<= 0` なら `100`）。
    - `system`: 既存の `cfg.LLM.SystemPrompt` があれば先頭に改行区切りで前置し、`"Summarize the following text in approximately %d characters or less. Focus on the core message."` を付与。
    - `user`: 対象本文をそのまま送信。
  - **レスポンス抽出**: `choices[0].message.content`（空白トリム後が空ならエラー）。
- **失敗時の振る舞い**:
  - `baseURL` または `model` が空: 通信前に設定不足エラーを返す。
  - 非 2xx HTTP ステータス / タイムアウト / ネットワーク断 / 不正 JSON / 空 `choices`: プロバイダー種別（`llm`）・モデル名・HTTP ステータス・切り詰めボディ（最大 500 文字）を含む正規化エラーを返し、`SanitizeError`（`[D-005]`）で API Key をマスクする。
  - **サマリー生成失敗時**: `GenerateText*` 完了後の自動サマリー生成が失敗しても、新規追加されたテキストノードの**本文 (`content`) と `originalPrompt` はそのまま維持**し、`summary` は空のまま警告トーストを表示する（ユーザーは後から NodeInspector で「サマリー生成」を手動再実行可能、`[D-013]`）。

---

## 2. マルチプロバイダー画像生成（REQ-08, REQ-15）

D-007: マルチプロバイダー画像生成ディスパッチャと4プロバイダーアダプタ（ImageGenService）

- **対応 REQ**: `REQ-08`, `REQ-15`
- **担当ファイル**: `backend/image.go`, `backend/provider_openrouter.go`, `backend/provider_openai.go`, `backend/provider_google.go`, `backend/provider_xai.go`, `backend/providers_test.go`
- **確認済み知識**: `docs/cheatsheet/image_generation_providers.md`（2026-05-05 確認済み）に準拠する。
- **インターフェースとディスパッチ**:
  ```go
  type GeneratedImagePayload struct {
      DataURL  string // data:image/...;base64,... 形式（優先）
      ImageURL string // HTTP(S) URL 形式（xAI / OpenAI の URL フォールバック用）
  }

  type ImageGenProvider interface {
      Name() string
      Generate(ctx context.Context, prompt string, refImages []string) (GeneratedImagePayload, error)
  }
  ```
  - `GenerateImage(prompt, contextData, refImages)` は `cfg.ImageGen.Provider` を選択して実行。
  - `GenerateImageWithProvider(prompt, contextData, refImages, provider)` は引数 `provider`（空なら `cfg.ImageGen.Provider`）でディスパッチし、**`config.json` は一切変更しない**。
  - `fullPrompt` 構築: `contextData != ""` なら `"Context:\n" + contextData + "\n\nPrompt:\n" + prompt`、空なら `prompt`。
  - 全プロバイダー共通 Timeout: `180s`（`*http.Client` 注入可能）。
  - **通信前バリデーション**: 4プロバイダーとも対象プロバイダーの `apiKey` が空の場合は、外部通信を行わず「{provider} の API Key が設定されていません」という正規化エラーを返す。

### 各プロバイダー通信仕様

| Provider | 参照画像なし | 参照画像あり | レスポンス抽出・備考 |
| --- | --- | --- | --- |
| **OpenRouter** (`openrouter`) | `POST {baseURL}/chat/completions`<br>`modalities: ["image"]`, `messages: [{role:"user", content: fullPrompt}]` | 同左。<br>`content: [{type:"text", text:fullPrompt}, {type:"image_url", image_url:{url:ref}}...]` | 1. `choices[0].message.images[0].image_url.url`（優先）<br>2. フォールバック: `choices[0].message.content` から `data:image/[^;]+;base64,[A-Za-z0-9+/=]+` を正規表現抽出。<br>既定: `baseURL="https://openrouter.ai/api/v1"`, `model="sourceful/riverflow-v2-fast"`。 |
| **OpenAI** (`openai`) | `POST {baseURL}/images/generations`<br>`{model, prompt:fullPrompt, n:1}`（非 `api.openai.com` または `dall-e-2`/`dall-e-3` は `response_format:"b64_json"` を付与） | `POST {baseURL}/responses`<br>参照画像は**最大 5 枚**（超過時は先頭 5 枚）。<br>`tools: [{type:"image_generation", ...}]`, `tool_choice: {type:"image_generation"}`。<br>`cfg.Model` が `gpt-image-` 始まりなら `tools[0].model` に設定（`quality:"medium"`, `size:"1536x1024"`）し、トップレベル `model` は `["gpt-5", "gpt-5-mini", "gpt-4o-mini"]` を順に試行。それ以外は `[cfg.Model, "gpt-5", "gpt-5-mini", "gpt-4o-mini"]` を順に試行。 | 参照なし: `data[0].b64_json`（PNG Data URL）優先、なければ `data[0].url` を `ImageURL` として返却。<br>参照あり: `output[]` の最初の `type=="image_generation_call"` から `output_format`（`png`/`jpeg`/`webp`、既定 `png`）と `result` (base64) を抽出。<br>既定: `baseURL="https://api.openai.com/v1"`, `model="gpt-image-1.5"`。 |
| **Google Gemini** (`google`) | `POST {baseURL}/v1beta/models/{model}:generateContent?key={apiKey}`<br>`contents: [{parts: [{text: fullPrompt}]}]` | 同左。<br>`parts` に参照画像 Data URL を分解した `{inline_data: {mime_type, data}}` を追加。 | `candidates[0].content.parts[]` のうち `inlineData.data != ""` な最初の要素から `data:{mimeType};base64,{data}` を生成。<br>既定: `baseURL="https://generativelanguage.googleapis.com"`（テスト差し替え可）, `model="gemini-2.5-flash-image"`。 |
| **xAI** (`xai`) | `POST {baseURL}/v1/images/generations`<br>`{model, prompt:fullPrompt, response_format:"b64_json", n:1}`（`image` キーは含めない） | `POST {baseURL}/v1/images/edits`<br>同ペイロードに**先頭 1 枚のみ** `image: {url: refImages[0]}` を付与（2枚目以降は無視）。 | `data[0].b64_json` があれば JPEG Data URL として返却。なければ `data[0].url` を `ImageURL` として返却（`[D-008]` で HTTP GET 保存）。<br>既定: `baseURL="https://api.x.ai"`（テスト差し替え可）, `model="grok-imagine-image"`。 |

- **失敗時の振る舞い**:
  - 未知の `provider` 名: 通信前にエラー返却。
  - HTTP 4xx/5xx・タイムアウト・不正 JSON・画像データ欠損（テキストのみ返却等）: `{provider}`・`{model}`・HTTP ステータス・切り詰めボディを含む正規化エラーを返し、`SanitizeError`（`[D-005]`）で API Key / `?key=...` / `Bearer ...` を確実にマスクする。
  - OpenAI Responses API の候補モデル試行中に 400/404 等のモデル非対応エラーが出た場合は次候補へフォールバックし、全候補失敗時に最後の正規化エラーを返す（401/403 認証エラー時は即座に失敗返却）。

---

## 3. 画像アセット保存・URL 取得・Data URL 解決（REQ-08, REQ-04, REQ-15）

D-008: 画像アセット保存（衝突回避命名・URLダウンロード）と Data URL / File URL 解決（ImageAssetService）

- **対応 REQ**: `REQ-08`, `REQ-04`, `REQ-15`
- **担当ファイル**: `backend/image_asset.go`, `backend/image_asset_test.go`
- **画像保存（`SaveGeneratedImage(payload GeneratedImagePayload)`）**:
  - `payload.DataURL != ""`: `data:image/<subtype>;base64,<data>` を解析・base64 デコードし、MIME から拡張子（`png`, `jpg`, `webp`, 既定 `png`）を決定。
  - `payload.ImageURL != ""`: `http://` または `https://` スキームのみ許可し、注入 `*http.Client`（Timeout `60s`）で HTTP GET してレスポンスバイト列を取得。`Content-Type`（または `http.DetectContentType`）から拡張子を決定。非 2xx や非画像 Content-Type、空ボディはエラー。
  - **衝突回避ファイル名**: `image_YYYYMMDD_HHMMSS_<4桁hexランダム>.<ext>`（`crypto/rand` 使用）。万一既存ファイルと重複した場合は最大 10 回再生成する。
  - 保存先ディレクトリが存在しない場合は `os.MkdirAll` で作成し、ファイル書き込み後に `downloadPath` からの相対パス（例: `"image_20261123_001200_3f9a.png"`、`/` 区切り正規化）を返す。
- **読み込み（`GetImageDataURL(src)` / `GetImageFileURL(src)`）**:
  - 必ず `ResolveImagePath(src)`（`[D-005]`）でパストラバーサルを検証する。
  - `GetImageDataURL`: 実ファイルを読み込み、拡張子または `http.DetectContentType` から MIME を判定し `data:<mime>;base64,<encoded>` を返す。
  - `GetImageFileURL`: 解決済み絶対パスを `url.URL{Scheme: "file", Path: ...}`（Windows の `C:\...` は `file:///C:/...` 形式）へ変換して返す。
- **失敗時の振る舞い**:
  - ファイル欠損（`os.IsNotExist`）やアクセス不可時は明確なエラーを返す。フロントエンド `ImageCardNode` / `ImageLightbox` はエラーを受け取ってもクラッシュせず欠損プレースホルダーを表示する（`[D-014]`）。

---

## 4. ファイルインポート（REQ-09, REQ-15）

D-009: ファイルインポート（D&D テキスト/画像取込・拡張子検証・衝突回避コピー）

- **対応 REQ**: `REQ-09`, `REQ-15`
- **担当ファイル**: `backend/file.go`, `backend/file_test.go`, `frontend/src/components/canvas/CanvasViewport.tsx`
- **返却構造体**:
  ```go
  type ImportFileResult struct {
      Kind    string `json:"kind"`              // "text" | "image"
      Content string `json:"content,omitempty"` // kind=="text" 時のファイル本文
      Src     string `json:"src,omitempty"`     // kind=="image" 時の downloadPath 相対パス ("Import/...")
      Name    string `json:"name"`              // 元ファイル名
  }
  ```
- **対応拡張子（大文字小文字不問）**:
  - テキスト: `.txt`, `.md` → UTF-8 テキストとして読み込み、`Kind: "text"` を返却。フロントエンドは新規 `customNode` を作成（`originalPrompt` なし）。
  - 画像: `.png`, `.jpg`, `.jpeg`, `.webp` → `downloadPath/Import/` ディレクトリへコピーし、`Kind: "image"`, `Src: "Import/<filename>"` を返却。フロントエンドは新規 `imageNode` を作成（`prompt` なし）。
  - **衝突回避命名**: `<sanitizedBaseName>_YYYYMMDD_HHMMSS_<4桁hexランダム><ext>`（ファイル名の危険文字を `_` へ正規化）。同名ファイルの再インポートでも既存ファイルを上書きしない。
- **失敗時の振る舞い**:
  - 非対応拡張子（例: `.pdf`, `.exe`, `.zip`）またはディレクトリドロップ: ファイルをコピーせず「未対応のファイル形式です: <name>」エラーを返す。
  - 複数ファイル一括 D&D 時: 各ファイルを順に処理し、成功したファイルはノード化しつつ、失敗したファイルのみ個別にエラートーストを表示してアプリを継続動作させる。

---

## 5. エクスポート機能（REQ-12, REQ-15）

D-010: エクスポート機能（単体 Markdown・単体画像コピー・Marp スライド変換）

- **対応 REQ**: `REQ-12`, `REQ-15`
- **担当ファイル**: `backend/file.go`, `frontend/src/utils/marpExport.ts`, `frontend/src/utils/marpExport.test.ts`
- **3 種類のエクスポート**:
  1. **単体 Markdown エクスポート**: 対象テキストノードの `content` を `ExportMarkdown(content)` 経由で保存ダイアログ（既定フィルタ `*.md`）から出力。
  2. **単体画像エクスポート**: 対象画像ノードの `src` を `ExportImage(src)` 経由で `ResolveImagePath`（`[D-005]`）検証後に保存ダイアログ（元拡張子フィルタ）からバイナリコピー出力。
  3. **Marp スライドエクスポート（`buildMarpMarkdown(nodes, imageUrlMap)`）**:
     - 対象ノード収集:
       - 複数選択時: トポロジカル順（未接続分は選択/配置順、`[D-016]` の順序ロジックを共有）。
       - 単一選択時: 上流トラバーサル結果（源流→選択ノード順）。
     - 先頭にフロントマターを付与:
       ```markdown
       ---
       marp: true
       paginate: true
       ---
       ```
     - 各ノードを `\n\n---\n\n` 区切りで連結する:
       - テキストノード: `content`（空なら `summary`）をそのままスライド本文にする。
       - 画像ノード: `GetImageFileURL(src)` で解決した URL を `![bg contain](<fileURL>)` として埋め込む（URL 解決失敗時は `<!-- image missing: <src> -->` を出力し警告トースト表示）。
     - 生成した Markdown を `ExportMarkdown` で保存ダイアログから出力する。
- **失敗時の振る舞い**:
  - 保存ダイアログのキャンセルは空文字列返却で静かに終了（トースト不要）。
  - 書き込み権限エラー・画像元ファイル欠損・パス検証エラー時はエラーを返し、フロントエンドでエラートーストを表示する。

---

## 6. 受入確認手順（`30_requirement.md` 対応）

| REQ | 対象設計 ID | 確認種別 | 具体的な確認手順・期待結果 |
| --- | --- | --- | --- |
| REQ-07 | `[D-006]`, `[D-013]`, `[D-018]` | E1 / E2 (EX可) | **E1**: `llm_test.go` で `httptest.Server` に対し (a) `systemPrompt` 既定/指定、(b) `apiKey` 空時の `Authorization` ヘッダー非送信、(c) Vision 画像配列 `image_url` 送信、(d) HTTP 500/空レスポンス時の正規化エラー＋マスク、(e) `GenerateSummary` 失敗エラー返却を確認。<br>**E2**: 実アプリ＋ローカルモック（または実 LLM）でテキスト/画像ノード選択から送信し、新規ノードに本文・サマリー・`originalPrompt` が反映されること、サマリー失敗時に本文が維持されることを確認（実課金 API 未接続時は `30_requirement.md` の EX 条件適用）。 |
| REQ-08 | `[D-007]`, `[D-008]`, `[D-018]` | E1 / E2 (EX可) | **E1**: `providers_test.go` / `image_asset_test.go` で 4 プロバイダーの (a) 参照なし、(b) 参照あり（OpenAI 5枚上限・xAI 1枚制限含む）、(c) URL フォールバックダウンロード、(d) HTTP エラー＋マスク、(e) 同一秒連続保存での衝突回避、(f) `GenerateImageWithProvider` でデフォルト設定が変わらないことを確認。<br>**E2**: 実アプリで CommandDock のプロバイダーを切り替えて生成し、画像ノードのみ 1 つ追加されること・設定モーダルのデフォルトプロバイダーが不変であることを確認（実キー未提供分は `30_requirement.md` の EX 条件適用）。 |
| REQ-09 | `[D-009]`, `[D-005]` | E1 / E2 | **E1**: `file_test.go` で `.txt`/`.md`/`.png`/`.jpg`/`.webp` インポート、同名画像 2 回インポートでの非上書き、非対応拡張子（`.pdf` 等）エラー返却を確認。<br>**E2**: 実アプリへ `.md`・`.png`・非対応ファイルを D&D し、対応ファイルがノード化され、非対応ファイルでエラートーストが出てアプリが継続動作することを確認。 |
| REQ-12 | `[D-010]`, `[D-005]` | E1 / E2 | **E1**: `marpExport.test.ts` でフロントマター、`---` 区切り、テキスト/画像ノード混在、画像 URL 埋め込みを確認。`file_test.go` で `ExportImage` のバイト一致とパストラバーサル拒否を確認。<br>**E2**: 実アプリで単体 `.md`・単体画像・Marp スライドを保存ダイアログ経由で出力し、出力ファイルの内容と画像一致を確認。 |
