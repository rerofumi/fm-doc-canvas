# Requirements

## Scope

F1 / F2 の Workspace 契約（Current Canvas scope、Proposal、typed Relation、`createSubCanvas`、Context Resolver）を利用し、ロードマップ F-5B のうち **Relation suggestion（複数素材への拡張）** と **Generated View の Cluster View**、および **Cluster → SubCanvas 変換** を core slice として実装する。Library View と Layout suggestion / auto-layout はこの plan の対象外とし、core 実利用後に独立判定する。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | Relation batch suggestion の対象は Current Canvas の明示選択（2 Node 以上）または明示的な Current Canvas 全体とする。別 Canvas、excluded Node、未採用 Proposal、Folder Node は暗黙に対象へ含めない。Text-bearing Node の本文は Context Resolver の body allowlist、Image Node は F4 Vision allowlist（最大3画像、明示選択優先）に限定する。Vision非対応またはasset取得失敗時は alt / prompt / provenance の metadata-only に縮退し、その事実を proposal preview に示す。 | Resolver / request fixture / Vision fallback test、Core E2E F5-01 | E1 |
| REQ-02 | Direct Action の `SuggestRelations` は one-shot の構造化 LLM 呼び出しで、Agent loop・問い返し・Dialogue 履歴の追加を行わず、Relation 候補セットを一つの Batch Relation Proposal として返す。proposal は `source_node_id` / `target_node_id` / `kind` / `reason` / `direction` を持ち、self relation・欠損 endpoint・kind 不正・既存 accepted Relation との重複・上限（8件）超えは変更なしエラーにする。 | Backend DTO / validation test、Core E2E F5-01 | E1 |
| REQ-03 | Dialogue の Agent tool `propose_relation_batch` は、既存 tool と同じ read-before-propose・scope / stale 検証・Proposal 経路を使い、1回の tool call で複数 Relation を提案できる。既存 pairwise `propose_relation` の挙動は維持する。 | Agent tool test、Core E2E F5-02 | E1 |
| REQ-04 | Batch Relation Proposal は項目ごとに kind / direction / reason / 対象 Node を表示し、項目の除外（modify）、Accept（選択した項目の一括適用）、Reject、Stop を提供する。Accept は単一 command transaction で、適用された全 Relation を一つの undo で取り消せる。部分適用を残さない。 | Proposal / reducer test、Core E2E F5-01 | E1 |
| REQ-05 | Batch 適用時の invariant 検証（self / missing endpoint / duplicate / cross-scope）は既存 F2 Relation 契約と同じとし、検証失敗は batch 全体を no-op にして理由を返す。適用された Relation は既存 `RelationRecord`（V1.3 スキーマ）で保存され、provenance に batch 由来（operation、provider / model、作成時刻）を持つ。 | Invariant / persistence test、Core E2E F5-01 | E1 |
| REQ-06 | Cluster View の対象は Current Canvas の Text-bearing / Image Node とし、Folder Node は member にしない。Text / Image の送信規則は REQ-01 と同じ allowlist / Vision fallback 契約を使う。提案は view label、2 以上の cluster（各 cluster は label、任意 reason、1 以上の member Node）、ungrouped Node 一覧を持つ。同一 Node を複数 cluster へ割り当てない。node IDs は request snapshot に存在しなければならず、上限（8 clusters、対象 40 Nodes）を超えない。 | Backend DTO / validation / Vision fallback test、Core E2E F5-02 | E1 |
| REQ-07 | Cluster View は Direct Action `SuggestClusters`（one-shot、Dialogue 非追加）と Dialogue tool `propose_cluster_view`（Proposal 経路）の両方から同じ Proposal 契約で作成できる。Proposal は cluster 名・理由・member を preview し、rename / 既存 cluster 間の member 移動・除外 / cluster 削除の modify、Accept / Reject / Stop を提供する。Accept まで document を変更しない。core は D-08 共同編集能力の部分実装とし、新規 cluster 作成、split / merge、ungrouped Node の手動追加は後続候補とする。 | Proposal test、Core E2E F5-02/03 | E1 |
| REQ-08 | accepted Cluster View は runtime-only の active Generated View になり、Current Canvas 上に cluster ごとの非破壊 overlay（hull / label / 色）を表示する。Node 本文、Canvas ownership、確定 Relation、document 上の Node position を変更しない。overlay は member Node の現在 position に追従する。View banner から Close でき、閉じると元の Canvas 表示へ戻る。 | Renderer / projection test、Core E2E F5-03 | E1 |
| REQ-09 | active Generated View は Save file へ含めない。Save / Load、New、Discard、Canvas navigation の後は active View を破棄する。同時に active な Generated View は一つだけとし、新しい Accept は旧 View を閉じる。Stop は in-flight request / 未確定 Proposal を stale / cancelled にするが、既に Accept 済みの active View は維持する。member Node が削除された cluster は縮退し（member 除去、空 cluster 除去）、全 cluster が消えたら View を閉じる。 | Persistence / lifecycle / Stop separation test、Core E2E F5-04 | E1 |
| REQ-10 | active View の各 cluster は、人間の明示操作だけで SubCanvas へ変換できる。変換前に member 一覧、編集可能な Folder label、移動先 Current Canvas、境界 Relation が既存 boundary aggregate で維持される旨を preview し、既存 `createSubCanvas` atomic command と View snapshot を一つの composite transaction として適用する。変換成功時は cluster を View から除去するが、1回の undo で Node / Folder / Relation と変換前の active View / cluster membership をともに復元する。最後の cluster 変換後に View を閉じた場合も同様に復元する。自動変換は行わない。 | Command / history / UI test、Core E2E F5-03 | E1 |
| REQ-11 | Relation batch / Cluster View の Direct request と Dialogue Proposal は、workspaceId / canvasId / runtimeGeneration / scopeEpoch / runEpoch / proposalId に加え、対象全Nodeの `sourceRevisions` を保持する。結果到着時とAccept / 変換時に、member Node の存在、Current Canvas 所属、revision一致を再確認する。Stop 後の遅着結果を含む不一致は no-op とし、理由を表示する。 | Concurrent / revision stale / Stop test、Core E2E F5-04 | E1 |
| REQ-12 | Context Resolver は active Generated View に含まれる request 対象 Node について、view label と cluster label / membership を `viewHints` として次 request に含める。`viewHints` は観測情報であり、確定 Relation や意味的 group を自動生成しない。View 未 active・別 Canvas・excluded Node は含めない。 | Resolver payload test、Core E2E F5-03 | E1 |
| REQ-13 | provider error、timeout、空結果、不正 JSON、上限超過は document / View を変更せず、retry・対象変更・閉じるが分かる actionable error にする。Direct Action は失敗時も Dialogue 履歴を作らない。 | Backend / frontend error test、Core E2E F5-05 | E1 |
| REQ-14 | system prompt は、`propose_relation_batch` / `propose_cluster_view` の使い分け（複数横断の提案のみ batch / view を使うこと）、提案は確定事実ではないこと、SubCanvas 化は人間の明示操作に限ることを Agent に指示する。Agent が View や SubCanvas を無断で確定しない。 | Prompt / agent test、F5-02 | E1 / E3 |
| REQ-15 | 主要操作（Suggest Relations / Suggest Clusters の起動、batch 項目の選択・採否、View banner、cluster chip、SubCanvas 変換 dialog、Close / undo）は accessible name と keyboard 導線を持ち、既存 Context Menu / PromptBar / Proposal UI を壊さない。 | Browser assertions + UX review、Core E2E F5-05 | E1 / E4 |
| REQ-16 | F5B の plan-defined build、typecheck、unit/domain、Go、vet、Core E2E が全て pass し、既存 F1〜F4 の unit / Core E2E を壊さない。Core E2E は F5-01〜F5-05 を含む。新規 `f5RelationBatch.test.ts` / `f5GeneratedView.test.ts` は既存 domain-test entry から import するか test config / script に明示登録し、`mise run test` で実行されたことを出力で確認する。 | `mise run test`（F5 test名の出力確認）、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 |
| REQ-17 | 実課題による別受入 session / human review で、(a) Relation batch suggestion と (b) Cluster View + SubCanvas 変換を**独立に** Go / Hold / Stop 判定する。確認項目は、関係・まとまりの発見に役立つか、誤提案の訂正 / 掃除負担が便益を上回らないか、View が一時的であることが理解できるか、SubCanvas 変換の preview / undo が信頼できるか。件数 telemetry や定型アンケートは追加しない。Layout suggestion は今回判定しない。 | Plan-defined task-based review note | E4 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| NFR-01 | 新規 runtime / UI npm package と新規 Go module を追加しない。React Flow overlay、Zustand、既存 LLM Chat Completions / tool-call 契約、既存 `createSubCanvas` を利用する。 | `package.json` / `go.mod` diff inspection | E3 |
| NFR-02 | Relation batch 適用と Cluster → SubCanvas 変換は単一 command / composite transaction とし、失敗時に document、history cursor、revision、selection、active View を部分更新しない。Cluster変換のundoはdocumentとactive Viewを同じhistory stepで復元する。 | Fault injection / reducer / undo test | E1 |
| NFR-03 | LLM へ送る本文・画像は Context Resolver / F4 Vision の allowlist に限定し、proposal の source IDs / revisions と snapshot が一致する。Vision非対応 / asset取得失敗時はmetadata-onlyへ安全に縮退する。API key や画像data URLをcanvas JSON / fixture / E2E evidenceに含めない。 | Payload / Vision fallback assertion / Go DTO test | E1 / E3 |
| NFR-04 | Generated View は Workspace document と Save file に書き込まない。V1.3 file format を変更せず、V1.0〜V1.3 の load / migration を壊さない。 | Persistence roundtrip / failure test | E1 |
| NFR-05 | View overlay の描画は client 側の bounding-box 計算に限定し、提案上限（8 relations / batch、8 clusters、40 Nodes / view request）を超える入力は UI と backend の両方で拒否する。 | Domain / backend validation test | E1 |

