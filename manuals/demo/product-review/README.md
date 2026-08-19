# README スクリーンショット用デモ

日本のソフトウェア開発チームが「障害対応ナレッジ基盤」を設計レビューしている想定のデモデータです。プロダクト概要、提案アーキテクチャ、段階リリース、レビュー論点、ADR、次のアクションを Relation で接続しています。

## アプリで開く

1. 設定の「画像生成 → ダウンロード先」に、このリポジトリの `manuals` ディレクトリを指定します。
2. 「Canvas を開く」で `product-planning-ja.canvas.json` を選択します。
3. Canvas 左下の「Fit View」で全体を表示します。

図版の編集元は `architecture.svg` と `release-flow.svg`、アプリで表示する画像は同名の PNG です。

## スクリーンショットを再生成する

リポジトリルートで次を実行します。

```powershell
$env:FM_E2E_TEST_ARGS='e2e/readme-screenshot.spec.ts'
mise x -- npm --prefix frontend run test:e2e
```

生成先は `manuals/screenshot_readme_product_planning_ja.png` です。撮影テストは E2E 用の一時ディレクトリを使用し、通常のアプリ設定や API キーを読み込みません。
