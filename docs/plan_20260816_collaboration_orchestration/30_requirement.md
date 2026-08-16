# Requirements — F6 Collaboration Orchestration Core

## Scope

F6 core は、明示的な `次の一手` 呼出しから、context-aware な Action Proposal を 1〜3 件作り、人間が確認・軽微修正・拒否・単一実行して、F2 / F3 / F5 の既存 result surface へ到達する vertical slice とする。

初期 action allowlist は `clarify`、`compare`、`counterpoint`、`web_search`、`suggest_relations`、`suggest_clusters` である。F4 画像生成、AL-3、multi-step chaining、新規 transform capability は含めない。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | `次の一手` は ChatDrawer の AI Partner 面にある明示操作からのみ開始する。起動、Node 作成、selection / Focus 変更だけでは suggestion や LLM call を開始しない。処理中は progress と local cancel を表示する。 | UI/store test、Core E2E F6-01/F6-05 | E1 |
| REQ-02 | Orchestration Context は F1 Context Resolver を使い、明示 Focus text/target、active Dialogue の直近 bounded history、明示 selection / added Current Canvas context、accepted Relation、active Generated View hint を区別して request に入れる。本文は resolver allowlist 内の Text-bearing Node の label / summary / bounded excerpt、Image は metadata のみに限定し、画像 pixel、別 Canvas body、excluded Node、未採用 Proposal / Packet を送らない。 | Resolver/request payload test、Core E2E F6-01/F6-05 | E1 |
| REQ-03 | suggestion 前に deterministic capability eligibility を計算する。`compare` は同一 Current Canvas の明示対象 2 件以上、`counterpoint` は 1 件以上、Relation / Cluster は Folder 以外 2 件以上、`web_search` は非空の Focus / Dialogue / editable query seed がある場合だけ候補にする。利用不能 action は LLM の capability catalog に渡さず、返却されても拒否する。`clarify` は常に利用可能とする。 | Domain/backend validator fixture、F6-01/F6-05 | E1 |
| REQ-04 | `SuggestNextActions` は既存 LLM を最大一回だけ呼ぶ one-shot structured request とし、Agent loop、Tool call、Web search、image generation、document mutation、Dialogue message 追加を行わない。usable context がない場合は provider call なしの deterministic `clarify` を許可する。出力は推奨順の 1〜3 件で、重複 action kind を持たない。 | Backend call-count / port test、F6-01/F6-05 | E1 |
| REQ-05 | Action item は `id`、`kind`、`role`、`actionLevel`、`route`、`targetNodeIds`、`title`、`reason`、`expectedResult`、`control` と、必要時の `query` または `question` を持つ。全項目は trim / length / enum / target membership / arity を検証し、unknown kind、scope 外 target、role / AL / route 不一致、空 title/reason/result、4件以上、全 item 不正は proposal set 全体を no-op error にする。部分的に不正な LLM 出力を黙って採用しない。 | Go DTO/parser/validation test、frontend normalization test | E1 |
| REQ-06 | role / AL / route は kind ごとの固定 mapping とする。`clarify=質問者/AL-0/dialogue`、`compare=比較者/AL-2/direct-transform`、`counterpoint=批評者/AL-2/direct-transform`、`web_search=調査者/AL-2/direct-web-search`、`suggest_relations=整理者/AL-1/direct-relation-suggestion`、`suggest_clusters=整理者/AL-1/direct-cluster-suggestion` とし、LLM や利用者が任意 executor / model / provider を指定しない。 | Mapping unit test、DTO rejection test | E1 |
| REQ-07 | Action Proposal panel は 1〜3 cards を推奨順に表示し、role、AL、対象 label、期待結果、理由、`変更なし / Proposal止まり / undo可` 等の document effect、実行後の取消・拒否方法を平易に示す。内部 route 名は補助表示に留め、executor 選択を要求しない。 | Component assertions、Core E2E F6-01、human UX review | E1 / E4 |
| REQ-08 | 利用者は proposal set の Close / 再提案、card の拒否、実行を行える。`web_search` は query を編集でき、Node action は proposal 作成時の eligible target 内で subset を編集できる。編集後も kind ごとの arity と scope を満たす必要がある。action kind / AL / route の自由編集 UI は設けない。 | Domain/UI test、F6-01〜04 | E1 |
| REQ-09 | `clarify` は不足条件を一つの具体的な question として示し、document を変更しない。suggestion 表示だけでは Dialogue を増やさず、利用者が `この質問に答える` を選んだ時だけ question を assistant Dialogue message として追加して ChatInput へ focus する。Focus や対象が不十分な時に、実行不能 action や汎用メニュー一覧で埋めない。 | Fixture / component test、F6-05、human review | E1 / E4 |
| REQ-10 | `compare` / `counterpoint` の実行は card に表示した exact target IDs と current explicit selection の一致を確認後、既存 Direct Transform を一度だけ呼ぶ。既存の non-destructive derived Node、provenance、atomic apply、receipt、single undo、stale guard を維持し、orchestration 専用 mutation path を作らない。 | Dispatcher/store integration test、F6-02 | E1 |
| REQ-11 | `web_search` の実行は編集済み非空 query を既存 `runWebSearch(..., {entryRoute:"direct-action"})` へ一度だけ渡す。結果は既存 Context Packet panel に表示し、検索だけでは document を変更しない。provider 未設定・timeout・失敗時に別 provider / Agent route へ暗黙 failover しない。 | Dispatcher/fake provider test、F6-03 | E1 |
| REQ-12 | `suggest_relations` / `suggest_clusters` の実行は card の exact target IDs を既存 direct suggestion action へ一度だけ渡す。結果は既存 Batch Relation / Cluster View Proposal とし、orchestration card の実行を Relation / View の Accept とみなさない。既存 Modify / Accept / Reject / Stop / undo を維持する。 | Dispatcher/proposal integration test、F6-04 | E1 |
| REQ-13 | 一つの Action Proposal から開始できる child action は一つだけとし、double click / Enter repeat / concurrent card click を idempotent guard で拒否する。child action の結果を見て別 action を自動開始せず、次の orchestration は新しい明示呼出しとする。 | Concurrency/UI test、F6-02〜04 | E1 |
| REQ-14 | dispatch 後の主結果は既存 Direct receipt、Context Packet、Batch Relation Proposal、Cluster View Proposal とする。Action Proposal panel は dispatched kind / target / result surface を短く示せるが、長文 assistant answer、raw log、独自成果コピーを作らない。 | Store/UI integration test、F6-02〜04、human review | E1 / E4 |
| REQ-15 | Proposal set は `pending / ready / cancelled / stale / error / dispatched` を区別する runtime-only state とし、Workspace JSON、Dialogue persistence、Export に含めない。Close / 再提案 / New / Discard / Load / Canvas navigation で破棄する。accepted child result の寿命は F2 / F3 / F5 の既存契約に従う。 | Lifecycle/persistence test、F6-05 | E1 |
| REQ-16 | suggestion request は requestId、workspaceId、canvasId、runtimeGeneration、scopeEpoch、contextDigest、対象 sourceRevisions を保持する。結果到着時と dispatch 直前に再検証し、selection / Focus / scope / source revision 変更、New / Discard / Load / navigation、local cancel 後の遅着 result は stale / cancelled として action を開始しない。backend call を物理 cancel できない場合も late result は no-op にする。 | Concurrent/stale/cancel test、F6-05 | E1 |
| REQ-17 | LLM timeout、provider error、不正 JSON、空提案、unknown action、target / mapping / arity 不正は document、active Packet、active View、pending feature Proposal を変更せず、再提案、対象変更、通常 Dialogue のいずれかを次操作として示す。validation failure を一般 action list へ暗黙 fallback しない。 | Backend/frontend fault test、F6-05 | E1 |
| REQ-18 | `次の一手`、Cancel、Close、再提案、card、対象 selection、query 編集、実行、拒否には accessible name と keyboard 導線を設ける。progress / error / stale / dispatched は適切な live region で通知し、既存 ChatInput、Context Menu、PromptBar、Proposal panel の操作を妨げない。 | Browser assertions、F6-01/F6-05、human UX review | E1 / E4 |
| REQ-19 | Core E2E は fake LLM / fake Web Search と既存 bridge だけを使い、実 API key / 外部 network を要求しない。F6-01〜F6-05 を追加し、F1〜F5 E2E を回帰実行する。fixture は action ranking、invalid response、delay / cancel、child dispatch を決定的に制御できる。 | Harness inspection、`mise run e2e` | E1 |
| REQ-20 | plan-defined frontend / Go tests、Go vet、frontend / Wails build、Core E2E が全て pass する。新規 F6 frontend test は既存 test entry / config / script に明示登録し、`mise run test` の標準出力で実行を確認する。 | `mise run test`、`mise exec -- go vet ./...`、`mise exec -- npm --prefix frontend run build`、`mise run build`、`mise run e2e` | E1 |
| REQ-21 | 別受入 session / human review で、(a) Contextual Proposal layer、(b) Transform route、(c) Research route、(d) Structure route を独立に Go / Hold / Stop 判定する。Contextual Proposal layer の Go と、3 route family 中 2 つ以上の Go、かつ Context / Control に Stop がないことを F6 core Go の必要条件とする。採用率、Tool call 数、介入回数の少なさは単独の Go 条件にしない。 | Plan-defined task-based E4 review | E4 |
| REQ-22 | 明示 Focus・selection・最新 user intent がなくても、Current Canvas に利用可能な Text-bearing Node がある場合は、その bounded canvas context を使って助言候補を生成する。Current Canvas に材料が本当にない場合だけ deterministic `clarify` とする。canvas-wide context から exact target が確定できない action は実行可能として提案せず、必要なら質問へ落とす。 | Resolver/request/backend tests、Core E2E F6-06、human review | E1 / E4 |
| REQ-23 | F6 導入後も通常 Chat の agent tool loop は維持される。Node について意見を求め、`read_canvas_node` が成功した場合、その tool result を含む後続 provider request が `400 INVALID_ARGUMENT` にならず、assistant response または既存の actionable error として完結する。 | Backend request-shape regression test、Core E2E F6-07、実 API smoke | E1 / E2 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| NFR-01 | 新規 npm package、Go module、external API を追加しない。既存 Wails binding、LLMPort、JSON parse pattern、Zustand、Context Resolver、F2 / F3 / F5 actions、Playwright harness を再利用する。 | `package.json` / `go.mod` / `mise.toml` diff inspection | E3 |
| NFR-02 | suggestion 生成は read-only である。child mutation は既存 command transaction だけを使用し、error / cancel / stale 時に document、history、selection、active Packet / View / feature Proposal を部分更新しない。 | Fault injection / state snapshot test | E1 |
| NFR-03 | Planner payload は API key、provider secret、画像 data URL / pixel、Workspace 外 body、raw tool log を含めない。Dialogue history は既存 `boundedDialogueHistory` を使い、Node は label / summary / bounded excerpt と revision だけを送る。 | Payload capture / persistence inspection | E1 / E3 |
| NFR-04 | proposal は最大3件、planner 対象は最大40 Node とし、長い本文全文ではなく bounded hint を使う。上限超過は対象絞り込みを促し、無断 truncate で異なる scope を装わない。 | Limit/validation test | E1 |
| NFR-05 | Action Proposal set は runtime-only であり、Workspace file format V1.3 と既存 migration を変更しない。proposal quality 評価のための telemetry、raw prompt、Node本文、操作 event 全量を保存しない。 | Persistence roundtrip / code inspection | E1 / E3 |
| NFR-06 | one-shot suggestion と child action は同一時刻に重複開始しない。UI は pending 中の再送を抑止し、結果 correlation を requestId で一意にする。 | Concurrency test | E1 |

