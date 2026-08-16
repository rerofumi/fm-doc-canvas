# Planning Worklog — fm-doc-canvas GUI Update (2026-08-16)

worklog: enabled

## Step 0: Tier and Active Plan Selection

- **Process Tier**: Full Tier を選択（UI/UX の大幅刷新、コンポーネント構造の整理、SubCanvas 操作改善、i18n メッセージテーブル導入、E2E テスト検証）。
- **Active Plan Directory**: `docs/plan_20260816_gui_update/`
- **Worklog**: `worklog: enabled`
- **E2E Test Scope**: Vitest による E2E bridge / UI コンポーネント検証をスコープに含める。
- **Index Update**: `docs/plan_index.md` に `plan_20260816_gui_update` を追加。

## Step 1: Claim

- `10_claim.md` を作成。
- 課題（PromptBar による作業領域圧迫、入力の二重構造、ヘッダーボタンの無秩序さ、SubCanvas 操作の UI 欠落と削除不具合、多言語混在、除外チェックボックス不具合、セッション名固定）を整理し、コアロジックを維持しつつ GUI を洗練する目的を明確化。

## Step 2: App Requirements

- `20_app_requirement.md` を作成。
- 「キャンバス最優先 (Canvas-First)」と「統合された AI パートナー (Unified Assistant)」を軸とする UX 設計を定義。
- MVP 機能一覧（11項目）と初期非ゴールを設定。

## Step 3 & 4: Feasibility & Domain Analysis

- 既存コードの調査を実施：
  - `workspaceCommands.ts` に `renameSubCanvas`, `moveNodes`, `dissolveSubCanvas` がすでに実装されており、GUI 側の ContextMenu / Dialog 連携で完結可能であることを確認。
  - `PromptBar.tsx` の生成処理（Text/Image）が `ChatDrawer.tsx` / `ChatInput.tsx` へ移設可能であることを確認。
  - Chat の Agent による `gen_image` ツールと Direct 画像生成の双方が `Image Provider` を必要とするため、ドロワー上部の共通ヘッダーに Provider セレクタを常設する方針を決定。

## Step 5: Requirements

- `30_requirement.md` を作成。
- `REQ-01` 〜 `REQ-13` の要件 ID、検証方法、エビデンスクラス（E1〜E4）を割り当て。
- 非機能要件（レスポンシブ性、アクセシビリティ）を定義。

## Step 6: Specification

- `40_specification.md` を作成。
- `src/i18n/` のメッセージ辞書構成、各コンポーネントの変更詳細、データフロー、4つの Work Package（`WP-1` 〜 `WP-4`）への分割、および要件トレーサビリティを記述。

## Step 7 & 8: Review Notes, Status, and Review Packet

- `50_review_notes.md` を作成し、所見・判断理由・却下案（PromptBar 折りたたみ案の却下等）を記録。
- `60_review_packet.md` を作成し、決定事項・リスク・Mermaid 構成図・チェックリストを整理。
- `90_status.md` を作成し、全 13 要件の受入ステータステーブルを初期化。

## WL-009 — Steps 3-4: Code-grounded correction

- Date: 2026-08-16
- Actor/session: planning amendment
- Purpose: 初版レビューで判明した実コードとの不一致を修正する。
- Sources and checks: `workspaceCommands.ts`, `PromptBar.tsx`, `ChatDrawer.tsx`, `ChatInput.tsx`, `useAppStore.ts`, `useChatStore.ts`, `mise.toml`, `frontend/package.json`, `frontend/e2e/`。
- Decision: `dissolveSubCanvas` は Relation と座標の対応が必要、Chat のみ停止可能、Direct は freshness guard が必要、Core E2E は Playwright と確定。
- Artifacts updated: `10_claim.md`, `20_app_requirement.md`, `30_requirement.md`, `40_specification.md`。
- Risk: Direct backend computation 自体は停止できない。結果適用だけを stale guard で防止する。

## WL-010 — Steps 5-6: Requirements and specification amendment

- Date: 2026-08-16
- Actor/session: planning amendment
- Purpose: ユーザー判断を active scope と implementation-ready specification へ反映する。
- Actions: REQ-01 i18n を後続へ defer、旧 REQ-11 任意移動を REQ-14 親引き上げへ縮小、REQ-15 lifecycle を追加。Assistant action matrix、Canvas別 draft、single operation、relation-aware dissolve、deterministic placement を定義。
- Alternatives deferred: 部分 i18n、任意 Canvas picker、Direct cancel、drag and drop。
- Artifacts updated: `01_gui_improve_idea.md`, `30_requirement.md`, `40_specification.md`。
- Handoff: Active REQ の status / review material を同期する。

## WL-011 — Steps 7-8: Review and acceptance material amendment

- Date: 2026-08-16
- Actor/session: planning amendment
- Purpose: 改訂後の REQ / WP / verification をレビュー・受入資料へ同期する。
- Actions: REQ-N01/N02 を active acceptance table へ統合し、`mise run build`, `mise run test`, `mise run e2e` を必須 evidence とした。
- Artifacts updated: `50_review_notes.md`, `60_review_packet.md`, `90_status.md`, `docs/plan_index.md`。
- Open questions: 計画上の未決定なし。実装 Gate は safe dissolve、freshness、PromptBar removal の自動・実機検証。
- Handoff: `WP-2 → WP-3 → WP-4 → WP-1 → WP-5` の順で実装可能。
