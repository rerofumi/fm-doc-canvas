# 要求仕様書 (Phase 5)

## 改良したいところ

### xAI 画像生成の利用と参照画像有効化

- Image generate のプロバイダ設定に xAI を追加する
- xAI のパラメータは API キーとモデル
- APIドキュメントは https://docs.x.ai/docs/guides/image-generations
- 画像参照は 1枚のみ、参照画像が無いときは "image" パラメータを付与しない