## Constraints

- 開発・検証コマンドは `mise` 経由で実行する。
- F1〜F4 の V1.3 意味を変更しない。Generated View を永続化する必要が生じた場合は、この plan では実施せず、version bump 含めて別途 amend / 別 plan とする。
- Direct Action（Suggest Relations / Suggest Clusters）は Agent loop・問い返し・Dialogue 履歴の追加を行わない。ただし出力は「提案」であり、Relation / View の確定には人間の明示 Accept を要する（D-03 / D-08）。Request-as-approval は提案生成までに限り、document 変更への自動承認にはしない。
- Cluster membership から意味的 Relation（supports / opposes 等）を自動生成しない。Relation は既存の明示 Relation 契約だけで確定する。
- Node position から cluster を自動生成せず、cluster overlay も position の意味を自動確定しない。
- 既存 pairwise `propose_relation`、Transform、web_search、generate_image、PromptBar の挙動を変更しない。

## Compatibility

- V1.0〜V1.3 の load / migration を壊さない。Generated View は runtime state のみで、Save file に新フィールドを加えない。
- Batch 経由で作成された Relation は既存 `RelationRecord` スキーマ（`reason` / `provenance` optional）で保存し、F2 の Relation UI / resolver / boundary aggregate と同じ契約で扱う。
- `createSubCanvas` の既存挙動（member 移動、Folder Node 作成、undo）を維持する。
- Dialogue tool 追加は既存 tool-call 契約と max 10 rounds の範囲内で行う。

