# Status — fm-doc-canvas GUI Update (2026-08-16, amended)

state: planned
worklog: enabled

tier: Full
plan: plan_20260816_gui_update

## Active Acceptance Table

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REQ-02** | Header整理 | Playwright要素/動作 + 1280px目視 | E1/E2/E3 | WP-1 | todo | - | - |
| **REQ-03** | Breadcrumb整理 | Playwright + E3 | E1/E2/E3 | WP-1 | todo | - | - |
| **REQ-04** | PromptBar撤去・Canvas拡張・Direct維持 | Playwright bounding box + Direct flow | E1/E2/E3 | WP-1 | todo | - | - |
| **REQ-05** | Chat/Direct tab・Canvas別共通draft | Store test + Playwright | E1/E2/E3 | WP-3 | todo | - | - |
| **REQ-06** | 共通Image Provider payload | Logic/payload test + Playwright | E1/E2/E3 | WP-3 | todo | - | - |
| **REQ-07** | Mode別action row | Component/Playwright + Chat cancel | E1/E2/E3 | WP-3 | todo | - | - |
| **REQ-08** | 初回messageによるsession title・再読込保持 | Store test + reload E2E | E1/E2/E3 | WP-3 | todo | - | - |
| **REQ-09** | Context badge-only・exclusion復帰 | Resolver/store test + Playwright | E1/E2/E3 | WP-4 | todo | - | - |
| **REQ-10** | SubCanvas rename dialog | Domain + Playwright | E1/E2/E3 | WP-2 | todo | - | - |
| **REQ-12** | Relation/layout/Undo対応safe dissolve | Domain test + Playwright + snapshot compare | E1/E2/E3 | WP-2 | todo | - | - |
| **REQ-13** | Build・logic test・Core E2E通過 | `mise run build`; `mise run test`; `mise run e2e` | E1 | WP-5 | todo | - | - |
| **REQ-14** | 選択nodeの親Canvasへの引き上げ | Domain/store + Playwright | E1/E2/E3 | WP-2 | todo | - | - |
| **REQ-15** | Single operation・Chat stop・Direct freshness | Lifecycle test + navigation E2E | E1/E2/E3 | WP-3 | todo | - | - |
| **REQ-N01** | 1280x720 layout / drawer resize | Playwright viewport + manual | E1/E2/E4 | WP-1/WP-3 | todo | - | - |
| **REQ-N02** | Keyboard / focus / dialog accessibility | Playwright keyboard + manual inspection | E1/E2/E4 | WP-2/WP-3 | todo | - | - |

## Deferred ID Disposition

| ID | Disposition | Successor / condition |
| --- | --- | --- |
| **REQ-01** | Deferred: 全UI i18n | 全UI文言を一括移行する後続 Full Plan 候補 |
| **REQ-11** | Superseded in this plan: 任意Canvas picker | REQ-14で親への引き上げを実装。cross-branch需要時に再計画 |

Deferred ID は active acceptance / done 条件に含めない。

## Required Verification Evidence

| Check | Command / steps | Expected |
| --- | --- | --- |
| Build | `mise run build` | exit 0 |
| Logic / unit | `mise run test` | Go + frontend logic all pass |
| Core E2E | `mise run e2e` | Wails + Playwright all pass |
| Manual layout | 1280x720 / 1920x1080 | Header、drawer、action rowに欠け・横overflowなし |
| Manual UX | Chat/Direct、parent lift、dissolve、keyboard | `30_requirement.md` のactive REQを満たす |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |

## State Rule

`state: done` は Active Acceptance Table の全行が Pass した場合のみ設定する。
