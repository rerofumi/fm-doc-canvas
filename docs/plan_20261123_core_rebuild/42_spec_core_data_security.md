# Specification Detail — Core, Data Compatibility & Security

全体構成・共通ポリシー・マップは [`40_specification.md`](./40_specification.md)、受入条件の正本は [`30_requirement.md`](./30_requirement.md) を参照する。

---

## 1. ツールチェーン・ビルド基盤（REQ-01）

D-001: mise ツールチェーンと Wails v2 + React/TS プロジェクト基盤

- **対応 REQ**: `REQ-01`
- **`mise.toml` 構成**:
  - `go`（1.24+）、`node`（LTS）を `[tools]` で管理し、Wails v2 CLI（v2.12 系）は `mise` 管理の Go 環境経由または `[tools]` で利用可能にする（導入形態の最終確認は WP-1 の環境観測で行う）。
  - `[tasks]` に標準タスクを定義する:
    - `mise run test-backend`: `go test ./...`
    - `mise run test-frontend`: `npm --prefix frontend test -- --run`（Vitest）
    - `mise run build-frontend`: `npm --prefix frontend run build`（`tsc --noEmit && vite build`）
    - `mise run build`: `wails build`
    - `mise run dev`: `wails dev`
- **フロントエンド依存パッケージ**:
  - 実行時: `react` (18.x), `react-dom` (18.x), `@xyflow/react` (12.x), `zustand`, `dagre`, `react-markdown`, `remark-gfm`, `lucide-react`
  - 開発時: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/typography`, `vitest`, `@types/dagre`
- **Wails エントリポイント（`main.go`）**:
  - `options.App` で `DragAndDrop: &options.DragAndDrop{ EnableFileDrop: true, DisableWebViewDrop: true }` を有効化し、OS ファイルマネージャからの D&D を Wails イベントで受信する（`[D-009]`）。
  - `OnStartup` で `app.startup(ctx)` を呼び出し、Wails runtime コンテキストを `FileService` 等へ保持する。

---

## 2. Wails バックエンドファサードとサービス境界（REQ-01, 07, 08, 09, 11, 12, 13, 15）

D-002: Wails バックエンドファサードとサービス境界（app.go / backend/*）

- **対応 REQ**: `REQ-01`, `REQ-07`, `REQ-08`, `REQ-09`, `REQ-11`, `REQ-12`, `REQ-13`, `REQ-15`
- **責務分離**: `app.go` は Wails バインディングの薄いファサードに徹し、実処理は `backend/` 配下の 5 サービスへ委譲する。各サービスは `ConfigService` と差し替え可能な `*http.Client` / ベースディレクトリリゾルバを注入可能とする。

### Wails バインドメソッド一覧（`app.go`）

| Method | Signature | 委譲先 | 備考 |
| --- | --- | --- | --- |
| `GetConfig` | `() (backend.Config, error)` | `ConfigService` | ローカル設定を取得。欠損時はデフォルト返却（上書きしない） |
| `SaveConfig` | `(cfg backend.Config) error` | `ConfigService` | デフォルト補完のうえ全4プロバイダーを非破壊保存 |
| `GenerateText` | `(prompt, contextData string) (string, error)` | `LLMService` | テキストのみ LLM 問い合わせ |
| `GenerateTextWithImages` | `(prompt, contextData string, imageDataURLs []string) (string, error)` | `LLMService` | Vision マルチモーダル LLM 問い合わせ |
| `GenerateSummary` | `(text string) (string, error)` | `LLMService` | `summaryMaxChars` 目安のサマリー生成 |
| `GenerateImage` | `(prompt, contextData string, refImages []string) (string, error)` | `ImageGenService` | `config.imageGen.provider` で画像生成し相対パス返却 |
| `GenerateImageWithProvider` | `(prompt, contextData string, refImages []string, provider string) (string, error)` | `ImageGenService` | リクエスト単位でプロバイダー指定（`config.json` は不変） |
| `GetImageDataURL` | `(src string) (string, error)` | `ImageAssetService` | パス検証後に `data:<mime>;base64,...` を返却 |
| `GetImageFileURL` | `(src string) (string, error)` | `ImageAssetService` | パス検証後に `file:///` 形式の絶対 URL を返却（Marp 用） |
| `SaveCanvasToFile` | `(jsonData string) (string, error)` | `FileService` | 保存ダイアログを開き JSON 書込。キャンセル時は `("", nil)` |
| `LoadCanvasFromFile` | `() (string, error)` | `FileService` | 読込ダイアログを開き JSON 読込。キャンセル時は `("", nil)` |
| `ImportFile` | `(filePath string) (backend.ImportFileResult, error)` | `FileService` | `.txt/.md` 読込または画像を `downloadPath/Import/` へ衝突回避コピー |
| `ExportMarkdown` | `(content string) (string, error)` | `FileService` | 保存ダイアログを開き `.md` 書込。キャンセル時は `("", nil)` |
| `ExportImage` | `(src string) (string, error)` | `FileService` | パス検証後、保存ダイアログを開き画像コピー。キャンセル時は `("", nil)` |

