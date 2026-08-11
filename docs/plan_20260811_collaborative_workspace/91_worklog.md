# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and active plan

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: 既存の方向性資料を、実装・E2E・受理へ進められる Full plan に昇格する。
- Sources and checks: `fm-dev-process` skill、`00_usecase.md`、`01_research.md`、`02_consultant.md`、`05_roadmap.md`、`08_glossary.md`、current docs、現行コード、`jj status`。
- Actions: `docs/plan_20260811_1/` を `docs/plan_20260811_collaborative_workspace/` へ変更し、status と worklog を初期化した。
- Decision and concise rationale: Full tier、Core E2E 有り、worklog 有り。受理対象は roadmap 全体ではなく、最初の実装可能 slice である D-12・D-02・F-1 に限定する。
- Alternatives rejected or deferred: F-2〜F-6 の一括実装は各 Gate を無効化して計画を過大化するため、後続 plan へ分離する。suffix は製品の canonical 概念を表す `collaborative_workspace` とした。
- Artifacts updated: `90_status.md`、`91_worklog.md`。
- Open questions / risks: E2E runner は候補段階であり、実 browser + Wails binding smoke と子 process cleanup の Go 判定が必要。
- Handoff to next step: Claim と App Requirements で foundation slice の価値と境界を固定する。

## WL-002 — Step 1: Claim

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: 方向性ロードマップから今回の実装可能な問題と受理範囲を抽出する。
- Sources and checks: `00_usecase.md`、`01_research.md`、`02_consultant.md`、`05_roadmap.md`、現行 `App.tsx` / stores / Canvas snapshot / Chat persistence。
- Actions: `10_claim.md` に D-12・D-02・F-1 の目的、現行不整合、初期仮説、E2E 不確実性を記録した。
- Decision and concise rationale: F-2 以降の価値検証を壊さないため、型・寿命・scope・proposal・migration・E2E を foundation として先に扱う。
- Alternatives rejected or deferred: roadmap 全体の単一実装、Chat 単独修正、Text / Artifact の片方向 Promote だけの対応。
- Artifacts updated: `10_claim.md`。
- Open questions / risks: E2E runner の Go 判定、保存 schema と event 相関の横断 migration。
- Handoff to next step: MVP のユーザー体験と非目標を定義する。

## WL-003 — Step 2: App Requirements

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: foundation slice をユーザーが観察できる開始・作業・終了体験へ落とす。
- Sources and checks: `10_claim.md`、roadmap D-02〜D-06 / D-12 / F-1、canonical glossary。
- Actions: `20_app_requirement.md` に blank start、role 往復、SubCanvas scope、Context 表示、Proposal、Discard / Export / Save を定義した。
- Decision and concise rationale: Artifact は Outcome 状態ではなく file-oriented role、Dialogue は保存物ではなく短期調整面として扱う。
- Alternatives rejected or deferred: Pause、保存確認、全 Chat 永続化、個別 Boundary Proxy、外部 Context integration。
- Artifacts updated: `20_app_requirement.md`。
- Open questions / risks: 既存 Chat file は自動削除せず、以後の active persistence だけ停止する。
- Handoff to next step: domain invariant を cheatsheet に整理し、技術候補を検証する。

## WL-004 — Step 3: Domain Primer

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: Workspace、AI Partner、Context、Proposal、寿命を実装語彙より先に共有できるようにする。
- Sources and checks: `01_research.md`、`05_roadmap.md`、`08_glossary.md`、`fm-dev-process` document role。
- Actions: `docs/cheatsheet/domain_primer.md` を作成し、cheatsheet index へ登録した。
- Decision and concise rationale: project 固有の D / F / REQ は plan に残し、再利用可能な domain invariant だけを primer に置いた。
- Alternatives rejected or deferred: user 固有の調査全文や roadmap を cheatsheet へ複製すること。
- Artifacts updated: `docs/cheatsheet/domain_primer.md`、`docs/cheatsheet/index.md`。
- Open questions / risks: なし。外部 Context の詳細は後続 plan で更新する。
- Handoff to next step: local runtime と E2E runner 候補を検証する。

## WL-005 — Step 4: Pre-implementation research

- Date: 2026-08-11
- Actor/session: Codex planning session + research subagents
- Purpose: build/test baseline と UI→Wails→Go E2E の実現条件を確認する。
- Sources and checks: Wails / Playwright 公式 docs、local CLI help、現行 tests、`mise.toml`、`frontend/package.json`。Go test、vet、Frontend logic test/build、Wails production build は exit 0。
- Actions: `docs/cheatsheet/wails_playwright_e2e.md` と source links を追加した。Playwright 1.62.1 の package version と CLI 起動を確認した。
- Decision and concise rationale: Playwright は browser + Wails binding smoke と process cleanup が未確認のため HOLD。採用は WP-0 の実行済み Go 判定後とする。
- Alternatives rejected or deferred: 現行 pure logic test を E2E と呼ぶこと、Core E2E を real API / user data に依存させること、browser test だけで native WebView2 を受理すること。
- Artifacts updated: `docs/cheatsheet/wails_playwright_e2e.md`、`docs/cheatsheet/index.md`、`docs/cheatsheet/link.md`。
- Open questions / risks: Wails native window と browser process の cleanup、port、Playwright browser availability、floating tool versions。
- Handoff to next step: REQ ID と Evidence class を確定する。

