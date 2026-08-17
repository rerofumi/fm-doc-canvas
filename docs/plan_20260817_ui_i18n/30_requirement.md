# Requirements — 全 UI i18n (2026-08-17)

## Scope

`plan_20260816_gui_update` の deferred `REQ-01` を継承し、`fm-doc-canvas` の production UI を日本語・英語の bundled catalog へ一括移行する。locale lifecycle、presentation boundary、native file dialog、automated completeness gate、dual-locale Core E2E を含む。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| **REQ-01** | supported locale を `ja` / `en` とし、production-reachable UI の visible text、accessible name、tooltip、placeholder、status、notification、empty state、validation / operation error が effective locale で一貫する。brand・technical identifier・user/AI content は対象外として理由付き分類を持つ。 | hard-coded UI literal checker が allowlist 外 0 件、dual-locale Playwright、human copy sweep | E1 / E2 / E4 |
| **REQ-02** | locale preference `system` / `ja` / `en` を提供する。初回描画前に同期解決し、`system` は `navigator.languages` を正規化、不正値は `system`、最終 fallback は `en` とする。Settings で即時切替し、再起動相当 reload 後も明示 preference を維持する。 | locale resolver unit test、Playwright で初回・切替・reload・`languagechange`、`<html lang>` を確認 | E1 / E2 / E3 |
| **REQ-03** | `i18next@26.3.6` / `react-i18next@17.0.11` exact version と bundled TypeScript catalog を使用する。locale 間で key の missing / extra / empty value を許さず、unknown key を typecheck / test で拒否し、missing key や key-looking text を production UI に表示しない。 | lockfile / config pointer、catalog parity test、TypeScript build、missing-key test | E1 / E3 |
| **REQ-04** | Header、Settings、Canvas / node、breadcrumb / controls、Editor、Chat / Direct、ToolCard、Context、Proposal、Next Action、Generated View、context menu、dialog の全 UI copy を catalog 呼出しへ移行する。dead `PromptBar` は削除し、未接続 UI を翻訳対象として温存しない。 | AST checker、component/file inventory diff、dual-locale Core E2E、human screen sweep | E1 / E2 / E3 / E4 |
| **REQ-05** | count、plural、日時、数値、operation / status / relation / role / action-level label を semantic value + parameter から locale-aware に表示する。文字列連結で文法を組み立てず、`Intl` と catalog interpolation/pluralization を使う。 | formatter / message adapter unit test（0/1/2、ja/en）、Playwright の count/status 表示 | E1 / E2 / E3 |
| **REQ-06** | store / domain / Wails 呼出しの user-facing error は `UiMessageDescriptor` または semantic code + values で presentation boundary に渡し、raw backend/provider error を primary UI に直接描画しない。表示中 error は locale 切替で再翻訳され、recovery guidance を保つ。 | typecheck、fault-injection unit/E2E、locale 切替中の error 再描画、raw diagnostic 非表示確認 | E1 / E2 / E3 |
| **REQ-07** | Save Canvas、Open Canvas、Export Markdown、Export Image の Wails native dialog title / filter label を effective `ja` / `en` で生成する。frontend は locale を binding に明示し、Go は不正値を `en` fallback する。 | Go table/unit test、generated binding pointer、Windows native dialog manual smoke。未実施 OS は EX 条件で管理 | E1 / E2 / EX |
| **REQ-08** | locale preference は workspace/chat JSON へ保存せず、既存 Canvas/Node label、chat title、user input、LLM/Web output、filename/URL を locale 切替で変更しない。generic default chat title は `isDefaultTitle` marker により表示時翻訳し、初回 user message 自動命名と legacy data roundtrip を維持する。 | persistence/roundtrip unit test、Playwright で switch 前後 snapshot・draft・history・Undo・chat title を確認 | E1 / E2 / E3 |
| **REQ-09** | 言語切替後も control の accessible role/name、dialog focus trap、keyboard操作を維持する。workflow E2E は翻訳文言を唯一の selector anchor にせず、copy assertion 専用 test と操作 selector を分離する。 | Playwright keyboard/role test、selector review、axe 等の新規 dependency は要求しない | E1 / E2 / E3 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| **REQ-N01** | 日本語・英語の文言長で 1280x720 / 1920x1080 の Header、Settings、Assistant、Proposal、context menu、dialog に横 overflow、切断、重なりがなく、主要 action が到達可能である。 | Playwright bounding-box / overflow check と両 locale の human visual review | E1 / E2 / E4 |
| **REQ-N02** | 翻訳 resource は application bundle に含め、起動・切替に network、API key、TMS、remote catalog を要求しない。existing workspace / config / chat schema を破壊せず、dependency は exact version で lock する。 | production build、offline browser/Wails smoke、dependency/config/code pointer、roundtrip test | E1 / E2 / E3 |
| **REQ-N03** | completion gate は Go tests、frontend tests、i18n static/parity tests、Wails build、既存 Core E2E 全件、dual-locale i18n E2E、human copy/accessibility/native smoke を含む。部分移行状態を done としない。 | plan-defined commands と `90_status.md` evidence/acceptance review | E1 / E2 / E4 |