- **ダイアログキャンセル契約**: `SaveCanvasToFile`, `LoadCanvasFromFile`, `ExportMarkdown`, `ExportImage` はユーザーが OS ダイアログをキャンセルした場合、エラーではなく空文字列 `""` と `nil` エラーを返す。フロントエンドは空文字列を受け取った場合は正常キャンセル扱いとし、エラートーストを出さない。

---

## 3. ローカル設定スキーマと互換マイグレーション（REQ-13, REQ-15）

D-003: ローカル設定スキーマ（config.json）・4プロバイダー非破壊永続化・旧フラット形式マイグレーション

- **対応 REQ**: `REQ-13`, `REQ-15`
- **保存先**: `filepath.Join(os.UserConfigDir(), "fm-doc-canvas", "config.json")`（テスト時は設定ファイルパス注入可能）。パーミッションは `0600`（ディレクトリは `0700`）を基本とする。
- **正規 JSON 構造**:

```json
{
  "llm": {
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "apiKey": "",
    "systemPrompt": ""
  },
  "generation": {
    "summaryMaxChars": 100
  },
  "imageGen": {
    "provider": "openrouter",
    "downloadPath": "Image/",
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "model": "sourceful/riverflow-v2-fast",
      "apiKey": ""
    },
    "openai": {
      "baseURL": "https://api.openai.com/v1",
      "model": "gpt-image-1.5",
      "apiKey": ""
    },
    "google": {
      "model": "gemini-2.5-flash-image",
      "apiKey": ""
    },
    "xai": {
      "model": "grok-imagine-image",
      "apiKey": ""
    }
  }
}
```

- **旧フラット形式の自動マイグレーション（`ImageGenConfig.UnmarshalJSON`）**:
  - 既存ファイルに旧フラットフィールド `imageGen.baseURL`, `imageGen.model`, `imageGen.apiKey` が存在する場合、対象プロバイダー（`imageGen.provider`、空なら `"openrouter"`）の個別構造体へ値を移す。
  - **競合規則**: 個別構造体側（例: `imageGen.openrouter.apiKey`）に既に非空値がある場合は個別構造体側を優先し、空フィールドのみ旧フラット値で補完する。
  - 再保存時は正規の4プロバイダー構造のみを書き出し、旧フラットフィールドは出力しない。
- **非破壊永続化**:
  - `SaveConfig` 時は、未入力の任意項目（空の `baseURL` / `model` / `downloadPath` / `summaryMaxChars <= 0` 等）にデフォルト値を補完しつつ、4プロバイダーすべて（`openrouter`, `openai`, `google`, `xai`）の `apiKey`・`model`・`baseURL` を欠落させず書き出す。
  - 書き込みは一時ファイルへの書き出し後リネーム（アトミック置換）を行い、途中失敗による既存 `config.json` 破損を防ぐ。
- **失敗時の振る舞い**:
  - `config.json` が存在しない場合（`os.IsNotExist`）: デフォルト設定をメモリ上で返却する（ファイルは自動作成しない）。
  - `config.json` が壊れた JSON の場合: `GetConfig` はエラーを返し、既存ファイルを上書きしない。フロントエンドは起動時にデフォルト設定へフォールバックしつつ、「設定ファイルの読み込みに失敗しました（既存ファイルは保護されています）」と警告トーストを表示する。

---

