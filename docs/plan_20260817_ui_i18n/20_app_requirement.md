# App Requirements — 全 UI i18n (2026-08-17)

## Purpose

日本語と英語が混在しない desktop UI を提供し、ユーザーが作業内容を失わずに表示言語を即時変更できるようにする。

## Target Environment

- Wails v2 desktop application
- Windows / macOS / Linux
- React 18 / TypeScript / React Flow / Zustand
- offline 起動・offline locale 切替
- 1280x720 以上、主対象 1920x1080
- keyboard / screen reader で識別可能な control name を維持

## Locale Model

| Preference | Effective locale | Behavior |
| --- | --- | --- |
| `system` | `navigator.languages` の最初の supported locale。`ja-*` は `ja`、それ以外は `en` | 初回既定。browser `languagechange` で再解決 |
| `ja` | `ja` | ユーザーが明示選択。再起動後も維持 |
| `en` | `en` | ユーザーが明示選択。再起動後も維持 |

不正または未対応の保存値は `system` として扱い、最終 fallback は `en` とする。

## User Experience

### Consistent Language

- Header、Settings、Canvas、node、drawer、Chat / Direct、Context、Proposal、Generated View、dialog、context menu、notification、error banner が同じ effective locale で表示される。
- visible label と `aria-label` / `title` / `placeholder` は同じ意味・locale を持つ。
- provider / model / protocol / file extension 等の固有名詞・識別子は原表記を維持する。

### Language Selection

- Settings の先頭に Language selector を置き、`System` / `日本語` / `English` を選択できる。
- 選択時に drawer を閉じず、現在画面が即時再描画される。
- preference は workspace JSON ではなく application-local preference として保存される。
- 起動時は React 初回描画より前に locale を解決し、key や fallback language の flash を表示しない。
- effective locale を `<html lang>` と `Intl` formatting へ同期する。

### Dynamic Copy

- node / relation / source / claim 等の件数は interpolation と locale 別 plural rule で表示する。
- 日時、数値、相対的な status 表示は effective locale を明示した `Intl` formatter を通す。
- enum / operation code / proposal kind は presentation adapter で翻訳し、domain code は変更しない。

### Errors and Diagnostics

- validation、save/load、generation、search、proposal、SubCanvas 操作の primary error は localized summary と recovery action を表示する。
- raw backend/provider diagnostic は console または明示的な technical detail として分離し、primary UI copy として直接表示しない。
- locale 切替後、既に表示中の message descriptor も新 locale で再描画される。

### Content Integrity

- user input、LLM / Web output、filename、URL、既存 Canvas / Node label、既存 chat title を自動翻訳・書換えしない。
- generic default chat title は `isDefaultTitle` marker を使って表示時に翻訳し、初回 user message による自動命名契約を維持する。
- 新規作成時の app-owned placeholder / default label は作成時 locale で生成してよいが、作成後は user-owned content として locale 切替で変更しない。

## MVP Features

| No | Area | MVP behavior |
| --- | --- | --- |
| 1 | Foundation | `i18next` / `react-i18next` と bundled `ja` / `en` catalog |
| 2 | Type safety | source locale shape、target parity、strict key check、missing-key test |
| 3 | Preference | `system` / `ja` / `en` の同期初期化・即時切替・local persistence |
| 4 | Global shell | Header、Settings、Canvas breadcrumb / controls、Editor、node UI の一括移行 |
| 5 | Assistant | Chat / Direct、message status、tool card、Context、Proposal、Next Action の一括移行 |
| 6 | Dynamic labels | count、status、operation、relation、role、action level の locale-aware 表示 |
| 7 | Error boundary | store / domain / Wails error を semantic descriptor から翻訳 |
| 8 | Native dialogs | Save / Open / Export dialog title と filter label の `ja` / `en` 対応 |
| 9 | Content safety | workspace / chat user content と locale preference の分離、既存 data 無変更 |
| 10 | Static gate | hard-coded production UI literal と catalog drift の automated check |
| 11 | E2E | 既存 73 tests の locale 固定、selector 安定化、dual-locale core flow |
| 12 | UX QA | 1280x720 / 1920x1080、keyboard、accessible name、copy quality の human review |

## Success Experience

1. 初回起動では system locale に合う UI が最初の frame から表示される。
2. Settings で English を選ぶと、開いている dialog / drawer / status を含む UI が即時英語になる。
3. 再起動しても明示 preference は維持される。
4. locale を切り替えても Canvas、selection、draft、chat、Undo history、active operation は失われない。
5. save/load、invalid operation、empty state、native dialog を含む core flow で言語混在がない。

## Future Candidates

- 翻訳対象 locale の追加
- RTL layout
- ICU rich message / advanced relative time
- Translation Management System と translator workflow
- catalog extraction / screenshot matrix の CI 自動化

## Initial Non-Goals

- user / AI content の機械翻訳
- workspace schema への locale 埋込み
- provider API response や OS 標準 button の翻訳保証
- locale ごとの AI system prompt 切替
- i18n を理由とした機能・navigation・data model の再設計

