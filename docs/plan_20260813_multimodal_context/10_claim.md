# Claim

## Purpose

F1 の Workspace / Context 契約と、F2 の非破壊派生・typed Relation の上に、既存画像生成と実画像 Vision を同じ机へ戻す。人間と AI が文章・画像を同じ Visible Working Set で生成・比較・評価できるようにする。

## Background

`docs/plan_20260811_collaborative_workspace/05_roadmap.md` は F-4 を CW-3B（文章・画像・参照素材を同じ文脈で生成・比較・評価・修正する）に対応する段階としている。F-2 core と F-3 Web Context core は 2026-08-13 に受理済みである。

現行 PromptBar はすでに `ImageGenService` で画像を生成し、Text Direct Action では `GenerateTextWithImages` により実画像を LLM へ渡せる。一方 Dialogue / Agent は F1 REQ-09 により image pixel を送らず、`read_canvas_node(image)` は `imageIncluded: false` の metadata だけを返す。画像生成結果も PromptBar の `createImageRef` に近く、F2 の derived Relation / provenance / Direct receipt / undo 契約に揃っていない。

ロードマップの F-4B 後半（確認付き再生成ループ、AL-3 限定反復、`fm-image-assistant` 委譲）は価値確認後の拡張である。ユーザー判断により、この plan は **F-4A + Vision Context** までとする。

## Problem

現状は画像を机上に置けるが、協働対象としては分断されている。

- 画像生成は PromptBar Direct Action に閉じ、Dialogue から同じ backend を呼べない。
- 生成画像は元素材との `derived` Relation や operation provenance を持たないことが多い。
- Dialogue の AI Partner は画像を見ておらず、意図と結果の差分を共同で話せない。
- 生成のたびに文脈を再入力したり、別 tool へ移ったりすると、CW-3B の失敗条件（文脈再入力、結果待ち）になる。
- 自動再生成や AL-3 委譲を先に足すと、生成回数そのものが価値に見える。

## Target Users / Environment

- Windows 11 上の Wails v2 desktop app。
- React / TypeScript frontend、Go backend、既存 LLM / Image Provider 設定を利用する単一ユーザー。
- F1〜F3 と同じ `mise` 管理の Go / Node、Playwright Core E2E harness。
- 本番の画像生成と Vision は既存 Image Provider / LLM key を使う。Core E2E は key / 実ネットワークを要求しない。

## Initial Scope

### F4 core slice（この plan の受理対象）

1. 既存 `ImagePort` / `ImageGenService` を再利用し、明示依頼だけの `generate_image` Tool を Dialogue / Agent から呼ぶ。
2. PromptBar Image Direct Action を同じ ImagePort と Image Variant 契約へ揃える。Agent 判断・Dialogue 履歴への自動追加はしない。
3. 選択 Text / Image を Context として使い、結果を元素材との provenance と `derived` Relation を持つ Image Variant として Current Canvas へ置く。
4. Dialogue では生成結果を Proposal として preview し、accept / reject / Stop / undo できる。Direct Action は request-as-approval で即時配置し、receipt と one undo を出す。
5. 明示選択され除外されていない Image を Dialogue の Vision Context（`image-binary`）として LLM へ渡す。F1 の Dialogue metadata-only 制限をこの範囲で解除する。
6. AI Partner は意図（prompt / 参照 Text）と実画像の差分を AL-0/1 として説明できる。自動再生成はしない。
7. 同じ Dialogue / Workspace から比較・評価し、必要なら人間が明示的にもう一度 `generate_image` / PromptBar を実行できる。
8. 実課題の E4 review で、文脈再入力や別 tool 移動の減少、Direct Action 非劣化、採用画像までの反復を判定する。

この plan の `done` は F4 core slice の受理を表す。ロードマップ全体の F-4 milestone は、確認付き再生成・AL-3・`fm-image-assistant` を個別に採用・延期・棄却した記録が揃うまで open とする。

### 後続候補（この plan の受理対象外）

- ユーザー確認付きの自動再生成ループ。
- AL-3 の限定反復や `fm-image-assistant` 委譲。
- 新しい Image Provider、新しい画像編集 API、inpainting / mask UI。
- 動画、音声、複数枚の一括生成。
- Image を Web Context の入力にすること、F-5B Generated View。

## Initial Technical Hypotheses

- 新しい画像生成サービスは不要である。既存 `ImageGenService` と `GenerateTextWithImages` を Context Resolver / Proposal / history 契約へ接続すれば足りる。
- Dialogue の `generate_image` は生成自体を tool 実行し、配置だけを Proposal にする。画像を見ずに accept させるより、preview してから机上へ置く方が CW-3B に合う。
- Direct Action は現行 PromptBar の「prompt をそのまま実行する」性質を保ち、生成と配置を一回の承認として扱う。
- Vision は Chat Completions の `image_url` content parts を既存 agent loop に載せる。Responses API へ移行しない。
- V1.3 を維持し、provenance に `origin=image` と operation / provider / model を optional 追加する。
- Core E2E の `FixtureImage` は既にあるが、現行 E2E composition は `imageGenService` / `imageAssetService` を nil のままにしている。WP-0 で fixture を配線すれば実ネットワークなしで契約を固定できる。

## Uncertainties

- 実 LLM が tool-calling と Vision を同時に安定して扱えるか。Core E2E は fake で画像添付数を固定し、実 VLM 品質は E4 / Conditional とする。
- Dialogue で送る pixel 数の上限。初期は 1 run あたり 3 枚、image generation の参照画像は既存どおり最大 5 枚。
- Dialogue は Settings の既定 Image Provider で開始し、各 run ではユーザーが明示的に provider を選べる。選択しても Settings の既定値は変更しない。
- undo 後の物理画像ファイル。既存不変条件どおり自動削除しない。残留ファイルは残存リスクとして明示する。
- 意図と結果の差分説明の copy。専用 UI は作らず、Dialogue 本文または任意の Text Proposal に留める。

## Next Documents

`20_app_requirement.md` → `30_requirement.md` → `40_specification.md` → `50_review_notes.md` / `60_review_packet.md` → `90_status.md`。
