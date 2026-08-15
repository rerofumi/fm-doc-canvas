# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and plan start

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F3 完了後の F-4 を新規 Full plan として開始する。
- Sources and checks: user request（Full、E2E in scope、worklog enabled、F-4A + Vision）、`05_roadmap.md` F-4 / D-05 / CW-3B、`plan_index.md`、F3 `90_status.md`。
- Actions: 既存 plan の amend ではなく `plan_20260813_multimodal_context` を新規作成。suffix はロードマップ候補名 `multimodal_context`。
- Decision: Full。Agent tool、Vision 契約、UI、E2E に広い影響がある。
- Alternatives rejected or deferred: 親 roadmap plan への追記、Light、F-4B 全部。
- Artifacts updated: plan directory start、`90_status.md`。
- Handoff: Claim と調査範囲を定義する。

## WL-002 — Step 1: Claim

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F4 の価値仮説と core / 非対象を分ける。
- Sources and checks: F-4A/B、Gate F-4、`08_glossary.md`、F1 REQ-09、PromptBar / `read_canvas_node` 実装。
- Actions: core を既存 ImagePort + Image Variant + Dialogue Vision + 差分共有と定義。再生成ループは対象外。
- Decision: 生成回数ではなく同じ机での比較・評価が目的。plan `done` は core のみ。
- Deferred: AL-3、`fm-image-assistant`、自動再生成。
- Artifacts updated: `10_claim.md`。
- Handoff: MVP UX を定義する。

## WL-003 — Step 2: App Requirements

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: ユーザーが価値を確認できる最小体験を定義する。
- Sources and checks: CW-3B、consultant §4.5/4.6、D-05。
- Actions: Dialogue Proposal、PromptBar 即時 Variant、Vision 3 枚、自動再生成なしを MVP にした。
- Decision: Direct Action を損なわないことを Gate 条件に含める。
- Artifacts updated: `20_app_requirement.md`。
- Handoff: REQ と verification を割り当てる。

## WL-004 — Step 3/4: Domain primer and pre-implementation research

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 既存画像生成と Vision 経路を検証し、未確認を adopted にしない。
- Sources and checks: `domain_primer.md`、`image_generation_providers.md`、`backend/image.go`、`llm.go` `GenerateTextWithImages`、`agent_loop.go`、`app.go` E2E composition、OpenAI Chat Completions vision / tools docs。
- Actions: 新規 API は不要と判断。E2E は `FixtureImage` があるが `imageGenService` が nil。Dialogue は metadata only。cheatsheet `multimodal_vision.md` を作成。
- Decision: ImagePort + Chat Completions `image_url` は Go（既存実装）。実 VLM+tools 同時利用は Conditional。新規 npm / Go module は不要。
- Alternatives rejected or deferred: Responses API 移行、新 Image Provider、ページ scrape 的な外部画像 URL fetch。
- Artifacts updated: `docs/cheatsheet/multimodal_vision.md`、`index.md`、`link.md`。
- Residual risk: 実 model の Vision+tools 品質、undo 後の残留ファイル。
- Handoff: REQ / Spec に Conditional と WP-0 配線を明記する。

## WL-005 — Step 5: Requirements

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: F4 Gate を検証可能な REQ に分解する。
- Actions: REQ-01〜16、NFR-01〜05、F4-01〜05、completion commands を定義。
- Decision: generate-then-place、Vision allowlist、stale、E4 Gate を必須にした。
- Artifacts updated: `30_requirement.md`、`90_status.md`。
- Handoff: 実装構造と WP を確定する。

## WL-006 — Step 6: Specification

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 実装者が迷わない契約と順序を書く。
- Actions: provenance / variant command / proposal / vision payload、Agent tool、UI、WP-0〜5、E2E シナリオを記載。
- Decision: V1.3 optional provenance。Dialogue は既定 provider。Vision cap 3。物理ファイル非削除。
- Risks: 実 VLM 待ちで WP-3 品質だけ止まる。domain/UI/E2E は止めない。
- Artifacts updated: `40_specification.md`。
- Handoff: review notes / packet で棄却と Open Questions を残す。

