# Review Brief

## Review Purpose

画像生成・テキスト生成のノード表示改善とキャンバスズーム範囲拡張について、実装前に仕様・リスク・確認項目を整理する。

## Review Scope

- 画像生成時にプロンプトノードを作らない
- 画像カード下に生成プロンプトを表示する
- テキスト回答ノード下に元の質問プロンプトを表示する
- キャンバスのズーム範囲を広げる

## Decisions Needed

| Decision | Options | Recommended |
| --- | --- | --- |
| 画像生成プロンプトの表示場所 | 別ノード / カード下 / 非表示 | カード下 |
| 画像生成時のノード数 | 画像+プロンプト / 画像のみ | 画像のみ |
| テキスト生成ノードの質問表示 | 表示 / 非表示 | 表示 |
| ズーム範囲拡張 | minZoom/maxZoom 指定 / 変更なし | 指定 |

## Maximum Risks

- カード下表示によりノード内の本文・画像表示領域が狭くなる。
- 長文プロンプト表示が UI を圧迫する。
- ズーム範囲を広げすぎると操作感が粗くなる。

## Pre-Implementation Research Status

- 既存コードを確認済み。
  - `PromptBar.tsx`: 画像生成時にプロンプトノードを追加している。
  - `CustomNode.tsx`: サマリー/本文のみ表示。
  - `ImageNode.tsx`: 画像表示のみ。
  - `CanvasArea.tsx`: `minZoom` / `maxZoom` を明示していない。
- 外部 API 調査は不要。
- バックエンド変更は不要。

## Traceability Summary

| Claim | Requirement | Specification | Test / Review |
| --- | --- | --- | --- |
| 画像生成時のプロンプトノード作成停止 | FR-1 | PromptBar Image モード | 手動確認 |
| 画像カード下のプロンプト表示 | FR-2 | ImageNode data.prompt | 手動確認 |
| テキスト回答ノード下の質問表示 | FR-3 | CustomNode data.originalPrompt | 手動確認 |
| キャンバスズーム範囲拡張 | FR-4 | CanvasArea minZoom/maxZoom | 手動確認 |

## Open Questions

- ラベル文言を `Prompt` にするか、日本語ラベルにするか。
- 表示行数を 3 行固定にするか、ユーザー設定にするか。
- 長文プロンプトの全文確認 UI を MVP に入れるか、将来候補にするか。
- 長文プロンプトの MVP 暫定対応として `title` 属性を使うか。
- 既存の古いプロンプト専用テキストノードを自動整理するか、ユーザー任せにするか。
- React Flow のデフォルト +/- ボタンが `minZoom=0.1` / `maxZoom=4.0` を正しく尊重するか、実装後に確認する。
- `fitView` と `minZoom=0.1` の組み合わせで初期表示が崩れないか、実装後に確認する。

## Go / No-Go

- Go 条件:
  - フロントエンド型チェックが通る。
  - 画像生成時にプロンプトノードが作成されない。
  - 既存キャンバス JSON が読み込める。
  - 古いプロンプト専用ノードが通常のテキストノードとして残る扱いで合意されている。
  - 長文プロンプトは 3 行省略 + `title` 属性で MVP を進める方針で合意されている。
- `fitView` と `minZoom=0.1` の組み合わせは実装後に確認する。
- No-Go 条件:
  - 既存ノード表示が大幅に崩れる。
  - React Flow のズーム操作が不安定になる。
  - 古い Wails アプリで保存し直した際に未認識フィールドが消える運用リスクを説明していない。
