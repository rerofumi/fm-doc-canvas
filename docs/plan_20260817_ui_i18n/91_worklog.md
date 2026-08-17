# Planning Worklog — 全 UI i18n (2026-08-17)

worklog: enabled

## WL-001 — Step 0: Tier and plan start

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: `plan_20260816_gui_update` で後続候補とした全 UI 文言の i18n を独立した実装可能計画として開始する。
- Sources and checks: `fm-dev-process`、`docs/plan_20260816_gui_update/`、`docs/plan_index.md`、`frontend/package.json`、`frontend/src/`、`frontend/e2e/`。
- Actions: Full tier、Core E2E 有効、worklog 有効をユーザー確認済みとして `plan_20260817_ui_i18n` を作成し、Plan Index へ登録した。先行 GUI 計画の index 状態も正本 `90_status.md` に合わせて `done` へ修正した。
- Decision and concise rationale: i18n は全コンポーネント、ダイアログ、ツールチップ、通知、ユーザー向けエラーを横断し、言語切替・永続化・テスト契約も必要なため Full tier とする。
- Alternatives rejected or deferred: 先行 GUI 計画への追記は、同計画で明示的に別 Full Plan へ分離済みのため採用しない。部分的 i18n は混在を残すため採用しない。
- Artifacts updated: `docs/plan_index.md`, `docs/plan_20260817_ui_i18n/91_worklog.md`。
- Open questions / risks: メッセージ基盤、locale 初期決定、バックエンド由来エラーの境界、カタログ完全性検査をコード調査で確定する。
- Handoff to next step: Claim と App Requirements の前提をコード・依存関係・既存 E2E により具体化する。

## WL-002 — Step 1: Claim

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: deferred i18n の対象範囲と不確実性を、現行コードの表示経路に基づいて定義する。
- Inputs and checks: 先行 plan の deferred `REQ-01`、TSX AST inventory（31 files / 407 direct candidates）、`useAppStore.ts`、`useChatStore.ts`、`domain/orchestration.ts`、`backend/file.go`、Core E2E selector 利用箇所。
- Actions: UI chrome、accessible copy、dynamic status、user-facing error、native dialog を in scope とし、user / model content、technical identifiers、developer diagnostics を分離した。
- Adopted decision: 部分移行を acceptance しない。message catalog と presentation boundary を横断導入する Full Plan とする。
- Artifacts updated: `10_claim.md`。
- Open questions / risks: literal scanner だけでは domain/store の表示 string を捕捉できないため、型境界と dual-locale E2E を併用する。
- Handoff: locale preference と content integrity を App Requirements へ具体化する。

## WL-003 — Step 2: App Requirements

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: user-visible locale lifecycle、language switch、dynamic copy、content safety の MVP を定義する。
- Inputs and checks: 現行 Settings drawer、React bootstrap、chat `isDefaultTitle`、workspace persistence、supported viewport / accessibility 契約。
- Actions: `system` / `ja` / `en` preference、初回同期解決、即時切替、`<html lang>` / `Intl` 同期、既存 content 非変更を定義した。
- Adopted decision: preference は workspace から分離した application-local state とし、既存 document / chat content を locale switch で書き換えない。
- Alternatives rejected or deferred: workspace ごとの locale、remote catalog、user/AI content 翻訳、他 locale、RTL は MVP 外とした。
- Artifacts updated: `20_app_requirement.md`。
- Handoff: dependency / runtime / verification feasibility を cheatsheet に固定する。

## WL-004 — Step 3: Domain primer disposition

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: i18n 用の新規 domain primer が必要か判断する。
- Inputs and checks: `docs/cheatsheet/domain_primer.md` と本 plan の scope。
- Decision: 新規 primer は作成しない。対象 domain は既存 AI協働型Workspaceの意味を変えず、presentation locale を追加する横断基盤である。既存 domain invariant は引き続き適用する。
- Substitute: locale/content/presentation 境界は `10_claim.md`、`20_app_requirement.md`、`docs/cheatsheet/ui_i18n.md` に明記した。
- Artifacts updated: `91_worklog.md`。
- Handoff: dependency と local feasibility の pre-implementation research を確定する。