## Constraints

- `fm-dev-process` Full tier、Core E2E in scope、worklog enabled。
- repository operation は `.jj` のため `jj` を利用する。
- Go / npm / Wails は `mise` を介して実行する。
- F1〜F5 の accepted contract と Workspace V1.3 persistence を維持する。
- user-configured LLM system prompt に依存せず、orchestration 用構造化 prompt / validator で契約を固定する。
- 実装 session は `90_status.md` の implementer state / evidence だけを更新し、Acceptance を自己記入しない。

## Verification / Completion Conditions

- Go tests: `mise exec -- go test -count=1 ./...`
- Go vet: `mise exec -- go vet ./...`
- Frontend logic/domain: `mise exec -- npm --prefix frontend run test`
- Frontend build: `mise exec -- npm --prefix frontend run build`
- Wails production build: `mise run build`
- Core E2E: `mise run e2e`
- Core E2E in scope: yes
- Core E2E REQ IDs: REQ-01〜20、REQ-22〜23
- Human task-based Gate: REQ-21

## Core E2E Scope

### F6-01 — Manual suggestion and inspectability

2件以上の Text-bearing Node を選択し、ChatDrawer の `次の一手` を明示実行する。1〜3 cards の順序、role / AL / targets / reason / expected result / effect / control を確認し、suggestion 表示前に Tool、検索、document mutation、Dialogue message が起きていないことを確認する。target subset 編集、card reject、再提案も確認する。

