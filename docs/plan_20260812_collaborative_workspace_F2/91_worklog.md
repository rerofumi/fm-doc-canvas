# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and plan start

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: F1 完了後の F2 を新規 plan として分類。
- Sources and checks: `05_roadmap.md` F-2、F1 `90_status.md`、F1 `50_review_notes.md`、`docs/plan_index.md`。
- Actions: F2 を Full、Core E2E in scope、worklog enabled とした。
- Decision: F2 は domain / Agent / UI / persistence に広く影響するため Full。F1 と同じ検証方針を継承。
- Alternatives rejected or deferred: Light は scope が広く Proposal / Relation の分離に不足するため採用しない。
- Artifacts updated: `10_claim.md`、`90_status.md`。
- Open questions / risks: V1.3 optional metadata の strict parser 互換性。
- Handoff: 現行 domain と再利用可能な土台を確認する。

## WL-002 — Step 1: Claim

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: F2 の価値仮説と不確実性を明文化。
- Sources and checks: F-2A/B、Gate F-2、F1 acceptance evidence。
- Actions: CW-2 を「非破壊派生 + typed Relation + human Proposal」として定義。
- Decision: 変形・Relation・由来・undo を同じ共同編集境界で扱う。
- Deferred: split / merge / variant は core の実利用後。
- Artifacts updated: `10_claim.md`。
- Handoff: MVP UX と non-goals を定義する。

## WL-003 — Step 2: App Requirements

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: ユーザーが価値を確認できる最小体験を定義。
- Sources and checks: `05_roadmap.md` CW-2、`01_research.md` 構造化・閉ループ節、F1 domain contract。
- Actions: summarize / compare / counterpoint、Proposal preview / decision、Relation detail、Context continuity を MVP とした。
- Decision: 生成物は元 Node の直接編集ではなく、採用時だけ derived Node になる。
- Deferred: 外部 Context、画像、Generated View。
- Artifacts updated: `20_app_requirement.md`。
- Handoff: REQ ID と verification を割り当てる。

## WL-004 — Step 3: Domain and pre-implementation research

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: 未実装候補と既存土台を確認。
- Sources and checks: `workspace.ts`、`workspaceCommands.ts`、`proposal.ts`、`contextResolver.ts`、`workspacePersistence.ts`、`agent_loop.go`、`mise run test`、`mise exec -- go vet ./...`。
- Actions: F1 の Relation は accepted / context 固定、Proposal は edit/create text、V1.3 persistence、Core E2E harness は実装済みと確認。
- Decision: 新規 dependency / external API は採用せず、既存 tool-call contract / command history を拡張。
- Evidence: 2026-08-12 baseline test と vet は exit 0。
- Open questions: structured proposal の provider compatibility は fake provider と既存契約で先行検証。
- Artifacts updated: `30_requirement.md`、`40_specification.md`。
- Handoff: implementation-ready specification をレビューする。

## WL-005 — Step 4: Requirements

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: F2 Gate を検証可能な REQ に分解。
- Actions: REQ-01〜14、NFR-01〜04、F2-01〜04、completion commands を定義。
- Decision: source arity、allowlist、revision、atomicity、accepted-only Context を必須条件にした。
- Deferred: 性能 SLO と Relation confidence score。
- Artifacts updated: `30_requirement.md`、`90_status.md`。
- Handoff: target files / data model / WP を確定する。

## WL-006 — Step 5: Specification

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: 実装者が迷わない構造と順序を定義。
- Actions: transform request / draft、Relation extension、Proposal operation、atomic command、Agent tool、UI、persistence、WP-0〜5 を記載。
- Decision: `applyTransform` を one transaction / one undo とし、V1.3 compatible optional extension を採用。
- Risks: split / merge を同じ command に広げない。core slice の receipt と rollback を優先。
- Artifacts updated: `40_specification.md`。
- Handoff: review notes / packet で未決定事項を明示する。

## WL-007 — Step 6: Review Notes and Status

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: 採用・棄却・保留の判断を plan 内に残す。
- Actions: F1 Relation の再利用、structured Proposal、V1.3 方針、F2 follow-up を review notes に記録。status acceptance table を初期化。
- Decision: unaccepted candidate は document / Save / Context に漏らさない。
- Artifacts updated: `50_review_notes.md`、`90_status.md`。
- Handoff: reviewer が判断すべきリスクを packet に整理する。

## WL-008 — Step 7: Reviewer material

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: F2 の判断点と traceability を短くレビュー可能にする。
- Actions: Plan overview、impact map、risk table、Go / No-Go、REQ/WP snapshot、checklist を作成。
- Decision: split review は不要とし、default `60_review_packet.md` を採用。
- Artifacts updated: `60_review_packet.md`。
- Handoff: implementation 前に decisions needed を確認する。

