# Status — 全 UI i18n (2026-08-17)

state: done
worklog: enabled

tier: Full
plan: plan_20260817_ui_i18n
source: `plan_20260816_gui_update` deferred `REQ-01`
core_e2e: enabled

## Acceptance Table

| ID | Requirement summary | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| **REQ-01** | ja/enで全production UI copyが一貫 | E1/E2/E4 | WP-3/4/5 | implemented | production literal checker 0/62、ja/en E2E、人間screen sweep | **Pass** |
| **REQ-02** | system/ja/enの初期解決・即時切替・永続化 | E1/E2/E3 | WP-1/5 | implemented | resolver unit、初回/reload/`languagechange`/`html lang` E2E | **Pass** |
| **REQ-03** | exact dependency・typed bundled catalog・key完全性 | E1/E3 | WP-1/5 | implemented | exact lock、selector型、parity/empty/unknown/missing gate | **Pass** |
| **REQ-04** | 全UI surfaceをcatalogへ移行しdead PromptBar削除 | E1/E2/E3/E4 | WP-3/4/5 | implemented | 62 production files inventory、PromptBar削除、ja/en screen確認 | **Pass** |
| **REQ-05** | count/status/enum/date/numberのlocale-aware表示 | E1/E2/E3 | WP-2/3/4 | implemented | semantic presenter、Intl、ja/en 0/1/2/1000 test | **Pass** |
| **REQ-06** | semantic message/error boundary、raw diagnostic非表示 | E1/E2/E3 | WP-2/4/5 | implemented | descriptor境界、save/load/search/proposal/SubCanvas fault・再翻訳 E2E | **Pass** |
| **REQ-07** | Wails native dialog title/filterのja/en対応 | E1/E2/EX | WP-3/5 | implemented | Go ja/en/invalid table、binding/callsite/build、Windows human smoke | **Pass**。macOS/Linux実表示はEX受理 |
| **REQ-08** | user/persisted content非変更、default title marker維持 | E1/E2/E3 | WP-2/5 | implemented | marker/roundtrip/content/state E2E、人間確認 | **Pass** |
| **REQ-09** | localized accessible name、keyboard、selector安定性 | E1/E2/E3 | WP-3/4/5 | implemented | stable selector inventory、keyboard/focus E2E、人間確認 | **Pass** |
| **REQ-N01** | ja/en・1280x720/1920x1080でlayout崩れなし | E1/E2/E4 | WP-3/4/5 | implemented | 全主要surface bounding/overflow E2E、人間visual確認 | **Pass** |
| **REQ-N02** | offline bundled resource・schema互換・exact lock | E1/E2/E3 | WP-1/2/3/5 | implemented | bundled resources、network guard、schema分離、roundtrip/build | **Pass** |
| **REQ-N03** | 全verification gateとseparate acceptance | E1/E2/E4 | WP-5 | implemented | test/static/build/full E2E、自動acceptance、人間E4/native | **Pass** |

## Final Verification Evidence

| Check | Result |
| --- | --- |
| `mise run test` | Pass — Go/frontend/i18n |
| `mise exec -- npm --prefix frontend run test:i18n` | Pass — production literal 0/62、catalog drift/empty 0 |
| `mise run build` | Pass — Wails Windows production build |
| `mise run e2e` | **93/93 Pass**、I18N matrix 20/20、temp/process/port cleanup Pass |
| Human UI | Pass — 2026-08-18、ユーザー確認「問題無いと思います」 |
| Windows native dialog | Pass — human acceptanceに含めて受理 |
| macOS/Linux native dialog | **EX accepted** — Go pure table・binding inspection・Windows smokeで代替。OS shell差を残存リスクとして維持 |

## REQ-07 EX Decision

- Reason: acceptance hostはWindowsで、macOS/Linux native shellの実表示を直接観測できない。
- Fallback evidence: Go pure copy table unit test（ja/en/invalid）、binding/call-site inspection、Windows native Save/Open/Export smoke。
- Residual risk: Wails/runtime/OSによりapplication-owned title/filterが表示または省略される差異。
- Decision: fallbackとWindows human smokeがPassしたため、macOS/Linux未観測をEXとして受理する。supported OS実機が得られた際に追加確認する。

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-17 | planning session | planned | Full plan、Core E2E/worklog enabled、REQ/WP/evidence contract作成。 |
| 2026-08-17 | leader session | implementing | ユーザー承認後、WP-1から実装開始。 |
| 2026-08-17 | acceptance sub-agent | WP-1 pass | selector API/negative gate修正後に部分受入。 |
| 2026-08-17 | acceptance sub-agent | WP-2 pass | semantic message、plural/Intl、content integrity、raw diagnostic境界を受入。 |
| 2026-08-17 | acceptance sub-agent | WP-3 pass | shell/canvas/native binding、focus、stable selectorを受入。 |
| 2026-08-17 | acceptance sub-agent | WP-4 pass | Assistant/Context/Proposal、descriptor、count、cancel経路を受入。 |
| 2026-08-17 | acceptance sub-agent | automated pass | literal 0/62、test/build、full E2E 93/93、fault/selector/layout/cleanupを独立再確認。 |
| 2026-08-18 | human | **Pass** | ja/en UI、layout/accessibility/content/native handoffを確認し「問題無いと思います」と受理。 |
| 2026-08-18 | leader session | **done** | 全REQをPassまたは受理EXとし、planを完了。 |

## Completion Notes

- `i18next@26.3.6` / `react-i18next@17.0.11` exact、bundled typed ja/en catalogを採用。
- locale preferenceはapplication-local storageへ分離し、workspace/chat schemaへ混入しない。
- domain/storeのuser-facing messageはsemantic descriptor/presenter境界を使用し、raw diagnosticをprimary UIへ表示しない。
- workflow selectorはlocale-stableなtestid/state/structural anchorへ分離した。
- Wails `runtime:ready -> Unknown message from front end` は既知のnon-blocking log。93/93成功とcleanupを阻害しない。
- `docs/plan_20260816_gui_update` のスクリーンショット削除は既存の対象外変更であり、本planでは操作していない。

## Abandoned / No-Go Reason

該当なし。
