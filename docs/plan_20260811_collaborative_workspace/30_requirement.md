# Requirements — Collaborative Workspace Foundation

## Scope

本計画は [05_roadmap.md](./05_roadmap.md) の D-12、D-02、F-1 を実装・受理する。製品方向は `collaborative_workspace` 全体だが、requirements の完了条件は foundation slice に限定する。

各 REQ は [90_status.md](./90_status.md) に同じ ID で一行ずつ持つ。実装セッションは implementer state と evidence だけを更新し、Acceptance は別セッションまたは人間が記入する。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | アプリは初期 Artifact、Workspace 名、Focus 名、保存先を要求せず空の Workspace で開始し、Text / Artifact / file drop / image のいずれからでも作業を始められる。New Workspace は保存 modal を出さず現在の一時状態を Discard する。 | Component/store test + CE2E-01 | E1 |
| REQ-02 | Text と Artifact は一つの text-bearing domain node の `text` / `artifact` role とし、双方向切替で Node ID、本文、summary、originalPrompt、revision、位置、寸法、Relation、provenance、hidden filename を保持する。Text→Artifact は仮 filename を提案し、Artifact→Text→Artifact で復元する。 | Domain reducer/normalization tests + CE2E-02 | E1 |
| REQ-03 | 一 Workspace は `workspaceId`、一つの `rootCanvasId`、`currentCanvasId` を持つ。SubCanvas は Folder Node と Canvas record で表し、各 Node は一つの `parentCanvasId` だけに所属する。breadcrumb / back で navigation でき、Current Canvas だけが直接選択・編集対象になる。 | Schema/invariant tests + CE2E-03 | E1 |
| REQ-04 | Node / Folder subtree を SubCanvas / parent / sibling Canvas へ移動しても identity と Relation を保持し、自己/子孫moveを拒否する。cross-canvas Relation はdown Folder badge / up-boundary portalへ集約して接続先へ移動できる。group、dissolve、move、role switch、accepted mutation はundoでき、Folder削除はcascadeしない。 | Reducer/history tests + save roundtrip + CE2E-03 | E1 |
| REQ-05 | 新保存形式 `1.3` は Workspace / Canvas tree、text role、Node ownership、Relation、current path を保持する。V1.0〜V1.2 は非破壊で load adapter を通り、次の明示 Save で 1.3 として保存できる。未知 version、破損 JSON、欠損参照は現状態を壊さず error を返す。 | Versioned fixture migration/roundtrip/failure tests | E1 |
| REQ-06 | Dialogue は active Workspace 内の memory-only state とし、500ms / beforeunload の永続保存を廃止する。Save は raw Dialogue を含めず、Export は選択 Outcome だけを持ち出し、New / Discard / app 終了で Dialogue を残さない。既存 `chat-sessions.json` は自動削除せず、以後 read/write しない。 | Store/service persistence tests + temp user-data inspection + CE2E-01/05 | E1 |
| REQ-07 | active Dialogue は同一 session の bounded message history、現在の Focus、明示 Context を Agent request に含め、別 session、別 Workspace、旧永続履歴を含めない。session 切替と Focus 変更は独立する。 | Request payload / mock LLM integration tests + CE2E-04 | E1 |
| REQ-08 | pure Context Resolver は Workspace snapshot、Current Canvas、明示選択、Focus、accepted Relation、明示 target / Candidate seed から Active Context、Candidate Context、Mutation Target、Relation Target、body allowlist を決定し、Dialogue / Direct Action が基本規則を共有する。別 Canvas 本文、未採用 Candidate、Current Canvas 全体を暗黙に含めない。 | Resolver fixture tests + Go validation tests + CE2E-03/04 | E1 |
| REQ-09 | UI は外部 LLM / image provider へ実際に送るtext、image metadata / binary、Mutation Target、Relation Target、送信先をcompactに表示し、個別除外をpayloadとtool body allowlistの双方へ反映する。Dialogue Agentのimage pixelはF-4まで送らず`metadata only`と表示する一方、既存のtext-generation Direct Actionは明示画像binaryをLLMへ渡せ、image-generation Direct Actionは選択providerを保持する。Direct ActionはDialogueの質問、自動Context拡張、session作成を暗黙に行わない。 | Payload/tool-access/provider assertions + browser E2E | E1 |
| REQ-10 | AI が選んだAL-2 edit / create mutationは`proposed → accepted / modified / rejected`を持ち、適用前にtarget / placement、role、reason、diff、base revision（edit時）、provenanceを表示する。reject / Stopは変更せず、accept / modify後はundoできる。content revisionはundo時も単調増加し、createのdecision / receipt再送は二重Nodeを作らない。人間判断を現行10秒ack timeoutで失敗させない。 | Go/Frontend proposal state integration tests + CE2E-04 | E1 |
| REQ-11 | run / proposal / event は `workspaceId`、`currentCanvasId`、Workspace generation、scope epoch、active run epoch、session、run、tool call、target revision で相関する。A→B→A navigation、load、Discard、Stop、Context scope / revision更新後に遅着したProposal / Direct Action resultはstale / cancelledとして適用しない。 | Concurrent/stale/cancel integration tests + CE2E-04 | E1 |
| REQ-12 | text file import は元 filename を保持する Artifact role、通常 text generation は Text role を既定とする。Text / Artifact の Export は role と hidden filename に従うが、Workspace / Dialogue を暗黙に保存しない。 | Import/export Backend tests + role tests + CE2E-02/05 | E1 |
| REQ-13 | Context resolution、migration、proposal、undo、save/load の失敗は、現在の Workspace を部分更新せず、対象・原因・次に可能な操作が分かる error state を表示する。失敗した undo は history cursor と revision を進めない。 | Failure injection tests + browser E2E assertion | E1 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-14 | Core E2E は一時 user-data / config / chat / image / file 領域と deterministic fake provider を使い、実 credential、実 `%AppData%/fm-doc-canvas`、外部 network、Ollama を使用しない。raw Chat / prompt / full event telemetry を evidence に保存しない。 | E2E harness isolation assertions、network deny assertion、artifact inspection | E1 |
| REQ-15 | primary controls、Node role、breadcrumb、Context chip、Proposal state、error は keyboard と accessible name / role で操作・識別できる。stable selector は accessible locator を優先し、`data-testid` は必要最小限にする。 | Keyboard browser E2E + automated accessibility assertions | E1 |
| REQ-16 | `mise` 経由の Go test、vet、Frontend logic test、TypeScript/Vite build、Core E2E、Wails production build がすべて成功する。E2E runner の実 version と browser を evidence に残す。 | Plan-defined commands and outputs | E1 |
| REQ-17 | Windows 11 / WebView2 の native Wails app で drag/drop、Text↔Artifact、SubCanvas navigation、native save/load/export dialog、Discard を smoke 確認する。 | Documented native runtime steps, OS/WebView2/version/result | E2 |
| REQ-18 | Current Canvas / SubCanvas は明示的な集合 target として指定でき、direct member の stable snapshot として Context preview / request に展開される。親の Folder 選択だけでは子本文を展開しない。将来の `DelegatedSessionRef` / `ProjectedContextRef` は由来付きの型と表示先を予約し、Projected Context は採用前 Candidate として扱うが、本計画では executor / provider を接続しない。 | Target resolver/type/component fixture tests + CE2E-03/04 | E1 |
| REQ-19 | 代表journeyでは、開始前の命名・保存判断を要求せず、human reviewerがContext送信範囲、SubCanvas境界、Proposalの適用前/後と取消、Save / Export / Discardの違いを説明でき、作業を妨げる重大な予測不能性がない。 | Separate human UX review protocol and acceptance record | E4 |

