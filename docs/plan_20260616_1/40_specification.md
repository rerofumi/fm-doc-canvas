# Implementation Specification

## Technical Stack

- React 18
- TypeScript
- Zustand
- Tailwind CSS
- `@xyflow/react` 12.x

## File Structure

主な変更対象:

```text
frontend\\src/
├── types\\index.ts
├── components\\layout\\PromptBar.tsx
├── components\\canvas\\CustomNode.tsx
├── components\\canvas\\ImageNode.tsx
└── components\\canvas\\CanvasArea.tsx
```

## Data Model

### `TextNodeData`

既存:

```ts
export interface TextNodeData extends Record<string, unknown> {
  content: string;
  summary: string;
}
```

変更後:

```ts
export interface TextNodeData extends Record<string, unknown> {
  content: string;
  summary: string;
  originalPrompt?: string;
}
```

- `originalPrompt` はテキスト生成時の質問プロンプトを保持する。
- 任意項目のため、既存 JSON との互換性を保つ。

### `ImageNodeData`

既存:

```ts
export interface ImageNodeData extends Record<string, unknown> {
  src: string;
  alt?: string;
}
```

変更後:

```ts
export interface ImageNodeData extends Record<string, unknown> {
  src: string;
  alt?: string;
  prompt?: string;
}
```

- `prompt` は画像生成時のプロンプトを保持する。
- `alt` は画像の alt 属性として残す。
- 任意項目のため、インポート画像などには設定しない。

## UI / Screens

### `PromptBar.tsx`

#### Text モード

テキスト生成ノード作成時に `data.originalPrompt` を設定する。

```ts
data: {
  content: generatedText,
  summary: summary,
  originalPrompt: prompt,
}
```

#### Image モード

画像生成ノード作成時に `data.prompt` を設定する。

```ts
data: {
  src: imageSrc,
  alt: prompt,
  prompt,
}
```

#### 削除対象

現在存在する以下の処理を削除する。

```ts
// 6. Create a text node with the prompt used for image generation
const promptNode: AppNode = { ... };
addNode(promptNode);
```

### `CustomNode.tsx`

- `originalPrompt` がある場合のみ、カード下部に簡易プロンプト表示を追加する。
- 表示領域はカード内に収め、カード全体を過度に大きくしない。
- 仮の表示:

```text
Prompt
{originalPrompt}
```

- 長文は `line-clamp-3` 程度で省略し、必要に応じて `title` 属性で全文を補助表示する。
- `originalPrompt` がない場合は既存表示を維持する。

### `ImageNode.tsx`

- `prompt` がある場合のみ、画像表示領域の下に簡易プロンプト表示を追加する。
- 仮の表示:

```text
Prompt
{prompt}
```

- 長文は `line-clamp-3` 程度で省略し、必要に応じて `title` 属性で全文を補助表示する。
- 画像表示領域は `flex` 内で縮むようにし、カード内に収める。
- `prompt` がないインポート画像では表示しない。

### `CanvasArea.tsx`

React Flow のズーム範囲を拡張する。

推奨値:

```ts
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
```

```tsx
<ReactFlow
  minZoom={MIN_ZOOM}
  maxZoom={MAX_ZOOM}
  ...
/>
```

- 現在値が明示指定されていない場合、React Flow のデフォルト範囲より縮小側・拡大側を広げる。
- `Controls` コンポーネントも React Flow の範囲に従うため、個別変更は不要。

## Persistence

- 保存 JSON は既存の `CanvasFileV1_1` のまま継続する。
- `originalPrompt` / `prompt` は任意項目として保存される。
- 旧バージョンのアプリでは未認識項目として無視される想定。

## Error Handling

- プロンプト表示用の data がない場合は表示しない。
- 画像読み込みに失敗した場合の既存エラー表示は維持する。
- ズーム範囲指定によるエラーは発生しない想定。

## Import / Export

- ファイルインポート時は `ImageNodeData.prompt` を設定しない。
- 画像ノードのエクスポートには影響しない。
- テキストノードのエクスポートには `originalPrompt` を含めない。エクスポート対象は `content` とする。

## Environment Constraints

- バックエンドの変更は不要。
- 外部 API の変更は不要。
- `npm` / `tsc` / `vite` は AGENTS.md に従い `mise` 経由で実行する。

## Verification

### 静的検証

```bash
mise x -- npm run build
```

実行場所: `frontend\\`

期待結果:
- TypeScript と Vite build が成功する。

### 手動確認

1. Text モードでプロンプトを送信する。
   - 回答ノードが 1 つだけ追加されること。
   - カード下に元の質問プロンプトが表示されること。
2. Image モードでプロンプトを送信する。
   - 画像ノードが 1 つだけ追加されること。
   - プロンプト説明用テキストノードが追加されないこと。
   - 画像カード下に生成プロンプトが表示されること。
3. 画像ファイルをキャンバスへドラッグ＆ドロップする。
   - インポート画像にプロンプト表示が出ないこと。
4. キャンバスを拡大・縮小する。
   - 現在より広い範囲までズームできること。

## Implementation Steps

1. `frontend\\src\\types\\index.ts` に `originalPrompt` / `prompt` を追加する。
2. `PromptBar.tsx` のテキスト生成ノードに `originalPrompt` を設定する。
3. `PromptBar.tsx` の画像生成ノードに `prompt` を設定する。
4. `PromptBar.tsx` から画像生成時のプロンプトノード追加処理を削除する。
5. カード下プロンプト表示を実装する。
   - 推奨: `CustomNode` / `ImageNode` で共有できる軽量 `PromptCaption` 表示関数またはコンポーネントを使う。
   - MVP では全文表示 UI は作らず、必要に応じて `title` 属性で全文を補助表示する。
6. `CanvasArea.tsx` に `minZoom` / `maxZoom` を追加する。
7. `fitView` と初期ズーム表示が崩れないことを確認する。
8. `npm run build` を `mise` 経由で実行し、型エラーがないことを確認する。

## Known Implementation Caveats

- カード下表示を追加するとノード内の本文/画像表示領域が若干狭くなるため、`line-clamp` と `overflow-hidden` で制御する。
- 生成プロンプトが非常に長い場合でも、カード全体を大きくしすぎない。
- 長文プロンプトの全文確認 UI は今回の MVP では導入しない。必要に応じて `title` 属性で全文を補助表示する。
- 既存の古いプロンプト専用テキストノードは、今回の改善では自動非表示・自動削除しない。
- `CanvasArea.tsx` に `minZoom=0.1` を追加すると、既存の `fitView` と組み合わせた初期表示が極端に縮小されないか実機確認が必要。
- `maxZoom=4.0` では画像ノードの粗さ・画質劣化が目立つ可能性がある。
- `alt` と `prompt` の役割を混同しない。`alt` は画像説明、`prompt` は生成指示として扱う。