## WL-005 — Step 4: Pre-implementation research

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: i18n dependency、React integration、catalog方式、native dialog / error / E2E 境界が実装可能か検証する。
- Inputs and checks: official i18next / react-i18next docs、npm metadata、React/TS/package versions、disposable exact-version runtime spike、TSX AST inventory、store/domain/backend調査。
- Executed evidence: `i18next@26.3.6` + `react-i18next@17.0.11` の install/import/init、日本語 interpolation、英語 plural、runtime language change、Go tests、frontend tests、Wails build、Core E2E 73/73。
- Adopted decision: exact versionsを Go とし、bundled TypeScript catalog、project-owned locale resolver、semantic message descriptor、Go native dialog copy tableを採用候補ではなく仕様前提にできる。
- Alternatives rejected or deferred: custom translator、HTTP-loaded catalog、browser detector plugin、TMS SDK は現行規模とoffline要件に不要。
- Artifacts updated: `docs/cheatsheet/ui_i18n.md`, `docs/cheatsheet/index.md`, `docs/cheatsheet/link.md`。
- Open questions / risks: automated gateは翻訳自然さを保証しない。native dialogの全OS観測は acceptance環境上 EX の可能性がある。
- Handoff: REQ ID と verification/evidence class を定義する。

## WL-006 — Step 5: Requirements

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: 全 UI i18n を独立に受理可能な requirement と evidence contract へ分解する。
- Inputs and checks: Claim、App Requirements、i18n feasibility cheatsheet、現行 persistence/error/E2E 契約、baseline 73/73。
- Actions: REQ-01〜09、REQ-N01〜N03 に scope、locale lifecycle、catalog integrity、全surface migration、dynamic copy、error boundary、native dialog、content safety、accessibility/layout、completion gateを割り当てた。
- Adopted decision: 既存全E2Eは deterministic `en`、i18n coreは `ja`/`en` matrixとし、full suiteを二重実行する時間コストを避けつつ両localeのvertical sliceを保証する。
- EX boundary: macOS/Linux native dialog 実表示は単一Windows acceptance環境では直接検証不能なため、Go table test + Windows smoke + residual riskで判断する。
- Artifacts updated: `30_requirement.md`。
- Open questions / risks: requirement上の未決定なし。translation qualityと全OS native shell差は human/EX acceptanceを要する。
- Handoff: file-level design、message descriptor、Work Package、traceabilityを仕様化する。

## WL-007 — Step 6: Specification

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: requirementを small-context implementation session が実行できる file-level design と WP に落とす。
- Inputs and checks: `30_requirement.md`、i18n cheatsheet、bootstrap/config/store/domain/backend/runtime/E2E helper の現行 code、selector API追加spike。
- Actions: bundled typed catalog、LocaleProvider、system resolver、descriptor error boundary、default content rule、native binding/table、AST checker、en full suite + ja/en matrixを仕様化した。
- Work packages: WP-1 Foundation、WP-2 Semantic Messages、WP-3 Shell/Canvas/Native、WP-4 Assistant/Context/Proposal、WP-5 Gate/E2E/Human handoff。
- Adopted decisions: domainに翻訳依存を入れない、raw diagnosticをprimary UIに出さない、dead PromptBarを削除、generic chat titleはmarkerで表示時翻訳する。
- Alternatives rejected/deferred: config JSON locale field、runtime catalog fetch、full suiteのja/en二重実行、persisted contentのlocale switch rename。
- Artifacts updated: `40_specification.md`, `docs/cheatsheet/ui_i18n.md`。
- Open questions / risks: 実装前の仕様未決定なし。compile-time負荷やOS差が実測で出た場合のみplan amendする。
- Handoff: review notes、status、human review packetを同期する。