## Constraints

- Repository 操作は `.jj` が存在するため `jj` を優先する。
- Go、Node、npm、Wails は `mise` 経由で実行する。
- `mise.toml` の floating `latest` / `lts` は再現性リスクである。WP-0 で実 version を記録し、toolchain pin の要否を review する。
- Playwright は [wails_playwright_e2e.md](../cheatsheet/wails_playwright_e2e.md) の HOLD candidate であり、browser + Wails binding smoke と process cleanup が成功するまで adopted stack にしない。
- E2E runner が No-Go の場合、REQ-16 を手動確認や pure logic test へ格下げしない。実行済み smoke を持つ代替 runner を調査し、plan を amend する。
- 新しい external API、MCP client、Context Provider、image provider を導入しない。
- Current docs は実装前の真実として維持し、受理後にだけ as-built を反映する。
- API key や secret 実値を plan、test fixture、screenshot、trace、log に残さない。

## Compatibility

- V1.0 / V1.1 / V1.2 Canvas は load 可能でなければならない。
- 旧 `customNode` は `text` role、旧 `artifactNode` は `artifact` role へ変換する。
- 旧 edge は `context` Relation として direction と handle metadata を保持する。
- V1.0 / V1.1 に `canvasId` がなければ新しい `workspaceId` / `rootCanvasId` を生成する。
- 旧 file を load しただけでは source file を変更しない。ユーザーが明示 Save した時だけ 1.3 を書く。
- 画像 file の実体は従来どおり JSON 外の相対参照とし、Discard / undo で物理 file を自動削除しない。
- 既存 config、LLM/image provider 設定、Gemini thought-signature passthrough を維持する。
- 既存 `chat-sessions.json` は読込・更新を停止するが、自動削除・内容移行はしない。