## WL-006 — Step 5: Requirements

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: foundation の挙動、互換、安全境界、E2E を受理可能な REQ にする。
- Sources and checks: `10_claim.md`、`20_app_requirement.md`、domain primer、現行 code/test/persistence、E2E feasibility。
- Actions: `30_requirement.md` に REQ-01〜REQ-17、verification method、E1/E2/E4、Core E2E 5 scenario を定義した。
- Decision and concise rationale: E2E を build の付随確認ではなく必須 REQ とし、browser automation と native WebView2 smoke の責務を分けた。
- Alternatives rejected or deferred: 未検証項目の pass 扱い、Core E2E の EX waiver、外部 API / real user data を使う E2E。
- Artifacts updated: `30_requirement.md`。
- Open questions / risks: runner Go 判定前は `mise run e2e` 未実装。WP-0 を実装開始 Gate とする。
- Handoff to next step: domain model、migration、state machine、WP を implementation-ready にする。

## WL-007 — Step 6: Specification

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: REQ-01〜REQ-17 を target file、domain model、DTO、state machine、migration、WP へ落とす。
- Sources and checks: 現行 Frontend/Backend architecture、V1.0〜V1.2 schema、Chat service、Wails dev/E2E調査、roadmap D-02/D-03/D-05/D-06/D-12/F-1。
- Actions: `40_specification.md` に V1.3、runtime/persistence分離、SubCanvas ownership、Context Resolver、Proposal wait/undo、E2E composition root、WP-0〜WP-5 を定義した。
- Decision and concise rationale: V1.2 を再解釈せず 1.3 adapter migration とし、browser E2E runner は WP-0 の verified Go 後だけ採用する。
- Alternatives rejected or deferred: flat Canvas のまま UI だけ group化、即時 proposal apply、10秒 human timeout、legacy chat file自動削除、F-2 semantic Relation UI。
- Artifacts updated: `40_specification.md`。
- Open questions / risks: WP-0 の runner Go/No-Go、native dialog adapter、floating toolchain pin後の互換。
- Handoff to next step: review findings、deferred/rejected items、Go条件を整理する。

## WL-008 — Step 7: Review Notes and Status

- Date: 2026-08-11
- Actor/session: Codex planning session + repository/E2E review subagents
- Purpose: 計画の矛盾、最大risk、採用・保留・棄却、受理状態を明示する。
- Sources and checks: 全 plan docs、current code/status、subagent architecture/E2E review、baseline commands。
- Actions: `50_review_notes.md` を作成し、scope、V1.3、Dialogue、legacy chat、Proposal、E2E の判断を記録した。`90_status.md` のAcceptance表作成へ引き渡した。
- Decision and concise rationale: implementationはWP-0 Go gate付きで開始可能。未検証 runner をsettled stackとして扱わない。
- Alternatives rejected or deferred: roadmap一括実装、V1.2再解釈、legacy chat自動削除、E2E waiver。
- Artifacts updated: `50_review_notes.md`。
- Open questions / risks: Review Packetのdecision tableとWP-0条件をhumanが確認する。
- Handoff to next step: compact review packet と traceability checklist を作る。

## WL-009 — Step 8: Reviewer material

- Date: 2026-08-11
- Actor/session: Codex planning session
- Purpose: human reviewerがscope、risk、Go/No-Go、traceabilityをplan本文の再読なしに確認できるようにする。
- Sources and checks: `30_requirement.md`、`40_specification.md`、`50_review_notes.md`、E2E/architecture findings。
- Actions: `60_review_packet.md` にdecision table、risk、Mermaid overview、REQ group traceability、checklist、Go recommendationを作成した。
- Decision and concise rationale: 単一reviewer向けのためsplit brief/board/checklistではなくdefault Markdown packetを採用した。
- Alternatives rejected or deferred: plan本文の複製、CDN依存HTML board、lane別review資料。
- Artifacts updated: `60_review_packet.md`。
- Open questions / risks: WP-0のrunner Go結果はimplementation時に新しいworklog entryとcheatsheetへ追記する。
- Handoff to next step: status table、plan index、link、文書整合を最終検証する。

## WL-010 — Step 8: Final plan validation

