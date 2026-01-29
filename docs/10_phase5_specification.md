# 設計仕様書 (Phase 5)

## 1. はじめに

本ドキュメントは Phase 5 の機能拡張に関する設計仕様書である。要求仕様書 (`docs/09_phase5_claim.md`) に基づき、以下を実装対象とする。

- **xAI 画像生成のサポート**: xAI API (`grok-imagine-image`) を画像生成プロバイダとして追加する。
- **参照画像対応**: xAI の画像編集機能を利用し、1枚の参照画像による画像生成をサポートする。

---

## 2. xAI API 仕様

### 2.1 エンドポイント

```
POST https://api.x.ai/v1/images/generations
```

### 2.2 リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `model` | string | ○ | `grok-imagine-image`（固定） |
| `prompt` | string | ○ | 生成したい画像の説明 |
| `image` | string | × | 参照画像（Base64 Data URL）。編集時のみ指定 |
| `image_format` | string | × | `"url"` または `"base64"`（デフォルト: `"url"`） |
| `aspect_ratio` | string | × | アスペクト比（例: `"1:1"`, `"16:9"`, `"4:3"`） |
| `n` | integer | × | 生成画像数（1〜10、デフォルト: 1） |

### 2.3 レスポンス形式

`image_format: "url"` の場合:
```json
{
  "url": "https://example.x.ai/images/generated_xxx.png"
}
```

`image_format: "base64"` の場合:
```json
{
  "b64_json": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 2.4 参照画像（編集）の仕様

- xAI は **1枚のみ** の参照画像をサポート
- 参照画像がある場合、`image` パラメータに Base64 Data URL を指定
- 参照画像が **ない** 場合は `image` パラメータを **付与しない**（空文字も不可）

---

## 3. バックエンド設計 (Go)

### 3.1 設定 (`Config`) の拡張

`backend/config.go` に xAI 用の設定構造体を追加する。

```go
// XAIConfig holds settings for xAI
type XAIConfig struct {
	APIKey string `json:"apiKey"` // Sensitive information
	Model  string `json:"model"`  // デフォルト: "grok-imagine-image"
}

func (c *XAIConfig) GetProvider() string {
	return "xai"
}
```

`ImageGenConfig` に `XAI` フィールドを追加:

```go
type ImageGenConfig struct {
	Provider     string          `json:"provider"`
	DownloadPath string          `json:"downloadPath"`
	OpenRouter   *OpenRouterConfig `json:"openrouter,omitempty"`
	OpenAI       *OpenAIConfig     `json:"openai,omitempty"`
	Google       *GoogleConfig     `json:"google,omitempty"`
	XAI          *XAIConfig        `json:"xai,omitempty"` // 新規追加
	
	// For backward compatibility
	BaseURL string `json:"baseURL,omitempty"`
	Model   string `json:"model,omitempty"`
	APIKey  string `json:"apiKey,omitempty"`
}
```

`GetProviderConfig()` メソッドに xAI ケースを追加:

```go
case "xai":
	if c.XAI == nil {
		return nil, fmt.Errorf("xai config is not set")
	}
	return c.XAI, nil
```

`defaultConfig()` に xAI のデフォルト設定を追加:

```go
XAI: &XAIConfig{
	Model:  "grok-imagine-image",
	APIKey: "",
},
```

### 3.2 xAI Provider の実装

新規ファイル `backend/xai.go` を作成する。

```go
package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type XAIProvider struct {
	config  *XAIConfig
	baseCfg *ImageGenConfig
	service *ImageGenService
}
```

#### Generate メソッド

```go
func (p *XAIProvider) Generate(prompt string, contextData string, refImages []string) (string, error)
```

**処理フロー**:

1. **プロンプトの構築**
   - `contextData` があれば結合:
   ```
   Context information:
   {contextData}
   
   Based on the above context, generate an image for: {prompt}
   ```

2. **リクエストペイロードの構築**
   ```go
   payload := map[string]interface{}{
       "model":        p.config.Model, // "grok-imagine-image"
       "prompt":       fullPrompt,
       "image_format": "b64_json", // 保存のため Base64 を使用
       "n":            1,
   }
   ```

3. **参照画像の処理**
   - `refImages` が 1 枚以上あれば、**最初の 1 枚のみ**使用
   - `image` パラメータに Base64 Data URL を設定
   - 参照画像がない場合は `image` パラメータを追加しない

4. **API リクエスト**
   - Endpoint: `https://api.x.ai/v1/images/generations`
   - Header: `Authorization: Bearer {APIKey}`
   - Timeout: 180 秒