## Verification / Completion Conditions

- Go unit/integration: `mise x -- go test -count=1 ./...`
- Go static check: `mise x -- go vet ./...`
- Frontend logic: `mise x -- npm --prefix frontend run test:sprint-c`。実装時に domain / migration / reducer suites を追加して task 名を一般化する。
- Frontend typecheck/build: `mise x -- npm --prefix frontend run build`
- Core E2E: `mise run e2e`（WP-0 で追加し、server start / ready / test / cleanup を一つにする）
- Wails production build: `mise run build`
- Native Wails smoke: REQ-17 の手順と結果を E2 evidence として記録する。
- Core E2E in scope: yes
- Core E2E REQ IDs: REQ-01〜REQ-16、REQ-18（REQ-16 は CE2E-01〜05 の task 完走で検証）
- Separate native / human review: REQ-17、REQ-19

## Core E2E Scenarios

### CE2E-01 — Blank start and Discard

1. isolated test data で起動し、初期 Node と命名 modal がないことを確認する。
2. table-driven isolated cases で `+ Text`、`+ Artifact`、fixture text file drop、fixture image drop の各入口から一つ目の Node を作れることを確認する。
3. Text を追加し、memory-only Dialogue を開始する。
4. New Workspace / Discard を実行し、保存確認なしで blank state へ戻る。
5. reload / restart 後も旧 Dialogue と Node が復元されず、legacy chat file が更新されないことを確認する。

Links: REQ-01、REQ-06、REQ-14。

### CE2E-02 — Text / Artifact identity and V1.3 roundtrip

1. fixture `.md` を import し、Artifact role と original basename を確認する。別の Text を作成し、本文、summary、originalPrompt、Relation、位置を設定する。
2. Text を Artifact へ切替え、仮 filename を編集し、Text へ戻して filename が隠れることを確認する。
3. Artifact へ再切替し、Node ID、本文、revision、位置、Relation、filename が保持されることを確認する。
4. test file adapter で Save / Load し、1.3 roundtrip と import / role-switch双方の Export filename を確認する。

Links: REQ-02、REQ-05、REQ-12、REQ-14。

### CE2E-03 — SubCanvas scope and undo

1. 複数 Node を SubCanvas 化し、Folder Node、breadcrumb、drill-down、Current Canvas全体を明示集合targetにする操作を確認する。親Folder選択だけでは子本文を送らない。
2. nested SubCanvas と sibling SubCanvas を作り、通常NodeとFolder subtreeを parent / sibling へ移動する。自己/子孫へのmoveがtransactionally拒否されることを確認する。
3. local↔descendant、local↔ancestor、別branchのcross-canvas Relationが、child Folder badgeまたはbreadcrumb隣接のup-boundary portalに集約され、対象Canvasへ移動できることを確認する。
4. Current Canvas 外 Node が選択、Active Context、Mutation Target、body allowlist に入らないことを確認する。
5. dissolve→undo と move→undo、Save / Load でownership、identity、Relation、tree invariantが一致することを確認する。FolderにRelationがあるdissolveは変更なしで拒否する。