- Date: 2026-08-11
- Actor/session: Codex planning session + independent review subagents
- Purpose: Full plan 一式の status、traceability、local link、変更範囲を最終確認する。
- Sources and checks: `30_requirement.md`、`40_specification.md`、`60_review_packet.md`、`90_status.md`、`docs/plan_index.md`、`jj diff`。REQ/status ID、WP/CE2E対応、Markdown table、local link、worklog Step 0〜8 を機械確認した。
- Actions: `90_status.md` の Acceptance 表を REQ-01〜REQ-17 の全件 `todo` で初期化し、plan index を更新した。WL-008 の引き渡し後に status 初期化が完了したことを本 entry で追記する。
- Decision and concise rationale: planning baseline の実行結果は実装後 evidence に流用せず、WP-0 の E2E runner は HOLD のまま Go 条件を維持する。
- Alternatives rejected or deferred: baseline pass を acceptance の pass とみなすこと、review 前に status を `implemented` / `verified` へ進めること。
- Artifacts updated: `90_status.md`、`docs/plan_index.md`、`91_worklog.md`。
- Open questions / risks: Playwright 候補の Go/No-Go と native WebView2 smoke は implementation worklog で evidence を追記する。
- Handoff to next step: reviewer は `60_review_packet.md` と `90_status.md` を起点に WP-0 開始可否を判断する。

## WL-011 — Step 7/8 amendment: independent review closure

- Date: 2026-08-11
- Actor/session: Codex planning session + plan-quality / traceability / feasibility reviewers
- Purpose: 初稿のimplementation blockerを解消し、Full planを再びreview可能な状態にする。
- Sources and checks: reviewersのread-only findings、最新`20_app_requirement.md`〜`90_status.md`、現行store / Wails / persistence構成。
- Actions: complete resolver inputとbody allowlist、Frontend freshness authority、Chat / Direct Action scope DTO、Proposal decision/apply二段階protocol、Folder tree lifecycleと全方向boundary projection、厳密V1.3 union / migration matrix、Backend/Frontend E2E seamsを仕様へ追加した。REQ-15のE1/E4混在を分離し、REQ-18/19を追加した。
- Decision and concise rationale: Backendは最新Workspace registryを持たずrequest-local検証に限定し、Frontend compare-and-applyをlate resultの最終権威にする。未採用CandidateやCurrent Canvas全本文をAgent toolへ渡さない。
- Alternatives rejected or deferred: unresolved blockerをWP-0へ先送りすること、Folder badgeだけでancestor/siblingを表すこと、未知V1.3 fieldを黙ってdropすること、keyboard automationをhuman reviewだけで代替すること。
- Artifacts updated: `10_claim.md`、`20_app_requirement.md`、`30_requirement.md`、`40_specification.md`、`50_review_notes.md`、`60_review_packet.md`、`90_status.md`、`91_worklog.md`、`docs/cheatsheet/domain_primer.md`。
- Open questions / risks: planning baselineはhuman review pending。Playwright candidateは引き続きHOLDで、WP-0の実binding / isolation / cleanup Goが必要。
- Handoff to next step: 最新snapshotでREQ/status/WP/link/markdown整合を再監査し、human reviewへ渡す。

## WL-012 — Step 8: Final independent re-review and handoff

- Date: 2026-08-11
- Actor/session: Codex planning session + plan-quality / traceability / feasibility reviewers
- Purpose: amendment後snapshotのimplementation readinessと文書整合を確定する。
- Sources and checks: Full plan全成果物、最新independent review 3系統、REQ/status/spec ID比較、local link、Markdown table / fence、old path link、secret pattern、`jj diff`。
- Actions: scope epoch / active run、ContextSelection正本、Direct Action vision/provider、`create-text` Proposal、remote Relation metadata、V1.3 extensions/load、E2E undo faultを補完した。REQ-01〜REQ-19はRequirement / Spec trace / Statusで各19件一致し、全Acceptanceを未記入のまま維持した。
- Decision and concise rationale: Blocker / High / Mediumの残存なし。human reviewでplanning baselineを承認した後、WP-0のrunner実測Go gateへ進める。Playwrightは引き続きHOLDであり、未検証採用ではない。
- Alternatives rejected or deferred: review指摘をimplementation時の裁量へ残すこと、baseline checkをpost-change acceptance evidenceへ流用すること、WP-0前にrunnerをadopted扱いすること。
- Artifacts updated: `20_app_requirement.md`、`30_requirement.md`、`40_specification.md`、`50_review_notes.md`、`60_review_packet.md`、`90_status.md`、`91_worklog.md`。
- Open questions / risks: humanのDecisions Needed、Playwright / Wails binding / cleanup実測、native WebView2 smokeは未実施で、statusはplanned / todoのまま。
- Handoff to next step: `60_review_packet.md`でhuman reviewし、承認後に`40_specification.md` WP-0からimplementationを開始する。