## Verification / Completion Conditions

- Build: `mise run build` が exit 0。
- Typecheck: Wails build 内の `npm run build` が exit 0。必要に応じ `mise exec -- npm --prefix frontend run build`。
- Unit / domain: `mise run test` が exit 0。relation batch / cluster view / stale / persistence / resolver test を含む。
- Backend static: `mise exec -- go vet ./...` が exit 0。
- Core E2E in scope: yes。
- Core E2E IDs:
  - F5-01 Direct Relation batch suggestion → preview / modify / accept / undo。
  - F5-02 Dialogue `propose_relation_batch` / `propose_cluster_view` → Proposal lifecycle / stale。
  - F5-03 Cluster View overlay → view-local edit → viewHints → Cluster → SubCanvas 変換 / composite undo（active View 復元を含む）。
  - F5-04 ephemeral lifecycle（navigation / New / Load / member 削除縮退）+ Save / Load roundtrip + revision stale / Stop separation。
  - F5-05 error paths（timeout / invalid JSON / empty）+ accessibility / 既存導線 regression。
- 実 LLM の提案品質は Conditional / E4 であり、Core E2E の合格条件ではない（fake provider で契約を固定する）。

## Out of Scope

- Library View（評価軸で並べる Generated View）。
- Layout suggestion / auto-layout / cluster 内自動再配置。
- 複数 Generated View の同時保持、View 履歴、View の Save / Load 永続化。
- Cluster View を恒久 Knowledge Base や単一の正解分類へ固定する導線。
- Web / Repository / AnyType / MCP / Specialist subagent。
- Relation / View の自動 Accept、telemetry、性能 SLO の新設。

## Acceptance Criteria

- 各 REQ に verification method と evidence class が設定されている。
- 実装者は `90_status.md` の implementer state / evidence のみ更新し、acceptance は別 session / human が実施する。
- F-5B core Gate は、Relation batch と Cluster View を独立に判定し、発見（関係・対立・まとまり）に寄与し、訂正 / 掃除負担が便益を上回らないことをもって Go とする。
- この plan の `done` は F-5B core slice の受理であり、ロードマップ全体の F-5B milestone（Library View / Layout suggestion の disposition 込み）の完了を意味しない。
