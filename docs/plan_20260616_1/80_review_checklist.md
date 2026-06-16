# Review Checklist

## Security

- [x] API key や外部サービス認証の変更はない。
- [x] 生成プロンプトはローカル UI 内のノード data に保存されるのみで、新規外部送信は発生しない。

## Frontend

- [x] 画像生成時にプロンプトノードが作成されないことを確認する。
- [x] 画像ノードのカード下に生成プロンプトが表示されることを確認する。
- [x] テキスト生成ノードのカード下に元の質問プロンプトが表示されることを確認する。
- [x] インポート画像などプロンプトを持たない画像ノードには表示が出ないことを確認する。
- [x] 長文プロンプトでカードが崩れないことを確認する。
- [x] 長文プロンプトが 3 行程度で省略されることを確認する。
- [x] 既存の古いプロンプト専用テキストノードが通常のテキストノードとして残ることを確認する。

## Backend

- [x] 変更対象外であることを確認する。
- [x] 既存 API との互換性を崩していないことを確認する。

## DB / Storage

- [x] 既存キャンバス JSON が読み込めることを確認する。
- [x] `originalPrompt` / `prompt` が任意項目として保存されることを確認する。
- [x] 保存 JSON のバージョン番号を変更しないことを確認する。

## QA / Test

- [x] Text モード: 回答ノード 1 つだけ追加される。
- [x] Text モード: 回答ノード下に質問プロンプトが表示される。
- [x] Image モード: 画像ノード 1 つだけ追加される。
- [x] Image モード: 画像ノード下に生成プロンプトが表示される。
- [x] Image モード: プロンプト説明用テキストノードが追加されない。
- [x] キャンバスの拡大・縮小範囲が現在より広がっている。
- [x] React Flow のデフォルト +/- ボタンも新しいズーム範囲を尊重している。
- [x] `fitView` と `minZoom=0.1` の組み合わせで初期表示が崩れない。
- [x] `mise x -- npm run build` が成功する。

## Pre-Implementation Research

- [x] 既存コードの該当箇所を確認した。
- [x] 外部 API 調査は不要と判断した。
- [x] バックエンド変更は不要と判断した。
- [x] Rubberduck ログを `docs\\plan_20260616_1\\rubberduck\\rubberduck_log.json` に保存した。
- [x] Advisor の推奨（MVP 案、最小共通化、既存ノード非移行、`title` 暫定対応）をレビュー文書に反映した。

## Traceability

- [x] Claim → Requirement → Specification → Review/Checklist の対応がある。
- [x] 未確定事項は Open Questions または Review Notes に残している。
- [x] Rubberduck で出た疑問は Review Notes / Review Brief / Review Board / Checklist に反映している。
- [x] Advisor で出た指摘は Review Notes / Requirement / Specification / Checklist に反映している。