### F6-02 — Transform dispatch, exact target, stale and undo

`compare` または `counterpoint` card を実行し、表示 target と一致する既存 Direct Transform が一度だけ動き、derived Node / receipt / provenance / one undo が成立することを確認する。source edit / selection change / double dispatch 後は no-op stale または idempotent rejection とする。

### F6-03 — Research dispatch and Context Packet

`web_search` card の query を修正して実行し、fake provider が一度だけ呼ばれ、既存 Context Packet panel へ結果が戻ることを確認する。検索時点で document / Dialogue は増えず、既存 Promote / dismiss が機能する。

### F6-04 — Structure dispatch and separate acceptance

`suggest_relations` / `suggest_clusters` card から既存 Direct Proposal を生成する。orchestration 実行だけでは Relation / View が確定せず、既存 Modify / Accept / Reject と atomic undo / View lifecycle が維持されることを確認する。

### F6-05 — Clarify, lifecycle, cancel, errors, accessibility, regression

Focus / 対象不足では `clarify` 一問だけを示す。delay 中 local cancel、late result、invalid JSON、unknown kind、4件超過、scope/navigation/New/Load/Discard stale、Save非含入、主要 control の accessible name / keyboard、既存 Chat / PromptBar / F1〜F5 導線の回帰を確認する。