## 4. キャンバス JSON v1.1 / v1.0 互換と正規化（REQ-11, REQ-15）

D-004: キャンバス JSON（v1.1 / v1.0 互換）シリアライザ・正規化・秘匿情報除外

- **対応 REQ**: `REQ-11`, `REQ-15`
- **担当箇所**: `frontend/src/utils/canvasSerializer.ts`（純粋関数）
- **永続化スキーマ（`CanvasFileV1_1`）**:

```ts
export interface TextNodeData extends Record<string, unknown> {
  content: string;
  summary: string;
  originalPrompt?: string;
}

export interface ImageNodeData extends Record<string, unknown> {
  src: string;        // downloadPath からの相対パス（例: "image_20261123_001200_a1b2.png", "Import/photo_...png"）
  alt?: string;       // 互換用説明/プロンプト
  prompt?: string;    // 生成プロンプト
  provider?: string;  // "openrouter" | "openai" | "google" | "xai"
  model?: string;     // 使用モデル名
}

export interface CanvasFileV1_1 {
  version: "1.1";
  metadata?: { lastOpened?: string };
  llm?: { baseURL?: string; model?: string }; // apiKey は絶対に含めない
  nodes: Array<{
    id: string;
    type: "customNode" | "imageNode";
    position: { x: number; y: number };
    data: TextNodeData | ImageNodeData;
    width?: number;
    height?: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    markerEnd?: { type: string };
  }>;
}
```

- **v1.0 / v1.1 読み込み正規化ルール（`deserializeCanvas`）**:
  - 許容バージョン: `"1.0"`, `"1.1"`, または `version` 省略（v1.0 相当）。それ以外の未知メジャーバージョン等はエラーを返す。
  - ノード `type`: `"customNode"`（テキスト）および `"imageNode"`（画像）を維持。テキストノードの `content` / `summary` が欠損している場合は `""` で補完。画像ノードの `src` が欠損している場合は `""`（カード側で欠損プレースホルダー表示）。
  - エッジ正規化: `sourceHandle` が欠損/`null` なら右出力ハンドル `"right"`、`targetHandle` が欠損/`null` なら左入力ハンドル `"left"` を補完し、有向矢印 `markerEnd: { type: MarkerType.ArrowClosed }` を補完する。存在しないノード ID を指す孤立エッジは安全に除外する。
  - `position` が不正（数値でない等）なノードは `{ x: 0, y: 0 }` にフォールバックする。
- **秘匿情報除外ルール（`serializeCanvas`）**:
  - 出力 `llm` メタデータに含めるのは `baseURL` と `model` のみとし、`apiKey`・`systemPrompt`・`imageGen` 配下のキーは構造上受け取らず出力しない。
- **失敗時の振る舞い**:
  - 不正 JSON・配列欠損・非対応フォーマットの場合は例外/エラー結果を返し、**現在開いているキャンバスの状態を一切変更せず**エラー内容をトースト表示する。

---

## 5. パス解決基準・セキュリティ・マスキング（REQ-15, REQ-04, REQ-08, REQ-09, REQ-12）

D-005: 画像パス解決基準（wails dev / 実行バイナリ）・パストラバーサル検証・API Key マスキング

- **対応 REQ**: `REQ-15`, `REQ-04`, `REQ-08`, `REQ-09`, `REQ-12`
- **`downloadPath` ベースディレクトリ解決基準**:
  1. `cfg.ImageGen.DownloadPath` が空の場合は `"Image/"` を適用する。
  2. `filepath.IsAbs(downloadPath)` が `true` の場合は `filepath.Clean(downloadPath)` をそのままルートとする。
  3. 相対パスの場合、以下の優先順位で基準ディレクトリ `baseDir` を解決し、`filepath.Join(baseDir, downloadPath)` をルートとする:
     - 優先 1: 環境変数 `FM_DOC_CANVAS_BASE_DIR` が非空ならその値（自動テスト・明示検証用）。
     - 優先 2: ビルド形態別解決
       - **`wails dev`（`//go:build dev`, `backend/path_base_dev.go`）**: `os.Getwd()` を使用（取得失敗時は `filepath.Dir(os.Executable())`）。※Wails v2.12 で `-tags dev` および `os.Getwd() == プロジェクトルート` であることは未確認前提として WP-1/WP-4 で実測確認する。
       - **ビルド後実行バイナリ（`//go:build !dev`, `backend/path_base_prod.go`）**: `filepath.Dir(os.Executable())` を使用し、実行ファイル隣接の `Image/` を基準とする（v0.4.2 互換）。