## WL-007 — Step 7: Review Notes and Status

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 採用・棄却・保留を plan 内に残し、受入表を初期化する。
- Actions: R-01〜07、Fixed Decisions、status 全 REQ/NFR 行を todo で作成。
- Decision: F1 metadata-only の上書き範囲を明示し、current docs は受入後に更新する。
- Artifacts updated: `50_review_notes.md`、`90_status.md`。
- Handoff: reviewer packet を書く。

## WL-008 — Step 8: Reviewer material and index

- Date/time: 2026-08-13
- Actor/session: Grok planning session
- Purpose: 判断点と traceability を短くレビュー可能にし、index を同期する。
- Actions: `60_review_packet.md` を作成。`docs/plan_index.md` に planned 行を追加。roadmap F-4 に個別計画ポインタを追加。
- Decision: split review は不要。default packet のみ。
- Artifacts updated: `60_review_packet.md`、`docs/plan_index.md`、`05_roadmap.md`。
- Handoff: 実装セッションは requirements / specification / cheatsheet を読み、`90_status.md` の implementer evidence のみ更新する。

## WL-009 — Step 9: Implementation and Blocker Repair

- Date/time: 2026-08-14
- Actor/session: Implementation session
- Purpose: F4 受入 Hold ブロッカー4件（Vision実送信未接続、PromptBar Direct ImageのVariant契約未接続、E2E実効性不足、90_status未記入）を解消する。
- Actions:
  1. **Vision実送信接続**:
     - `chatContext.ts` にて `contextResolver` の `image-binary` descriptor を参照し、allowlist 済みの Image NodeSnapshot に `imageIncluded: true` を付与。
     - `backend/canvas_snapshot.go` に `ImageIncluded` フィールドを追加。
     - `backend/chat_service.go` および `backend/agent_loop.go` に `ImageAssetPort` を配線。
     - `agent_loop.go` の `runAgent` にて `ImageIncluded` な画像について `ImageAssetPort.GetImageDataURL` を通じて `image_url` content part を構築し最初の user message に付与。
     - `agent_loop.go` の `read_canvas_node` にて allowlist 内画像なら `imageIncluded: true` を返すよう修正。
     - `backend/f4_image_tool_test.go` に `read_canvas_node` の allowlist 時 `imageIncluded: true` テストを追加。
  2. **PromptBar Direct Image の Variant 契約接続**:
     - `useAppStore.ts` に `applyDirectImageVariant` を追加。Current Canvas、Workspace ID、Runtime Generation、Scope Epoch、Source Revisions を検証の上 `applyImageVariant` コマンドを実行し、`origin=image` provenance と明示 source への `derived` Relation を atomic に作成。
     - `useAppStore.ts` の `lastDirectReceipt` に `operation: "generate-image"` を記録し、UI 上で `direct-action-receipt` と 1-step Undo を提供。
     - `PromptBar.tsx` の image mode 送信処理を `applyDirectImageVariant` に接続。
  3. **E2E 実効性強化**:
     - `ce2e-f4.spec.ts` を全面改定:
       - F4-01: Agent 提案プレビュー、Accept 前の非変更、Accept 後の Image Node + derived Relation + `origin=image` provenance、1-step Undo を検証。
       - F4-02: PromptBar Direct Action による Image 生成、Dialogue セッション数不変、Direct receipt 表示と Undo を検証。
       - F4-03: 実画像 2 枚 + Text 1 枚選択時の除外動作（除外画像は送信なし、非除外は `image-binary`）、Vision Cap（4 枚選択時 3 枚 binary + 1 枚 metadata + `vision-cap` warning）、差分説明 Dialogue を検証。
       - F4-04: New Workspace、Canvas 移動、Stop 中の遅着画像配置が no-op になる stale ガードを検証。
       - F4-05: 空 prompt、スコープ外 source に対するエラー・非変更、および PromptBar Text 生成の非退行を検証。
  4. **`90_status.md` の更新**:
     - 全 REQ / NFR の Implementer state を `implemented` に更新し、Evidence ポインタを記録。Plan Checks を完了。