Links: REQ-03、REQ-04、REQ-05、REQ-08、REQ-18。

### CE2E-04 — Shared Context and human-controlled Proposal

1. 同じ明示選択から Dialogue / Direct Action の Context preview、Mutation Target、Relation Target、送信先、body allowlist を比較する。
2. 一項目を除外し、preview、request payload、Agent tool read/searchのすべてから外れることを確認する。imageはDialogueで`metadata only`、text generation Direct ActionではLLM向け明示binary、image generation Direct Actionでは選択provider向け明示binaryになることを確認する。
3. Direct Action が session を作らず、自動質問・暗黙 Context 追加をしないことを確認する。result待機中にA→B→Aとnavigationして同じContextへ戻るcase、Context chip / exclusionを変更するcase、Stop直後にresultがraceするcaseで、遅着resultを適用せずBackend cancelを試行する。
4. fake Agent から target、reason、diff、base revision、provenance付きmutation proposalを返し、modify→accept→undo、別proposalのrejectを行う。
5. Artifact role / filename / placement付きcreate proposalをaccept→undoし、同じdecision / receipt再送でNodeが一つだけ作られることを確認する。
6. DecisionAckとStopをraceさせ、pending proposalがscope一致に見えても変更なしになることを確認する。別runではA→B→A navigationまたはrevision更新後に遅着proposalを返し、staleで適用されず、二重decisionも冪等に拒否されることを確認する。
7. fixtureだけで `ProjectedContextRef` がCandidate表示先へ、`DelegatedSessionRef` が外部作業status表示先へ入ることを確認し、実executorが呼ばれないことを確認する。

Links: REQ-07〜REQ-11、REQ-14、REQ-15、REQ-18。

### CE2E-05 — Save / Export / error boundaries

1. Save fixture に Workspace structure は含まれ、raw Dialogue は含まれないことを確認する。
2. Export が選択 Outcome だけを書き、Workspace state を変更しないことを確認する。
3. malformed V1.3、missing relation endpoint、Backend failure を注入し、現 Workspace が部分更新されないことを確認する。
4. E2E-only fault seamで次のundoをcommit前に失敗させ、本文、history cursor、content revision、command sequenceが変化せずactionable errorになることを確認する。

Links: REQ-05、REQ-06、REQ-12、REQ-13、REQ-14。

CE2E-01〜05 を `mise run e2e` から一続きに成功させること自体が REQ-16 の Core E2E 部分を検証する。keyboard-only variant は CE2E-01、03、04 の主要操作を再実行して REQ-15 を検証する。

## Out of Scope

- F-2 の transform / semantic Relation proposal の製品機能。foundation では Relation model と Proposal lifecycle だけを用意する。
- F-3 Web Context、Context Packet、Specialist subagent。
- F-4 image Agent tool / VLM evaluation。
- F-5 Saved Workspace Recall / Generated View。
- F-6 orchestration。
- Short Recovery、Pause、auto-save、save reminder。
- Legacy chat file の destructive cleanup。
- Performance threshold の新設。具体的な退行が発生した時に再現条件を追加する。

## Acceptance Criteria

- 全 REQ が `90_status.md` に一対一で存在する。
- E1 は acceptance session が同じ command を再実行し、出力を確認する。
- E2 は手順、環境、観察結果を再現または検査する。
- E4 はimplementerがreview build、代表journey、観察項目を準備し、別のhuman / acceptance sessionが用語、表示負担、対象・変更の予測可能性を判断する。implementerはAcceptanceを自己記入しない。
- 空 evidence や実行していない command 例は完了扱いにしない。
- REQ-01〜REQ-19 が pass するまで `state: done` にしない。
- 実装後に current docs と cheatsheet を as-built へ同期する。