## WL-009 — Step 8: Pre-implementation handoff

- Date/time: 2026-08-12
- Actor/session: Codex planning session
- Purpose: 計画文書一式と index の整合を確認。
- Sources and checks: all F2 plan docs、F1 `90_status.md`、`docs/plan_index.md`、baseline test / vet。
- Actions: F1 index state を `done` に補正し、F2 row を `planned` として追加。
- Decision: F2 は実装未着手の `planned`。status acceptance は空欄のまま。
- Open questions / risks: V1.3 extension と Relation label density は implementation / UX review の Go 条件。
- Artifacts updated: `docs/plan_index.md`、F2 plan directory。
- Handoff: 実装セッションは requirements / specification を読み、`90_status.md` の implementer evidence のみ更新する。

## WL-010 — Steps 5〜8 amend: Roadmap coverage review

- Date/time: 2026-08-12
- Actor/session: Codex review amend session
- Purpose: `05_roadmap.md` の F-2 / CW-2 / Direct Action 境界と F2 plan の抜けを解消する。
- Sources and checks: roadmap Gate F-2、DC-07、F-1C、推奨検証順、F2 requirements / specification / status / review packet、fm-dev-process acceptance rules。
- Actions: REQ-15〜18 と F2-05 を追加し、human spatial feedback、entry-specific approval、preview/diff、task-based E4 Gate を要件・仕様・WP・E2E・status へ接続。NFR-01〜04 の acceptance rows と deferred transform disposition を追加。
- Decision and concise rationale: plan `done` は F2 core slice のみを閉じ、ロードマップ F-2 milestone は extract / split / merge / reframe / variant / card conversion の disposition 完了まで open とする。Direct Action は追加承認を避け、post-apply diff / undo で可逆性を保つ。
- Alternatives rejected or deferred: 全 transform を同一 Proposal 経路へ統一する案は Direct Action の採用済み一発操作境界を壊すため棄却。配置から Relation を自動推論する案は人間の意味所有を侵すため棄却。
- Artifacts updated: `10_claim.md`、`20_app_requirement.md`、`30_requirement.md`、`40_specification.md`、`50_review_notes.md`、`60_review_packet.md`、`90_status.md`、`91_worklog.md`、`docs/plan_index.md`。
- Open questions / risks: raw position hint の有用性、source-output comparison の表示密度、実課題 Gate review の代表性は実装・別受入 session で確認する。
- Handoff to next step: 実装前 review で追加 Decisions Needed を承認し、WP-0〜5 は REQ-01〜18 / NFR-01〜04 と F2-01〜05 を基準に進める。

## WL-011 — Step 9: Implementation

- Date/time: 2026-08-12
- Actor/session: Codex implementation session
- Purpose: F2 core の domain、structured Proposal、Direct Action、Relation、Context、persistence、E2E を実装。
- Sources and checks: `40_specification.md`、`90_status.md`、既存 F1 domain / Agent contract、`mise.toml` tasks。
- Actions: `transform.ts`、atomic `applyTransform`、typed Relation reason/reverse、V1.3 roundtrip、`relationHints` / `spatialHints`、`propose_transform`、Direct Action receipt、F2 tests / E2E を追加。
- Decision: Direct Action は `applyDirectTransform` を通じて Proposal を作らず、一つの history transaction と post-apply receipt を返す。Dialogue / Agent は既存 acknowledgement と `createTransformProposal` を使う。
- Evidence: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` が exit 0。Core E2E は13件全 pass。
- Open questions / risks: 実課題での REQ-18 value Gate、Proposal comparison / Direct Action diff の表示密度、relation label の UX は未受入。
- Handoff: 別 acceptance session / human が E1 evidence を再実行し、E4 UX / value review 後に acceptance 欄と plan state を更新する。

## WL-012 — Step 9 amend: Direct Action backend boundary

- Date/time: 2026-08-12
- Actor/session: Codex implementation session
- Purpose: Direct Action が既存 GenerateText の frontend shortcut ではなく、scope / source revision を検証する dedicated bound method を持つことを確認。
- Actions: backend `DirectTransformRequest` / `DirectTransform` と Wails bindings を追加し、one-shot structured draft を frontend atomic apply に接続。
- Decision: scope correlation、source ID、source revision が一致しない direct request は provider 呼び出し前に reject。Dialogue/Agent route への暗黙 fallback はしない。
- Evidence: Wails production build、Go tests/vet、13件の Core E2E が pass。
- Handoff: acceptance session は Direct Action の post-apply diff、Dialogue Proposal の pre-apply comparison、undo を人間 UX 観点で確認する。

## WL-013 — Step 10: Acceptance (Hold)

- Date/time: 2026-08-13
- Actor/session: Codex acceptance session
- Purpose: F2 core の E1/E3/E4 evidence を独立に再検証し、Gate を判定。
- Checks: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` はすべて exit 0。Core E2E は13/13 pass。差分・実装ポインタ・ローカル Wails UI を確認。
- Result: Hold / not accepted。Direct Action の latest-state stale guard と backend body allowlist、Proposal / Direct comparison、Relation create / AI Proposal UX、plan-defined E2E coverage が要件未達。
- Evidence: `90_status.md` Acceptance Findings、`useAppStore.ts` `runDirectTransform`、`app.go` `DirectTransform`、`ToolCard.tsx`、`App.tsx`、`CanvasArea.tsx`、`ce2e-f2.spec.ts`。
- Residual risk: LLM 遅着で New / Discard 後の state を巻き戻す可能性と、選択外本文を Direct backend request に混入できる契約上のリスク。
- Handoff: repair session で fail 行を修正し、不足 E1/E2E を追加後、別 acceptance session で全行を再受入する。

