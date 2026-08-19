# ライトノベル・プロット検討デモ

「異世界へ転移したヨーヨー世界王者が、糸魔法と競技技術で無双する」という架空のライトノベル企画です。主人公とヒロインのキャラクターシート、魔法ルール、全5章のプロットを一つの Canvas で参照できます。

## アプリで開く

1. 設定の「画像生成 → ダウンロード先」に、このリポジトリの `manuals/demo` ディレクトリを指定します。
2. 「Canvas を開く」で `light-novel-plot-ja.canvas.json` を選択します。
3. Canvas 左下の「Fit View」で全体を表示します。

## スクリーンショットを再生成する

```powershell
$env:FM_E2E_TEST_ARGS='e2e/readme-light-novel-screenshot.spec.ts'
mise x -- npm --prefix frontend run test:e2e
```

生成先は `manuals/screenshot_readme_light_novel_plot_ja.png` です。撮影テストは一時的なE2E環境だけを使用します。