## WL-008 — Step 7: Review notes and status

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: adopted/rejected/deferred判断とevidence-based implementation handoffを同期する。
- Inputs and checks: Claim〜Specification、cheatsheet Go evidence、先行plan status/index、REQ/WP traceability。
- Actions: decision log、maximum risk、documentation feedbackを`50_review_notes.md`へ記録し、全12 requirement rowを`90_status.md`へtodoで初期化した。
- Adopted decision: plan stateは`planned`、worklog/core E2Eはenabled。baseline evidenceとimplementation evidenceを明確に分離する。
- EX handling: REQ-07の未観測OSについてreason/fallback/residual risk/decision conditionをstatusへ明記した。
- Artifacts updated: `50_review_notes.md`, `90_status.md`, `docs/plan_index.md`。
- Open questions / risks: blocking open questionなし。implementation sessionはevidenceのみ、acceptanceはseparate session/humanが行う。
- Handoff: compact human review packetを作成する。

## WL-009 — Step 8: Reviewer material

- Date: 2026-08-17
- Actor/session: planning session
- Purpose: humanがscope、decision、risk、traceability、Go/No-Goを短時間で確認できる入口を作る。
- Inputs and checks: `10_claim.md`〜`50_review_notes.md`、`90_status.md`、review packet template。
- Actions: decision/risk/open question、Mermaid architecture/WP flow、REQ snapshot、plan-specific checklist、human review routeを`60_review_packet.md`へ集約した。
- Decision: multi-lane split reviewは不要なためdefault Markdown packet一つを採用する。
- Artifacts updated: `60_review_packet.md`, `91_worklog.md`。
- Open questions / risks: planning上のblocking itemなし。human reviewer outcome欄は未記入のままhandoffする。
- Handoff: implementationはWP-1 → WP-2 → WP-3/WP-4 → WP-5の順。完了後にseparate acceptanceへ渡す。

## WL-010 — Implementation / acceptance completion

- Date: 2026-08-18
- Actor/session: leader、worker sessions、persistent acceptance sub-agent、human reviewer
- Purpose: 承認済みWP-1〜5を実装し、独立受入と人間E4/native確認を完了する。
- Actions: typed bundled catalog、locale lifecycle、semantic message境界、全production UI migration、native dialog locale、literal checker、locale-stable E2Eを実装した。acceptanceで検出したselector、plural、raw error、focus、fault seam、layout evidenceの未達は新規workerで修正し、同じacceptance sessionで再確認した。
- Automated evidence: production literal 0/62、`mise run test` Pass、direct `test:i18n` Pass、`mise run build` Pass、full E2E 93/93 Pass、process/temp/port cleanup Pass。
- Human evidence: 2026-08-18、ユーザーが提示手順を確認し「問題無いと思います」と受理した。
- EX: macOS/Linux native dialogは未観測。Go pure table、binding/callsite、Windows smokeをfallbackとしてEX受理。
- Result: 全REQをPassまたは受理EXとし、`90_status.md` とPlan Indexを`done`へ更新した。

## WL-010 — Step 9: WP-5 implementation gate and handoff

- Date: 2026-08-17
- Actor/session: WP-5 worker resume session
- Purpose: stalled workerの共有worktreeを再検証し、checker/test:i18n、dual-locale CE2E、full regression/build/E2Eを完了させる。
- Actions: production JSX literal checkerをtechnical attributeとuser-visible expressionに分離し、reviewed allowlistへ理由を付与。creation-guard descriptor、ChatDrawer raw diagnostic boundary、locale-stable assistant selectors、I18N-05 drawer stateを修正した。
- Evidence: `test:i18n` literal 0/62 files、`mise run test` PASS、`mise run build` PASS、I18N matrix 15/15、creation guard 2/2、full E2E 88/88。temp root、port 34115、孤立 processを確認しcleanup済み。
- Known log: Wails `runtime:ready -> Unknown message from front end` は出力されるが、suite結果とcleanupを阻害しない。
- Handoff: Windows native dialog title/filter、ja/en × 1280/1920 visual/layout、keyboard/accessibility、content preservationはhuman/separate acceptanceへ委譲。Acceptance欄とstateは変更しない。
