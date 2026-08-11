# Requirements

## Scope

F1 の Workspace contract を利用し、Current Canvas 内の Text-bearing Node を対象に、非破壊の派生変形と型付き Relation を共同編集する。F3 以降の外部 Context、F4 の multimodal、F5 の Generated Structure は含めない。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | Current Canvas の明示選択から、1 Node 以上の text-bearing source と operation (`summarize` / `compare` / `counterpoint`) を解決する。別 Canvas の本文、excluded Node、未採用 Candidate は暗黙に入力しない。 | Resolver / request fixture test、Core E2E F2-01 | E1 |
| REQ-02 | `summarize` は1個以上、`compare` は2個以上、`counterpoint` は1個以上の source を受け取り、入力本文と scope を構造化 request にする。不正な個数・欠損・異なる scope は変更せずエラーにする。 | Domain validation / backend DTO test | E1 |
| REQ-03 | AI または明示 Direct Action の transform は元 Node を直接変更せず、同じ Current Canvas に一つの派生 Text Node を作成する。派生 Node は source IDs、operation、生成時刻、provider / model（取得できる場合）、元 revision を provenance に保持する。 | Atomic command / persistence test、Core E2E F2-01/F2-02 | E1 |
| REQ-04 | Transform Proposal は `proposed → accepted / modified / rejected / cancelled / stale / conflict / applied` の状態を持ち、source、operation、output preview、placement、reason、base revisions、provenance、Proposal ID を表示してから適用する。Reject / Stop は Workspace を変更しない。 | Proposal state test、Core E2E F2-02 | E1 |
| REQ-05 | Accept / Modify による派生 Node の作成と `derived` Relation の追加は atomic である。Node だけ、Relation だけ、または partial mutation を残さず、一つの undo で元へ戻せる。 | Fault injection / reducer history test、Core E2E F2-02 | E1 |
| REQ-06 | Relation は `source`、`derived`、`supports`、`opposes`、`similar` の型、source / target の方向、reason、provenance、status を持つ。自己 Relation、欠損 endpoint、現在の scope 外への暗黙作成を拒否する。 | Invariant / command test | E1 |
| REQ-07 | ユーザーは2 Node 以上を対象に Relation を明示作成でき、型変更、方向反転、reason 編集、Reject / Remove を行える。AI Proposal は同じ Relation model を使い、ユーザーが採用・変更・拒否できる。 | Relation reducer/UI test、Core E2E F2-03 | E1 |
| REQ-08 | accepted Relation は React Flow edge として方向・型を確認できる。cross-canvas Relation は F1 の down-folder / up-boundary aggregate を維持し、別 Node の複製や hidden body の注入を行わない。 | Projection test、Core E2E F2-03 | E1 |
| REQ-09 | accepted 派生 Node / Relation は `Context Resolver` の active context / Relation target / body allowlist に反映され、次の Dialogue / Direct Action が由来と関係型を参照できる。unaccepted Proposal の本文・Relation は含めない。 | Resolver payload test、Core E2E F2-04 | E1 |
| REQ-10 | Proposal 適用前に source revision、Workspace ID、Current Canvas、runtime generation、scope epoch、active run epoch を検証する。source の編集、New / Discard、Load、Canvas navigation、Stop 後の遅着結果は stale / conflict / cancelled として変更しない。 | Concurrent/stale integration test、Core E2E F2-02/F2-04 | E1 |
| REQ-11 | Save / Load は F1 V1.3 の既存 file を読み込み、accepted 派生 Node、Relation、provenance、optional reason を非破壊に roundtrip する。V1.0〜V1.2 の既存 migration を壊さず、破損時は現在 state を保持する。 | Version fixture / roundtrip / failure test | E1 |
| REQ-12 | Transform / Relation の操作結果、失敗理由、次の操作（retry、修正、reject、undo）をユーザーが理解できる。主要操作は accessible name / keyboard 操作を持つ。 | Browser assertions + separate UX review | E1 / E4 |
| REQ-13 | `summarize` / `compare` / `counterpoint` の AI request は既存 Context allowlist、LLM timeout、run/tool correlation を使い、外部 API key / network を Core E2E に要求しない。 | Backend mock provider / harness inspection | E1 |
| REQ-14 | F2 の plan-defined build、typecheck、unit/domain、Go、vet、Core E2E が全て pass する。Core E2E は F2-01〜F2-05 を含む。 | `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 |
| REQ-15 | Current Canvas で人間が変更した selected / active Node の position を、次の Context request に source ID と結び付いた `spatialHints` として反映する。配置だけから Relation、group、優先度、因果を自動確定せず、別 Canvas の position は暗黙に含めない。 | Resolver payload / movement test、Core E2E F2-04 | E1 |
| REQ-16 | Dialogue / Agent の transform は事前 Proposal と明示 decision を必要とする。明示 Direct Action は request 自体を承認として扱い、追加 Proposal / Dialogue 履歴を作らず、同じ scope validation、atomic apply、provenance、stale guard、undo を使う。 | Entry-route integration test、Core E2E F2-05 | E1 |
| REQ-17 | Dialogue / Agent Proposal は適用前に source と output の比較表示を持ち、Direct Action は適用後に change summary / source-output diff と undo 導線を持つ。複数 source の場合は source ごとの識別を失わない。 | Browser assertions、Core E2E F2-01/F2-05、human UX review | E1 / E4 |
| REQ-18 | 実課題による別受入 session / human review で、(a) 新しい論点・比較軸・反証・Relation のいずれかが得られたか、(b) Modify / Relation 編集が共同理解を進めたか、(c) 元状態・由来・取消方法を説明できるか、(d) 掃除・確認・誤変形訂正の負担が便益を上回らないかを記録し、F2 core Gate を Go / Hold / Stop 判定する。件数 telemetry や定型終了アンケートは追加しない。 | Plan-defined task-based review note | E4 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| NFR-01 | 新規 runtime / UI dependency を追加せず、F1 の Wails、React、Zustand、React Flow、既存 LLM contract を利用する。 | `package.json` / `go.mod` diff inspection | E3 |
| NFR-02 | Transform / Relation の適用は current Workspace の単一 command transaction とし、失敗時に document、history cursor、content revision、selection を部分更新しない。 | Fault injection / reducer test | E1 |
| NFR-03 | 外部へ送る本文は Context Resolver の body allowlist に限定し、Proposal preview と tool request の source IDs / revisions が一致する。 | Payload assertion / Go DTO test | E1 |
| NFR-04 | accepted Relation と派生 Node の provenance は、元 Node を変更せず後から追跡できる。 | Persistence and implementation inspection | E1 / E3 |

## Constraints

- 開発・検証コマンドは `mise` 経由で実行する。
- F1 の V1.3 と current docs の意味を変更しない。V1.4 への変更が必要になった場合は implementation 前に plan を amend する。
- F2 の対象は Text-bearing Node。Image Node は metadata / Relation の endpoint としては既存契約を尊重するが、本文変形の入力・出力にはしない。
- Proposal は AI が確定結果を直接書き込む経路にしない。明示 Direct Action の場合も、出力が新規 Node / Relation を作る時は同じ atomic apply API を通す。
- Direct Action は追加の Agent 判断、問い返し、Dialogue への自動昇格を行わない。ユーザーの明示 action を承認とし、失敗時は no-op、成功時は結果比較と undo を提供する。
- Node position は共同文脈へ返す観測情報であり、位置だけから意味的 Relation や恒久構造を自動生成しない。

## Compatibility

- V1.0〜V1.2 は F1 の adapter で load 可能であること。
- V1.3 の `relations` は既存必須フィールドを維持し、F2 の `reason` / transform metadata は optional field または `extensions` として欠落時に既定値で読めること。
- 既存 `apply_edit`、Artifact tool、画像生成、Chat session の F1 挙動を壊さないこと。

## Verification / Completion Conditions

- Build: `mise run build` が exit 0。
- Typecheck: Wails build 内の `npm run build` が exit 0。必要に応じ `mise exec -- npm --prefix frontend run build` を単独実行。
- Unit / domain: `mise run test` が exit 0。F2 transform / relation / stale / roundtrip / failure test を含む。
- Backend static: `mise exec -- go vet ./...` が exit 0。
- Core E2E in scope: yes。
- Core E2E IDs: F2-01 transform request / preview / diff、F2-02 accept / modify / reject / Stop / undo、F2-03 typed Relation、F2-04 context continuity / spatial feedback / stale / persistence、F2-05 Direct Action separation / post-apply diff / undo。

## Out of Scope

- F2 core slice 外の extract / split / merge / reframe / variant / card conversion。F2 milestone から消去せず、core 実利用後に各項目を採用・延期・棄却する。
- Web / Repository / AnyType / MCP / Specialist subagent。
- Image-aware transform、Generated View、automatic layout、Saved Workspace Recall。
- 自動 Accept、全履歴 Memory、background retry、telemetry、性能 SLO の新設。

## Acceptance Criteria

- 各 REQ に verification method と evidence class が設定されている。
- 実装者は `90_status.md` の implementer state / evidence のみ更新し、acceptance は別 session / human が実施する。
- F2 Gate は、元状態・由来・Relation の意味・取消方法が理解でき、新しい論点・比較軸・反証を生み、掃除・確認・訂正の負担が便益を上回らないことを確認して Go とする。
- この plan の `done` は F2 core slice の受理であり、ロードマップ全体の F-2 milestone closure を意味しない。
