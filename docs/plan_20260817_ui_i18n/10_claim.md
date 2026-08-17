# Claim — 全 UI i18n (2026-08-17)

## Purpose

`fm-doc-canvas` の UI に混在する日本語・英語を解消し、ユーザーが日本語または英語で一貫した操作体験を選べるようにする。部分移行は行わず、画面文言、アクセシブル名、状態表示、通知、ユーザー向けエラー、native file dialog を一括して message catalog へ移行する。

## Background

`docs/plan_20260816_gui_update/` は GUI/UX 刷新を完了したが、i18n は deferred `REQ-01` として別 Full Plan へ明示的に分離した。現行コードには次の横断的な混在がある。

- 静的な JSX text、`aria-label`、`title`、`placeholder`、`alert` の直接候補が少なくとも 31 TSX file / 407 箇所ある。
- `App.tsx`、Settings、Canvas、Chat、Context、Proposal、SubCanvas dialog で日本語と英語が同一画面に現れる。
- `useAppStore.ts` / `useChatStore.ts` は画面表示される失敗理由や既定会話名を raw string として保持する。
- `domain/orchestration.ts` は意味上の enum と日本語 presentation label を同じ domain mapping に保持する。
- `backend/file.go` の Wails native dialog title / filter label は英語固定である。
- Core E2E 73 件は accessible name や表示文言を selector / assertion に使用しており、locale を固定する仕組みがない。

## Problem

1. 一つの画面・操作フローで言語が混在し、用語と操作意図を把握しにくい。
2. 文言が component、store、domain、Go backend に分散し、翻訳漏れを機械検出できない。
3. UI 文言を selector にした E2E が、翻訳や locale 初期値の変更で壊れやすい。
4. backend / domain の raw error をそのまま表示すると、locale を切り替えてもエラーだけ英語になる。
5. persisted user content と UI copy の境界が未定義であり、安易な一括置換は保存データを改変し得る。

## Target Users / Environment

- 日本語または英語で `fm-doc-canvas` を使う desktop user
- Wails v2.12.0 / React 18.3.1 / TypeScript 5.6 / Vite 5
- Windows / macOS / Linux
- 最小対象 1280x720、主対象 1920x1080
- offline 起動可能であること。翻訳取得のための外部 network は使用しない。

## Initial Scope

### In Scope

- `ja` / `en` の bundled catalog と type-safe key contract
- `system` / `ja` / `en` の locale preference、同期初期化、即時切替、永続化
- production UI の visible text、accessible name、tooltip、placeholder、status、notification、empty state、validation / operation error
- domain / store の user-facing raw string を semantic code + parameters に置き換える presentation boundary
- Wails native file dialog の title / filter label
- 数量・日時・件数等の locale-aware formatting と pluralization
- catalog parity / hard-coded UI literal checker
- 既存 Core E2E の locale 安定化と、日本語・英語の dual-locale E2E
- 1280x720 / 1920x1080 の copy length・keyboard・screen reader name の手動 UX 受入

### Out of Scope

- 日本語・英語以外の locale、RTL 対応
- Translation Management System、remote catalog、runtime download
- ユーザー入力、LLM 出力、Web source、provider / model 名、file name、URL、code / protocol identifier の翻訳
- 既存 workspace / chat に保存済みの user-owned content の書換え
- backend log、developer console、API provider が返す raw diagnostic の翻訳
- product function、workspace schema、AI prompt semantics の変更

## Initial Technical Hypotheses

- `i18next` と `react-i18next` を exact version で導入し、catalog は TypeScript module として bundle する。
- locale preference は UI 起動前に `localStorage` から同期解決し、未指定時は `navigator.languages` を `ja` / `en` に正規化する。
- React component は `useTranslation`、component 外は presentation adapter を使用し、domain model 自体は翻訳関数に依存させない。
- store / domain の画面向け失敗は `UiMessageDescriptor`（semantic code / values / optional diagnostic）へ変換し、raw backend error は primary UI に直接描画しない。
- native dialog は frontend から effective locale を明示的に渡し、Go 側の小さな catalog で title / filter label を決定する。
- 部分移行中の branch 内実装は許容するが、release / acceptance gate は全 catalog parity と hard-coded literal check が通るまで閉じたままにする。

## Uncertainties / Risks

- 400 箇所超の直接候補に加え、条件分岐・domain mapping・動的 error があるため、単純な JSX 検索だけでは漏れを検出できない。
- 日本語と英語で文言長が異なり、Settings、Assistant、Proposal card、context menu の狭幅 layout が崩れる可能性がある。
- native dialog の見た目と一部 OS 標準文言は OS 管理であり、全 supported OS を一つの acceptance 環境では観測できない。
- default chat title や app-created label は persisted content と UI placeholder の境界を誤ると、locale 切替で保存データを変更してしまう。
- 翻訳の自然さ・用語統一は automated test だけでは保証できず、人間の E4 review が必要である。

## Next Documents

- `20_app_requirement.md`: locale UX と MVP 境界
- `30_requirement.md`: REQ ID、検証方法、evidence class
- `40_specification.md`: catalog、locale lifecycle、error boundary、native dialog、WP
- `50_review_notes.md`: 採用・却下・deferred 判断
- `60_review_packet.md`: 実装前 human review
- `90_status.md`: 実装・受入状態
- `91_worklog.md`: 計画手順の記録