## WL-014 — Step 9 repair: F2 Hold findings

- Date/time: 2026-08-13
- Actor/session: Grok repair session
- Purpose: 受入 Hold の P1/P2 修正指示を実装し、再受入可能な evidence を揃える。Acceptance 欄と plan `done` は更新しない。
- Actions:
  - P1 Direct stale guard: `revalidateDirectTransform` + `runDirectTransform` が provider await 後に latest workspace を再検証し、stale/cancelled/conflict を no-op。
  - P1 body allowlist: `DirectTransformRequest.Validate` で source IDs / sourceNodes / sourceRevisions の完全一致、allowlist 順序の body 構築、response correlation を返す。
  - P2 comparison UI: `ToolCard` に Proposal metadata / source-output comparison / Modify fields、`App` Direct receipt に `diff` 表示と Undo。
  - P2 Relation: `RelationEditorDialog`、ContextMenu menu semantics、`propose_relation` tool、suggested Relation scope guard。
  - P2 E2E: `ce2e-f2.spec.ts` を F2-01〜05 の UI/lifecycle 検証に拡張。transform fault injection と delayed Direct no-op を追加。
- Checks: `mise run test`、`mise exec -- go vet ./...`、`mise exec -- npm --prefix frontend run build`、`mise run build`、`mise run e2e` すべて exit 0（E2E 16/16）。
- Artifacts updated: `90_status.md` implementer state/evidence only、`91_worklog.md` 本エントリ。
- Handoff: 別 acceptance session が fail/hold 行を再判定し、Acceptance 欄と plan state を更新する。

## WL-015 — Step 10: Re-Acceptance (Hold)

