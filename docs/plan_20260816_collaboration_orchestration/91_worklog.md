# Planning Worklog

worklog: enabled

## WL-001 — Step 0: Tier and active plan

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: F6 の曖昧な要求を、価値検証可能な実装範囲と将来候補に分けた Full plan として組み立てる。
- Sources and checks: `fm-dev-process` skill、`00_reflection.md`、`docs/plan_index.md`、F1〜F5 plan、current docs、現行 frontend / backend の read-only inspection、`jj status`。
- Actions: 既存 `plan_20260816_collaboration_orchestration` を active plan とし、`90_status.md` と worklog を初期化した。
- Decision and concise rationale: Full tier、Core E2E in scope、worklog enabled。F6 は既存能力を横断する協働調整層であり、Human UX Gate とアーキテクチャ境界のレビューが必要なため Full とする。
- Alternatives rejected or deferred: Light tier、E2E 対象外、worklog 無効はいずれもユーザー選択により不採用。
- Artifacts updated: `90_status.md`、`91_worklog.md`。
- Open questions / risks: 初期 Action allowlist、提案から実行への承認境界、結果表示と一時状態の寿命を後続 Step で確定する。
- Handoff to next step: F1〜F5 の Go 済み能力と F6 非対象を Claim / App Requirements へ整理する。

## WL-002 — Step 1: Claim

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: 曖昧な F6 要求から、最初に検証する問題・仮説・Stop 条件を切り出す。
- Sources and checks: `00_reflection.md`、roadmap F-6 / CW-5、F1〜F5 status、current docs、現行 Agent tools / Direct Actions / Proposal UI。
- Actions: `10_claim.md` に既存能力の分散、one-shot Action Proposal 仮説、core allowlist、成功・失敗仮説を記録した。
- Decision and concise rationale: F6 は capability 追加ではなく capability 選択の共同判断を検証する。Suggestion 生成と実行を分離し、既存 result surface へ戻す。
- Alternatives rejected or deferred: system prompt だけの自然文提案、Agent tool の自動 chaining、全 F1〜F5 capability の同時統合。
- Artifacts updated: `10_claim.md`。
- Open questions / risks: 提案数、Focus 解決、target / query 編集量、one-shot 選択品質を E2E / E4 で確認する。
- Handoff to next step: MVP journey と初期 / 将来 capability boundary を App Requirements へ固定する。

## WL-003 — Step 2: App Requirements

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: 最初に実装して価値を確認する範囲と、今回実装しない候補を製品体験として分ける。
- Sources and checks: Claim、既存 `runDirectTransform` / `runWebSearch` / Relation・Cluster suggestion、F2〜F5 Gate 結果。
- Actions: `20_app_requirement.md` に手動呼出し、1〜3 cards、軽い修正、single dispatch、runtime-only lifecycle、初期 capability mapping、将来候補を定義した。
- Decision and concise rationale: compare / counterpoint / web search / Relation / Cluster と clarify に限定する。画像、summarize、AL-3、multi-step は core Gate と混ぜない。
- Alternatives rejected or deferred: action kind / AL / provider を自由編集する cockpit、起動・selection 変更による自動提案。
- Artifacts updated: `20_app_requirement.md`。
- Open questions / risks: `clarify` card と通常 Dialogue の接続方法、Cluster 対象数の実利用妥当性。
- Handoff to next step: domain invariant を更新し、既存技術 seam の Go / No-Go を確認する。

## WL-004 — Step 3: Domain Primer

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: Action Proposal と Action Level の意味を、F6 固有 UI より先に再利用可能な domain invariant として明示する。
- Sources and checks: `docs/cheatsheet/domain_primer.md`、roadmap 4.2 / F-6、`00_reflection.md`。
- Actions: `Action Proposal` の定義、AL は成熟度ではないこと、proposal 生成と実行を分ける invariant を追加し、cheatsheet index の確認日を更新した。
- Decision and concise rationale: 実装型や action ID は plan に残し、AI協働型Workspaceへ再利用できる境界だけを cheatsheet に加えた。
- Alternatives rejected or deferred: F6 の全 UI / DTO を domain primer へ複製すること。
- Artifacts updated: `docs/cheatsheet/domain_primer.md`、`docs/cheatsheet/index.md`。
- Open questions / risks: なし。
- Handoff to next step: 新規 dependency / API 不要と既存 seam の再利用可能性を research step で記録する。

## WL-005 — Step 4: Pre-implementation research

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: 詳細仕様の前に、候補 route と verification harness が現行コードで利用可能か確認する。
- Sources and checks: `backend/agent_loop.go`、`backend/agent_types.go`、`backend/suggest_service.go`、`app.go`、`frontend/src/domain/contextResolver.ts`、`runScope.ts`、`useAppStore.ts`、`ChatDrawer.tsx`、既存 F2〜F5 unit / E2E files、`mise.toml`。
- Actions: one-shot structured suggestion、allowlist validation、scope / revision guard、fake LLM、既存 action dispatcher、Playwright harness を再利用できることを read-only inspection で確認した。
- Decision and concise rationale: 新規 dependency / external API の adoption は不要。既存 LLM `GenerateText` と F5 JSON parser pattern、F1 run correlation、F2〜F5 store action を組み合わせる。project 固有 seam のため新規 topic cheatsheet は作成しない。
- Alternatives rejected or deferred: Agent loop 内の新しい汎用 planner、workflow library、新規 state machine dependency。
- Artifacts updated: `91_worklog.md`。再利用可能な domain knowledge は Step 3 で既存 cheatsheet へ反映済み。
- Open questions / risks: sync backend call は物理 cancel できないため、core は local cancel + late-result no-op とし、必要性があれば transport cancel を後続検討する。
- Handoff to next step: verifiable REQ / NFR と Core E2E scenario を作成する。