- Checks:
  - `mise run test`: Go テスト・フロントエンドテスト全件 pass。
  - `mise x -- go vet ./...`: exit 0。
  - `mise x -- npm --prefix frontend run build`: TypeScript / Vite ビルド exit 0。
- Handoff: 別セッション / human による REQ-16 Gate 判定および最終受入へ引き継ぎ。

## WL-010 — Remaining Defect Repair and Verification

- Date/time: 2026-08-14
- Actor/session: Repair verification session
- Purpose: 再受入で残った実経路・停止・エラー・E2E証跡の不具合を解消する。
- Actions:
  1. E2E composition root の `FixtureLLM` を `ChatService` に配線し、実 `SendChat` から deterministic tool call / Vision 応答を返すようにした。
  2. allowlist 済み画像を valid data URL として Agent に渡し、missing / malformed asset は `image-invalid-asset` で fail closed にした。
  3. `image-unauthorized` / `image-timeout` を安定したコードで返し、キャンセル後に返った画像生成結果を Proposal 化しないようにした。
  4. Wails イベントの順序逆転で Proposal / completed 状態が running / streaming に退行しないよう Chat store の状態遷移を単調化した。
  5. `ce2e-f4.spec.ts` を実 Dialogue、PromptBar、Vision payload、Stop、provider fault 経路で検証する内容に更新した。
  6. `mise.toml` の Go を `go.mod` と同じ 1.24.4 に揃え、Go 1.26.1 と Wails 2.12.0 の Windows build incompatibility を除去した。
- Checks:
  - `mise x -- go test -count=1 ./...`: pass。
  - `mise x -- go vet ./...`: pass。
  - `mise x -- npm --prefix frontend run test`: pass。
  - `mise x -- npm --prefix frontend run build`: pass。
  - `mise run build`: Wails production build pass。
  - `mise x -- npm --prefix frontend run test:e2e`: Core E2E 28/28 pass（F4-01〜05 を含む）。
- Handoff: 実装・自動検証上の残件なし。REQ-16 の human Gate 判定のみ別受入として残す。

## WL-011 — REQ-16 Hands-on Feedback Repair

- Date/time: 2026-08-15
- Actor/session: REQ-16 feedback repair
- Purpose: 実利用で判明した Proposal preview、Dialogue provider 選択、参照画像 payload の不備を修正する。
- Actions:
  1. Image Variant Proposal の相対 asset path を `GetImageDataURL` で解決し、Accept 前に実画像を表示するようにした。
  2. Chat header に Image Provider selector を追加し、Settings の既定値を初期値として run-level override を `ChatRequest` へ渡すようにした。
  3. `generate_image` の参照 Image を provider 呼び出し前に valid `data:image/*;base64,...` へ解決し、ローカル path や不正 asset は provider を呼ばず fail closed にした。
  4. F4-01 に preview 表示、provider 選択、backend への provider 伝播の browser assertion を追加した。
- Checks:
  - Go test / vet、Frontend test / build、Wails production build: pass。
  - 専用ポートで Core E2E 28/28 pass（F4-01〜05 を含む）。
- Handoff: 自動検証は完了。REQ-16 は初回 Hold のため、修正版での human 再受入を残す。

## WL-012 — REQ-16 Human Acceptance

- Date/time: 2026-08-15
- Actor/session: Human acceptance session
- Purpose: WL-011 修正版について F4 core の実利用 Gate を再判定する。
- Observations:
  1. Dialogue / Direct の双方から画像生成を指示できる。
  2. コンテキスト画像を明示指定できる。
  3. 参照画像を使った編集が期待通りに動作する。
  4. image_gen 周辺の一連の操作が期待通りに動作する。
- Decision: REQ-16 確認完了。F4 core Gate は `Go`、plan state は `done`。