## Constraints

- semantic key は自然言語そのものを key にせず、`area.feature.intent` 形式の stable identifier とする。
- catalog は source code と同時配布し、runtime fetch を行わない。
- domain layer は React / i18next を import しない。翻訳は presentation adapter または component で行う。
- production UI へ raw `Error.message`、backend error string、provider response を直接挿入しない。
- symbols、brand/provider/model名、protocol field、file extension、URL、user/model content は literal checker の対象外になり得るが、allowlist は file/pattern/reason を明記する。
- 実装途中の WP 単位で一時的な mixed UI が生じても、main handoff / acceptance 前に checker 0 件と dual-locale scope を満たす。
- 新たな screen/layout/function は追加しない。Language selector と technical detail 分離に必要な最小 UI のみ追加する。

## Compatibility

- workspace persistence V1.3 と legacy migration behavior を維持する。
- chat session JSON の `isDefaultTitle` marker と初回 user message 自動命名を維持する。
- existing config JSON へ locale を追加しない。locale preference は application-local storage へ分離する。
- Wails file binding の locale parameter 追加に合わせて generated binding、runtime adapter、E2E bridge、call sites を同一 WP で更新する。
- supported OS の native dialog 標準 button 等、OS が所有する shell copy は application translation completeness の対象外とする。

## Verification / Completion Conditions

- Go test: `mise run test` に含まれる `go test -count=1 ./...` が pass
- Frontend logic / catalog / static test: `mise run test` が pass
- Direct i18n check: `mise exec -- npm --prefix frontend run test:i18n` が pass
- Production build: `mise run build` が pass
- Core E2E in scope: **yes**
- Core E2E command: `mise run e2e` が全件 pass、process / temp root を cleanup
- Baseline before implementation: Go/frontend/build pass、Core E2E 73/73 pass（2026-08-17）
- Core E2E REQ IDs: REQ-01、02、04、05、06、08、09、REQ-N01、N02、N03
- Native dialog: REQ-07 の Go unit + Windows E2 smoke。macOS/Linux 未観測は EX reason/fallback/residual risk を acceptance で明記
- Human E4: 日本語/英語の copy quality、用語統一、狭幅 layout、keyboard / accessible name を review

## Core E2E Coverage

| Scenario | Coverage | REQ |
| --- | --- | --- |
| I18N-01 | page load 前に `system` / invalid / explicit locale を注入し、first UI と `<html lang>` を確認 | REQ-01、02、03 |
| I18N-02 | Settings で `ja` ↔ `en` 即時切替、reload persistence、drawer/selection/draft/Undo state 維持 | REQ-02、08、09 |
| I18N-03 | Header、Settings、Canvas、context menu、SubCanvas / Relation dialog の日本語・英語 copy | REQ-01、04、09、N01 |
| I18N-04 | Chat / Direct、ToolCard、Context、Proposal、Next Action、count/status/plural の日本語・英語 copy | REQ-01、04、05、09、N01 |
| I18N-05 | save/load/search/proposal/SubCanvas fault の localized error と locale 切替再描画、raw diagnostic 非表示 | REQ-06、09 |
| I18N-06 | default chat title、user/AI content、workspace roundtrip、locale preference 非混入 | REQ-08、N02 |
| I18N-07 | 1280x720 / 1920x1080 の overflow、tab order、dialog focus、localized accessible name | REQ-09、N01 |

既存 Core E2E 全件は deterministic な一つの locale（`en`）で実行し、上記 i18n 専用 scenario は `ja` / `en` matrix で実行する。copy 自体を検証しない既存 workflow selector は stable role / test id / state anchor へ移行する。

## Out of Scope

- `ja` / `en` 以外、RTL
- user / LLM / Web content の翻訳
- provider / model / API response / OS shell copy の翻訳
- remote translation delivery、TMS、translator portal
- locale 別 AI system prompt
- workspace ごとの locale 固定

## Acceptance Criteria

- 全 REQ / REQ-N row に adequate evidence があり、separate acceptance が Pass または明示的に受理された EX である。
- hard-coded UI literal checker は理由付き allowlist を除き 0 件である。
- `ja` / `en` catalog は missing / extra / empty key 0 件である。
- build/test/Core E2E/dual-locale E2E が pass し、temp process/data を残さない。
- human E4 で主要 screen / dialog / error の混在、意味不一致、切断がない。
- code と current docs の feedback 項目が `50_review_notes.md` に記録されている。

