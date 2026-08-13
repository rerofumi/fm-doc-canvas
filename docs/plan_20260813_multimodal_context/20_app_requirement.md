# App Requirements

## Purpose

文章と画像を別入口へ再入力せず、同じ机上で生成・比較・評価できるようにする。価値は生成枚数ではなく、元素材との関係が残ったまま採用画像へ到達できることにある。PromptBar の一発生成は損なわない。

## Target Environment

- F1〜F3 と同じ単体 Wails desktop app。
- 画像生成は既存 `ImagePort` / `ImageGenService`。新しい Image Provider は追加しない。
- Vision は既存 LLM Chat Completions の `image_url` content parts。Responses API へ移行しない。
- Dialogue の画像生成は Settings の既定 Image Provider を使う。PromptBar の request-level 切替は Direct Action に残す。
- Core E2E は `FixtureImage` / `FixtureLLM` / temp asset root を使い、credentials / 外部ネットワークを要求しない。
- MCP、Specialist subagent、`fm-image-assistant`、自動再生成ループは入力経路にしない。

## User Experience

1. ユーザーは Text / Image を選び、Dialogue で「この説明から画像を作って」と頼むか、PromptBar Image モードで prompt を直接実行する。
2. Dialogue では生成結果を Proposal として見せ、採用するまで Canvas の確定 Node は増えない。reject / Stop は配置しない。
3. PromptBar は入力した prompt をそのまま実行し、成功時は Image Variant を即時配置して receipt と Undo を出す。Dialogue 履歴や追加質問は作らない。
4. 採用または Direct 配置された画像は、参照した Text / Image への `derived` Relation と provenance を持つ。元 Node は書き換えない。
5. 選択した実画像は Dialogue の Vision Context として AI へ渡る。Context Preview は `image-binary` と送信先 `llm` を表示し、除外できる。
6. AI Partner は画像を見たうえで、意図と結果の違いを質問・説明として返す。勝手に再生成しない。もう一度作るときは人間が明示依頼する。
7. New / Discard / Canvas 移動 / Stop のあと遅着した生成結果や配置は適用しない。
8. 失敗時は document を変えず、設定・prompt 修正・閉じるの次操作が分かる。

## MVP Features

| Feature | MVP behavior |
| --- | --- |
| Dialogue `generate_image` | 明示 prompt で既存 ImagePort を一度呼ぶ。配置は Proposal |
| PromptBar Direct Action | 同じ ImagePort と Variant 契約。Dialogue 非追加 |
| Image Variant | Current Canvas の Image Node + source への `derived` + provenance |
| Shared Context | 選択 Text は文脈、選択 Image は参照画像。allowlist 外は送らない |
| Vision Context | Dialogue の明示 Image を最大 3 枚、`image-binary` として LLM へ渡す |
| Intent vs result | AI は AL-0/1 で差分を説明する。自動再生成なし |
| Preview / undo | Dialogue は accept 前 preview。Direct は receipt + one undo |
| Safety | timeout、key 欠落、stale apply は no-op。部分 Node を残さない |
| F4 value gate | 実課題の E4 で再入力減少、Direct Action 非劣化、反復改善を判定 |

## Future Candidates

- ユーザー確認付きの再生成ループ。
- AL-3 の限定反復、`fm-image-assistant` 委譲。
- mask / inpaint、複数枚並列、動画。
- Dialogue 側の request-level Image Provider 切替。
- Image を Web Context や Generated View の材料にすること。

## Initial Non-Goals

- 生成回数や自律再試行数を価値にすること。
- PromptBar を Dialogue へ統合すること、または Dialogue への自動昇格。
- 新しい Image Provider / SDK。
- 物理画像ファイルの undo 時自動削除。
- Core E2E に実 API key と実ネットワークを持ち込むこと。
- 確認なしの AL-2 再生成、AL-3 委譲。
