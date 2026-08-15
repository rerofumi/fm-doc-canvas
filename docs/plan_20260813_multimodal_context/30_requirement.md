# Requirements

## Scope

F1 / F2 の Workspace 契約を利用し、既存画像生成と Dialogue Vision を共同材料化する。この plan は F-4A と Vision Context（意図と結果の差分共有まで）の core slice である。確認付き自動再生成、AL-3、`fm-image-assistant`、F-5 Generated Structure は含めない。

## Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| REQ-01 | Dialogue または明示 Direct Action から、空でない画像生成 prompt を解決する。任意の選択 Text-bearing Node は context 本文、選択 Image は参照画像に限る。別 Canvas、excluded Node、hidden body は暗黙に送らない。 | Resolver / request fixture test、Core E2E F4-01/02 | E1 |
| REQ-02 | Dialogue / Agent の `generate_image` は Settings の既定または Chat で明示選択した Image Provider を一度だけ呼び、相対 asset path を返す。選択は Settings を変更せず、tool 実行だけでは Workspace document を変更しない。 | Backend tool test、F4-01 | E1 |
| REQ-03 | PromptBar Image Direct Action は同じ ImagePort と Variant 契約を使い、Agent loop / 追加 Proposal / Dialogue 履歴を作らない。request-level provider 切替は Dialogue / Direct Action の双方で保存済み既定 provider を暗黙変更しない。 | Route integration + F4-02 | E1 |
| REQ-04 | Dialogue の生成結果は実画像を含む Image Variant Proposal として preview する。accept 前に Image Node / Relation を増やさない。reject / Stop は配置しない。 | Proposal test + F4-01 | E1 |
| REQ-05 | 採用または Direct 配置は atomic である。Current Canvas に Image Node を 1 つ作り、明示 source への `derived` Relation と provenance を付け、一つの undo で戻せる。元 Node は変更しない。 | Atomic reducer + F4-01/02 | E1 |
| REQ-06 | Image Variant の provenance は `origin=image`、operation、sourceNodeIds、sourceRevisions、provider、model、prompt、createdAt を持つ。Save / Load 後も残る。 | Persistence / command test、F4-01 | E1 |
| REQ-07 | 明示選択され除外されていない Image は Dialogue の Vision Context として最大 3 枚まで `image-binary` / destination `llm` になる。Context Preview にその旨を表示する。4 枚目以降は送らず warning にする。 | Resolver + F4-03 | E1 |
| REQ-08 | Agent の最初の user message または明示 read 経路は、allowlist 済み Image の pixel を LLM へ渡す。`read_canvas_node(image)` は allowlist 内なら `imageIncluded=true` を返す。allowlist 外は metadata only。 | Agent payload test + F4-03 | E1 |
| REQ-09 | AI Partner は Vision 付き Dialogue で、意図（prompt / 参照 Text）と実画像の差分を AL-0/1 として説明できる。自動再生成、無断の追加 `generate_image` はしない。 | Fixture reply + F4-03、human E4 | E1 / E4 |
| REQ-10 | 未採用 Image Proposal の pixel / path は次の Active Context と Save に含めない。採用済み Image Node / Relation だけが persistence と次 Context の対象になる。 | Resolver + Save/Load、F4-01 | E1 |
| REQ-11 | 配置 / 遅着 result の適用前に workspaceId、Current Canvas、runtime generation、scope / run epoch、proposalId を検証する。New / Discard / Load / navigation / Stop 後は stale として変更しない。 | Concurrent/stale test、F4-04 | E1 |
| REQ-12 | key 欠落、timeout、provider 4xx/5xx、空 prompt、不正 asset は document を変えず、次操作が分かるエラーにする。別 Image Provider へ暗黙 failover しない。 | Backend error test、F4-05 | E1 |
| REQ-13 | 主要操作（Image 生成、Proposal accept/reject、Direct Undo、Context 除外、Vision 表示）は accessible name を持ち、失敗理由を理解できる。PromptBar Image 導線は退行しない。 | Browser assertions + UX review | E1 / E4 |
| REQ-14 | Core E2E は FixtureImage / FixtureLLM / temp asset だけを使い、実 API key / 外部ネットワークを要求しない。provider へ送る本文と画像は allowlist に限定する。 | Harness inspection、payload test | E1 |
| REQ-15 | F4 の plan-defined build、typecheck、unit/domain、Go、vet、Core E2E が全て pass する。Core E2E は F4-01〜F4-05 を含み、既存 F1 / F2 / F3 E2E を壊さない。 | `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e` | E1 |
| REQ-16 | 実課題による別受入 session / human review で、(a) 画像生成の文脈再入力や別 tool 移動が減ったか、(b) 意図と結果の差分を同じ机で共有できたか、(c) PromptBar Direct Action が遅くなっていないか、(d) 確認・待機・掃除の負担が便益を上回らないかを記録し、F4 core Gate を Go / Hold / Stop 判定する。件数 telemetry は追加しない。 | Plan-defined task-based review note | E4 |

## Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| NFR-01 | 新規 runtime / UI npm package と新規 Go module を追加しない。画像生成と Vision は既存 ImagePort / LLM Chat Completions を使う。 | `package.json` / `go.mod` diff inspection | E3 |
| NFR-02 | Dialogue の tool 実行は document を変えない。配置は単一 command transaction とし、失敗時に document、history cursor、revision、selection を部分更新しない。 | Fault injection / reducer test | E1 |
| NFR-03 | 外部 LLM / Image Provider へ送る本文と画像は Context Resolver の allowlist だけである。data URL を Workspace JSON、Dialogue persistence、cheatsheet、E2E fixture 本文に書かない。 | Payload / persistence inspection | E1 / E3 |
| NFR-04 | Image Provider / LLM API key は local `config.json` のみ。canvas JSON、Dialogue、Proposal、E2E fixture に書かない。 | Config / persistence inspection | E3 |
| NFR-05 | undo / reject は物理画像ファイルを自動削除しない。残留ファイルは downloadPath 配下に残り、残存リスクとして受理時に確認する。 | File inspection + documented residual | E2 / E3 |

## Constraints

- 開発・検証コマンドは `mise` 経由で実行する。
- F1 / F2 / F3 の V1.3 意味を変更しない。provenance の optional field 追加に留め、V1.4 が必要なら implementation 前に amend する。
- Dialogue は既定 Image Provider で開始し、run-level の明示選択を許可する。失敗時 failover なし。
- Direct Action は追加の Agent 判断、問い返し、Dialogue への自動昇格を行わない。
- Vision は 1 Dialogue run あたり最大 3 枚。image generation の参照画像は既存上限 5 枚。
- 自動再生成、AL-3、`fm-image-assistant` を同じ slice に混ぜない。

## Compatibility

- V1.0〜V1.3 の既存 load / migration を壊さない。
- 既存 `apply_edit`、transform、Relation、web_search、PromptBar Text / Image の F1〜F3 挙動を壊さない。
- F1 REQ-09 の Dialogue metadata-only は、この plan の明示 Vision allowlist に限り上書きする。除外した Image と allowlist 外 Image は従来どおり metadata only。
- PromptBar の request-level Image Provider 切替は維持する。

## Verification / Completion Conditions

- Build: `mise run build` が exit 0。
- Typecheck: Wails build 内の `npm run build` が exit 0。必要に応じ `mise exec -- npm --prefix frontend run build`。
- Unit / domain: `mise run test` が exit 0。variant / vision / stale / payload test を含む。
- Backend static: `mise exec -- go vet ./...` が exit 0。
- Core E2E in scope: yes。
- Core E2E IDs: F4-01 Dialogue proposal / variant / undo、F4-02 Direct Action / no Dialogue、F4-03 Vision allowlist / diff explain、F4-04 stale / Stop、F4-05 errors / PromptBar regression。
- 実 Image Provider / 実 VLM の画質は Conditional であり、Core E2E の合格条件ではない。

## Out of Scope

- 確認付き自動再生成ループ。
- AL-3 限定反復、`fm-image-assistant`、Specialist subagent。
- 新しい Image Provider、inpainting / mask UI、動画。
- Image を Web Context の入力にすること。
- Image Provider の暗黙 failover。
- 物理ファイル GC、telemetry、性能 SLO の新設。

## Acceptance Criteria

- 各 REQ に verification method と evidence class が設定されている。
- 実装者は `90_status.md` の implementer state / evidence のみ更新し、acceptance は別 session / human が実施する。
- F4 Gate は、文脈再入力と別 tool 移動が減り、Direct Action を損なわず、確認負担が便益を上回らないことを確認して Go とする。
- この plan の `done` は F4 core slice の受理であり、ロードマップ全体の F-4 milestone closure を意味しない。