- **パストラバーサル拒否ルール（`ResolveImagePath(src string)`）**:
  - 入力 `src` に対し、以下をすべてエラーで拒否する:
    - 空文字列
    - 絶対パス（`filepath.IsAbs(src)`、先頭 `/` や `\`、Windows ドライブレター `C:` を含むパス）
    - `..` セグメントを含むパス（`/`・`\` 統一後に判定）
    - `filepath.Rel(absDownloadRoot, absResolved)` の結果が `".."` または `".."+string(filepath.Separator)` で始まるパス
    - シンボリックリンク解決（`filepath.EvalSymlinks` が成功した場合）の結果が `absDownloadRoot` 配下から逸脱するパス
  - **適用範囲**: `GetImageDataURL`, `GetImageFileURL`, `ExportImage` のすべてが `ResolveImagePath` を必ず経由する。
- **API Key マスキング（`backend/sanitize.go`）**:
  - `SanitizeError(err error, secrets ...string) error` および `SanitizeText(s string, secrets ...string) string` を定義する。
  - LLM および 4 画像プロバイダーのすべてのエラー生成・ログ出力前に以下を実行する:
    1. 既知の `apiKey`（非空文字列）の完全一致を `"[REDACTED]"` に置換する。
    2. URL クエリパラメータ `key=[^&\s"']+`（Google Gemini の `?key=...` 対策）を `key=[REDACTED]` に置換する。
    3. `Bearer\s+[A-Za-z0-9._\-]+` を `Bearer [REDACTED]` に置換する。

---

## 6. 受入確認手順（`30_requirement.md` 対応）

| REQ | 対象設計 ID | 確認種別 | 具体的な確認手順・期待結果 |
| --- | --- | --- | --- |
| REQ-01 | `[D-001]`, `[D-002]` | E1 | 1. 必要に応じ `mise install` を実行。<br>2. `mise run test-backend`、`mise run test-frontend`、`mise run build-frontend`、`mise run build` を順に実行。<br>3. 全コマンドが終了コード 0 で完了し、ビルド済み実行バイナリが生成されることを確認する。 |
| REQ-11 | `[D-004]`, `[D-002]` | E1 / E2 | **E1**: `canvasSerializer.test.ts` で (a) v1.1 保存→再読込の往復一致、(b) v1.0 fixture（エッジハンドル欠損・任意フィールド欠損）の正規化読込、(c) 不正 JSON 時のエラー返却、(d) 出力 JSON 文字列に API Key が含まれないことを確認。<br>**E2**: 実アプリでテキスト・画像ノードとエッジを作成し `Save` → `Clear Canvas` → `Open` で完全復元されることを確認する。 |
| REQ-13 | `[D-003]`, `[D-002]` | E1 / E2 | **E1**: `config_test.go` で (a) 4プロバイダーのキー登録後にデフォルトプロバイダーを切り替えて保存→再読込し全キー保持を確認、(b) 旧フラット形式 JSON（`imageGen.baseURL/model/apiKey`）読み込み時の自動マイグレーションを確認、(c) 破損 JSON 時にファイルが上書きされないことを確認。<br>**E2**: 実アプリの設定モーダルで複数プロバイダーキーを保存→アプリ再起動→全プロバイダー設定が維持されることを確認する。 |
| REQ-15 | `[D-005]`, `[D-003]`, `[D-004]` | E1 / E3 | **E1**: `image_asset_test.go` で `../secret.png`, `/etc/passwd`, `C:\Windows\win.ini`, `Import/../../x.png` が `GetImageDataURL` / `GetImageFileURL` / `ExportImage` すべてで拒否されることを確認。`sanitize_test.go` で API Key・Google `?key=...`・`Bearer ...` がエラー文言から `[REDACTED]` へマスクされることを確認。<br>**E3**: `backend/` および `frontend/src/utils/canvasSerializer.ts` の実装を確認し、API Key が `config.json` 以外に保存・出力されないことを確認する。 |