- Date/time: 2026-08-13
- Actor/session: Codex re-acceptance session
- Purpose: WL-014 repair の独立再検証と F2 core value Gate 再判定。
- Checks: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` は全 exit 0。Core E2E 16/16 pass。前回5 findings のコード/evidenceを再確認し、合成比較課題をWails実画面で操作。
- Result: Hold / not accepted。前回 findings は解消したが、Ctrl/Shift+click後に`onNodeClick → setActiveNode`がselectionを1件へ戻し、Compare/Relationを実UIから開始できない。
- Evidence: `CanvasArea.tsx` `onNodeClick`、`useAppStore.ts` `setActiveNode` / `onNodesChange`、`ce2e-f2.spec.ts` F2-01/F2-03、`90_status.md` Re-Acceptance Findings。
- Handoff: active node更新とmulti-selection同期を分離し、実際のCtrl/Meta/selection-box操作で2 Node選択→Compare/Relationへ進むE2Eを追加後、再受入する。

## WL-016 — Step 9 repair: real UI multi-selection

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: WL-015 の実画面 multi-select blocker を修正し、Compare / manual Relation の主要導線を再受入可能にする。Acceptance 欄と plan state は変更しない。
- Actions:
  - `setActiveNode` に selection-preserving mode を追加し、通常クリックは単一選択、Ctrl / Meta / Shift click は既存選択を保持して active node を更新するよう分離。
  - React Flow の `multiSelectionKeyCode` を Ctrl / Meta / Shift に明示し、修飾キーで選択済み Node を再クリックした場合は React Flow の toggle-off を上書きしないようにした。
  - `onNodesChange` は投影後の全 selected IDs を保持しつつ、直近で選択した Node を active node として同期するよう修正。
  - F2-01 は実画面の Shift 選択追加・解除・再追加から Compare / diff / Undo、F2-03 は実画面の Ctrl 選択から node context menu / manual Relation 作成へ進むよう変更。selection bridge は主要導線から除去。
- Checks: `mise run test`、`mise exec -- go vet ./...`、`mise exec -- npm --prefix frontend run build`、`mise run build`、`mise run e2e` が exit 0。E2E は 16/16 pass。
- Artifacts updated: `frontend/src/types/index.ts`、`frontend/src/store/useAppStore.ts`、`frontend/src/components/canvas/CanvasArea.tsx`、`frontend/e2e/ce2e-f2.spec.ts`、`90_status.md` implementer evidence、`91_worklog.md`。
- Residual review: REQ-18 の実課題 E4 value Gate と acceptance fail/hold 行の再判定は別 acceptance session / human が行う。
- Handoff: 実画面で Ctrl / Shift 選択 → Compare / Relation を再確認し、Acceptance 欄と plan state を更新する。

## WL-017 — Step 9 patch: Relation editor long-label layout

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: 長い Node ID / 本文を持つ Edit Relation で native select が dialog 幅を押し広げる表示崩れを修正する。
- Actions: dialog / grid label / select / textarea に `min-w-0` と field の `w-full max-w-full` を設定し、dialog に viewport 高さ上限と縦スクロールを追加。F2-03 の Node 本文を長文化し、Add / Edit Relation の field bounding box が dialog 内に収まる assertion を追加。
- Checks: `mise exec -- npm --prefix frontend run build` exit 0。`mise run e2e` 16/16 pass（長文 Add / Edit Relation の dialog 境界 assertion を含む）。
- Artifacts updated: `frontend/src/components/ui/RelationEditorDialog.tsx`、`frontend/e2e/ce2e-f2.spec.ts`、`90_status.md` implementer evidence、`91_worklog.md`。
- Handoff: 人間の再受入で Edit Relation の長文ラベル表示を確認し、Acceptance 欄は別 session で判定する。

## WL-018 — Step 9 patch: Relation reverse visibility

- Date/time: 2026-08-13
- Actor/session: Codex repair session
- Purpose: Relation reverse 後にレコードは残るが React Flow edge が消える表示不具合を修正する。
- Cause / actions: `reverseRelation` が endpoint と同時に `sourceHandle` / `targetHandle` を交換し、新sourceへtarget専用handle、新targetへsource専用handleを割り当てていた。endpointのみ交換し、presentation handle roleを維持するよう修正。
- Checks: domain testでendpoint reverseと`right-source` / `left-target`維持を確認。F2-03でreverse後のdomain edge方向と `rf__edge-*` 可視性を確認。全test、E2E 17/17、Go vet、Frontend/Wails build pass。
- Artifacts updated: `workspaceCommands.ts`、domain test、`ce2e-f2.spec.ts`、`40_specification.md`、`90_status.md` implementer evidence、`91_worklog.md`。
- Handoff: 受入担当は実画面でreverse後の矢印方向・label・edge可視性を再確認する。Acceptance欄は変更しない。

## WL-019 — Step 10: Final user acceptance / REQ-18 Go

- Date/time: 2026-08-13
- Actor/session: User acceptance session
- Purpose: 修正後の F-2 core implementation journeys と REQ-18 value Gate を最終判定する。
- Evidence: User が F-2 実装項目を実画面で動作確認し、REQ-18 を Go 承認。直前の E1 は `mise run test`、Go vet、Frontend/Wails build、`mise run e2e` 17/17 pass。
- Decision: REQ-01/07/12/14 の過去 blocker は修正・再確認済み、REQ-18 は pass。REQ-01〜18 / NFR-01〜04 が全passのため F2 core planを`done`とする。
- Boundary: この closure は Collaborative Transform & Relate core slice。ロードマップ F-2 は extract / split / merge / reframe / variant / card conversion / multimodal / Generated View の disposition 完了まで open。
- Artifacts updated: `90_status.md` Acceptance/state、`91_worklog.md`、`docs/plan_index.md`。
- Handoff: 後続F-2候補は採用・延期・棄却を別plan/roadmapで決定する。

## WL-020 — Step 11: As-built documentation feedback

- Date/time: 2026-08-13
- Actor/session: Codex documentation feedback session
- Purpose: F1/F2で受理済みの現行挙動をcurrent docsへ反映し、旧V1.2/chat persistence記述との矛盾を解消する。
- Actions: `claim.md`、`app_requirement.md`、`requirement.md`、`specification.md`、`review_notes.md`へblank Workspace、memory-only Dialogue、V1.3、SubCanvas Parent、Transform Proposal/Direct Action、typed Relation、atomic applyを反映。
- Decision: core closureで確認済みのas-built factsのみをcurrent docsへ統合し、後続F-2候補はplan/roadmap側に残す。
- Handoff: 次の計画はcurrent docsをbaselineとし、後続candidateの採用・延期・棄却を明示する。