5. **レスポンス処理**
   - `b64_json` フィールドから Base64 データを取得
   - Data URL (`data:image/png;base64,...`) に変換
   - `downloadAndSaveImage` で保存

#### エラーハンドリング

- API エラー: ステータスコードとレスポンスボディを含むエラーを返す
- 画像データ不在: `no image data in response` エラー
- デコード失敗: Base64 デコードエラーをラップして返す

### 3.3 ImageGenService の拡張

`backend/image.go` の `getProvider()` メソッドに xAI ケースを追加:

```go
case *XAIConfig:
	return &XAIProvider{
		config:  provider,
		baseCfg: &cfg.ImageGen,
		service: s,
	}, nil
```

---

## 4. フロントエンド設計 (React)

### 4.1 設定画面 (Settings Modal)

画像生成プロバイダ選択に **xAI** を追加する。

#### xAI 設定項目

| 項目 | コンポーネント | 設定キー |
|------|---------------|----------|
| Provider | Select | `config.imageGen.provider` |
| API Key | Password Input | `config.imageGen.xai.apiKey` |
| Model | Text Input（読み取り専用推奨） | `config.imageGen.xai.model` |

**注意**:
- Model は `grok-imagine-image` をデフォルトとし、変更可能だが通常編集不要
- API Key は必須項目（空の場合はエラー表示または警告）

### 4.2 画像生成フロー

ユーザー操作に変更はない。フロントエンドは以下を実行:

1. 選択ノードからテキストを抽出・結合（Context）
2. 選択ノードに `imageNode` があれば参照画像として取得（Data URL）
3. `Backend.GenerateImage(prompt, context, refImages)` を呼び出し

**バックエンド側での処理**:
- Provider が xAI の場合:
  - 参照画像が 2 枚以上の場合、**1 枚目のみ使用**（残りは無視）
  - 参照画像が 1 枚の場合、`image` パラメータに設定
  - 参照画像がない場合、`image` パラメータを付与しない

---

## 5. 実装詳細

### 5.1 xAI Provider 実装ステップ

1. **ファイル作成**: `backend/xai.go`
2. **構造体定義**: `XAIProvider` 構造体
3. **Generate メソッド**: 
   - プロンプト構築（context + prompt）
   - ペイロード構築（image パラメータの条件付き追加）
   - API リクエスト送信
   - レスポンス処理（Base64 → 保存）
4. **設定統合**: `config.go` の各所に xAI ケースを追加
5. **Service 統合**: `image.go` の `getProvider()` に xAI ケースを追加

### 5.2 参照画像制限の処理

xAI は 1 枚のみの参照画像をサポートするため:

```go
// xai.go
if len(refImages) > 0 {
    // xAI は 1 枚のみサポート
    payload["image"] = refImages[0]
}
// 参照画像がない場合は image パラメータを追加しない
```

フロントエンドから複数の参照画像が渡された場合、1 枚目以外は無視される（または警告を表示して 1 枚のみ使用することをユーザーに通知してもよい）。

### 5.3 既存プロバイダとの整合性

| 機能 | OpenAI | Google | xAI |
|------|--------|--------|-----|
| 参照画像枚数 | 最大 5 枚 | 複数可 | **1 枚のみ** |
| モデル指定 | 可変 | 可変 | `grok-imagine-image` |
| レスポンス形式 | URL/Base64 | Base64 | URL/Base64 |
| エンドポイント | `/images/generations` 等 | `/generateContent` | `/images/generations` |

---

## 6. 実装ステップ

1. **バックエンド実装**:
   - `backend/config.go`: `XAIConfig` 構造体と関連処理を追加
   - `backend/xai.go`: `XAIProvider` を新規作成
   - `backend/image.go`: `getProvider()` に xAI ケースを追加

2. **フロントエンド実装**:
   - 設定画面に xAI プロバイダ選択を追加
   - xAI 用設定フォーム（API Key, Model）を追加

3. **テスト**:
   - xAI API キーを設定し画像生成を実行
   - 参照画像あり/なしの両方をテスト
   - 他のプロバイダ（OpenAI, Google, OpenRouter）との切り替え確認

---

## 7. 補足

### 7.1 API Key の取得

xAI API を利用するには https://x.ai/api で API Key を取得する必要がある。

### 7.2 制約事項

- **参照画像**: xAI は 1 枚のみサポート。複数選択時は 1 枚目のみ使用。
- **モデル**: 現時点で `grok-imagine-image` が主要モデル。
- `quality` パラメータは現時点でサポートされていない（API ドキュメントによる）。

### 7.3 将来拡張

- `aspect_ratio` パラメータのサポート（設定画面で選択可能に）
- `n` パラメータによる複数画像生成（現状は 1 枚固定）