### F6-06 — Canvas-wide suggestion and real-canvas validation

明示 Focus / selection がないが Current Canvas に Text-bearing Node がある状態では、canvas-wide bounded context から `次の一手` が提案されることを確認する。1件選択、2件選択、再提案を `canvas-2.json` 相当の複数URL・日本語本文を含むfixtureで反復し、valid scopeで `next-actions-failed` にならないこと、invalid provider response時の回復文言が orchestration 向けであることを確認する。

### F6-07 — Existing Chat node-tool regression

通常 Chat で Node への意見を求め、`read_canvas_node` の tool call/result 後に provider continuation が成功することを確認する。providerへ送る message / tool-call correlation が対象APIの契約を満たし、`400 INVALID_ARGUMENT` を回帰させない。

## Human Value Review Protocol

次の4課題を、通常の Context Menu / Dialogue が利用可能な状態で実施する。

1. **比較課題**: 相反する2案から判断軸と弱点を得る。
2. **外部根拠課題**: Current Canvas の主張について最新根拠・対立を取得する。
3. **構造課題**: 4件以上の断片から Relation または Cluster の有用な見方を得る。
4. **曖昧課題**: Focus / 対象が不足する状態で、過剰実行せず必要な質問へ進む。

各課題で次を記録する。

- Discovery: 新しい論点、比較軸、反証、Relation、まとまりが増えたか。
- Context / Control: 読込・対象・変更有無・route・停止 / 取消を予測できたか。
- Collaboration: role / AL が局面に合い、提案を修正・拒否しても流れが破綻しないか。
- Result return: 結果が Workspace 材料として次の判断に使えたか。
- Friction: 入口探索、copy & paste は減ったか。card 読解・修正・待機・掃除が増えすぎないか。
- Return intent: 同種課題で再び `次の一手` を呼びたいか。

## Out of Scope

- `summarize` / `reframe` / image generation の F6 action 化。
- AL-3、Specialist subagent、Delegated Session UI、Repository / multi-search orchestration。
- multi-step plan、automatic chaining、parallel action、self-review loop。
- automatic trigger、background monitoring、proactive notification。
- action kind / AL / route / provider / model の自由編集 cockpit。
- proposal history / raw log / telemetry / long-term learning / saved recommendation。
- Saved Workspace Recall、MCP、AnyType 等の external app connector。
- Workspace V1.4 migration、Action Proposal の Save / Load。

## Acceptance Criteria

- 全 REQ / NFR が `90_status.md` に同じ ID で存在する。
- E1 は plan-defined command または fixture / Core E2E で再実行可能である。
- E3 は dependency / persistence / source pointer を acceptance session が検査できる。
- REQ-21 は実装 session と別の人間 / acceptance session が route family ごとに判定する。
- F6 core `done` は全 automated row の pass、Contextual Proposal layer Go、3 route family 中2つ以上の Go、Context / Control に Stop なしを必要とする。