## WL-006 — Step 5: Requirements

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: orchestration core を実装・受入可能な REQ / NFR と価値 Gate に変換する。
- Sources and checks: `10_claim.md`、`20_app_requirement.md`、F1〜F5 accepted requirement、current resolver / action / proposal / E2E contract。
- Actions: `30_requirement.md` に REQ-01〜21、NFR-01〜06、F6-01〜05 Core E2E、4課題の E4 protocol を作成した。
- Decision and concise rationale: suggestion と実行を別 requirement にし、mapping / eligibility / stale / no-op / persistence / data boundary を自動検証する。価値 Gate は proposal layer と route family を分け、少なくとも2 route familyのGoを必要とする。
- Alternatives rejected or deferred: Tool call 数・採用率による機械的 Go、単一 happy path だけの E2E、全 route を一括判定する Gate。
- Artifacts updated: `30_requirement.md`。
- Open questions / risks: Human Gate で target subset 編集量と `clarify` card の自然さを重点確認する。
- Handoff to next step: DTO、validator、dispatcher、UI lifecycle、WP と traceability を Implementation Specification に落とす。

## WL-007 — Step 6: Implementation Specification

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: REQ を実装可能な contract、state、dispatch、UI、test、WP へ落とす。
- Sources and checks: `30_requirement.md`、F5 one-shot parser / fixture pattern、F1 resolver / run scope、F2/F3/F5 store action、ChatDrawer / ChatInput、E2E harness。
- Actions: `40_specification.md` に architecture、Go/TS DTO、fixed mapping、focus resolution、prompt、backend API、runtime store、exact-target dispatch、UI / lifecycle / error / privacy、traceability、WP-0〜5 を定義した。
- Decision and concise rationale: LLM は kind / targets / explanation だけを提案し、role / AL / route / control は code mapping が付与する。clarify は採用時だけ Dialogue へ追加し、質問と回答の連続性を保つ。
- Alternatives rejected or deferred: LLM に executor / AL を自由選択させること、自然文 parse、invalid item の部分採用、planner への画像 pixel / full body 送信。
- Artifacts updated: `40_specification.md`、`30_requirement.md`（provider call上限とclarify選択境界を明確化）。
- Open questions / risks: Go / TS mapping drift は fixture test で検出する。backend物理cancelはcore対象外でlocal late-result no-opとする。
- Handoff to next step: review decisions、risk、deferred候補、status acceptance table、human review packet を同期する。

## WL-008 — Step 7: Review Notes and Status

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: 採用判断、却下案、将来候補、全 REQ の実装・受入状態を一箇所ずつ確定する。
- Sources and checks: Claim / App Requirements / Requirements / Specification、`fm-dev-process` status rules、F2〜F5 approval boundaries。
- Actions: `50_review_notes.md` に13件の設計論点とdispositionを記録し、`90_status.md` をREQ-01〜21 / NFR-01〜06、WP、plan checks、Gate matrixで初期化した。
- Decision and concise rationale: proposal layerとroute familyを分離して判定し、実装sessionの自己受入を禁止する。future / rejectedをcurrent scopeから分離した。
- Alternatives rejected or deferred: child action成功だけでF6 done、invalid output部分採用、proposal永続化、free-form executor編集。
- Artifacts updated: `50_review_notes.md`、`90_status.md`。
- Open questions / risks: E4でmanual entry、clarify、target editing、Cluster thresholdを観察する。
- Handoff to next step: compact review packetで決定・最大risk・traceability・Go条件を人間レビュー可能にする。

## WL-009 — Step 8: Reviewer Material

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: 実装前レビューでcore境界とGo条件を短時間で確認できる資料を作る。
- Sources and checks: `10_claim.md`〜`50_review_notes.md`、`90_status.md`、review packet template。
- Actions: `60_review_packet.md` に決定事項、最大risk、Open Questions、Mermaid architecture / sequence、traceability、E2E、Human Gate checklistを作成した。
- Decision and concise rationale: single-reviewer向けdefault packetを採用し、split Marp / HTML boardは不要とした。
- Alternatives rejected or deferred: 詳細仕様の複製、multi-lane review board。
- Artifacts updated: `60_review_packet.md`、`91_worklog.md`。
- Open questions / risks: Planning recommendationはbounded core Go。AL-3 / image / multi-step / auto-trigger追加はplan amendを要する。
- Handoff to next step: document cross-check、REQ/WP/status整合、jj diffを検証してimplementation handoffを確定する。

## WL-010 — Planning cross-check and implementation handoff

- Date: 2026-08-16
- Actor/session: Codex planning session
- Purpose: implementation handoff 前に plan documents と status の構造的整合を確認する。
- Sources and checks: plan全Markdown、`docs/plan_index.md`、`jj status` / `jj diff --stat`、PowerShellによるREQ/NFR ID比較・重複検査・local link検査。
- Actions: Requirements と Status の27 IDs一致、重複なし、Step 0〜8 worklog coverage、review packet 129 lines、local link解決、plan/index state `planned` 一致を確認した。Plan Checks の planning artifact state を `implemented` へ整えた。
- Decision and concise rationale: bounded core plan は implementation handoff 可能。製品codeは未変更のためbuild/testは未実行で、WP-0 / WP-5 の必須evidenceとして残す。
- Alternatives rejected or deferred: documentation-only turnで製品testをpass evidenceとして先取りすること。
- Artifacts updated: `90_status.md`、`91_worklog.md`。
- Open questions / risks: 実装後のseparate acceptanceとREQ-21 human Gateは未実施。
- Handoff to next step: WP-0から実装し、実装sessionはstatusのImplementer state / Evidenceのみ更新する。
