# Implementation Specification

## Technical Stack

F1 / F2 で Go 判定済みの既存 stack に、Context Provider の HTTP adapter を追加する。

- Desktop: Wails v2.12.0。
- Backend: Go `main` / `backend`、既存 LLM Chat Completions / streaming / tool-call contract。
- Frontend: React 18、TypeScript、Vite、Zustand、`@xyflow/react`、既存 Markdown renderer。
- Test: existing domain tests、Go tests / vet、Playwright 1.62.1 Wails E2E。
- New npm / Go module: none。
- New external API: `WebSearchPort` strategy。既定 `ollama`（Ollama Cloud `POST /api/web_search` + Bearer、authenticated 200 確認済み）、切替 `kagi`（Kagi `POST /api/v1/search` + Bearer、authenticated 200 確認済み）と `brave`（Brave Web Search、Conditional）。公式 SDK は追加しない。

## Design Decisions

1. **Search is not mutation**: `web_search` は Context Packet だけを返す。Save 対象は Promote 後の Node / Relation のみ。
2. **Packet over prose**: 材料の一次面は structured packet UI。assistant 本文は補足であり、採否の正本にしない。
3. **Observation vs inference**: ソースは観測、claim は推論。claim は sourceId なしで確定事実になれない。
4. **Strategy, not per-search picker**: Settings で既定 provider を切替える。Dialogue / Direct Action / Agent は選択中 strategy だけを使う。失敗時 failover なし。
5. **Dedicated SERP, not grounded answer**: Ollama `web_search`、Kagi v1 POST `workflow=search`、Brave Web Search を strategy にする。Tavily answer、Brave Answers / LLM Context、xAI/OpenAI `web_search`、Ollama `web_fetch`、Kagi `extract` は strategy にしない。help.kagi.com の GET + Bot 例は live 404 のため使わない。
6. **No scrape / no SSRF**: backend は検索 API 以外の URL を開かない。既知 URL は metadata。閲覧は OS browser。
7. **Reuse F2 apply path**: Promote は F2 の atomic command / history / Relation invariant を使い、新しい file version を作らない。
8. **Entry-specific search**: Dialogue / Agent は tool + packet event。Direct Action は request-as-approval の一発検索で Dialogue に載せない。
9. **Caps**: 表示ソース最大 8、Promote 最大 5、検索 timeout 15s、自動ページングなし。
10. **Bounded query**: 明示 query が400文字を超える場合は選択 Text-bearing Node の summary（最大400文字）を優先し、summary が無い場合だけquery先頭行を400文字に制限する。明示 query が空でも選択summaryがあればDirect Actionのqueryとして解決する。

## File Structure

### Domain / State

- `frontend/src/domain/contextPacket.ts`（新規）: packet / source / claim / suggested Relation の型、正規化、invariants。
- `frontend/src/domain/workspace.ts`: `Provenance.origin` に `"web"`、optional `url` / `domain` / `retrievedAt` / `query` / `contextProvider`。
- `frontend/src/domain/workspaceCommands.ts`: `promoteContextItems` atomic command。
- `frontend/src/domain/contextResolver.ts`: `ResolveOperation` に `web-search`。unaccepted packet を Active Context から除外。
- `frontend/src/domain/workspacePersistence.ts`: optional provenance field の roundtrip。packet は persist しない。
- `frontend/src/domain/invariants.ts`: promote cap、URL / domain 正規化、relation endpoint guard。

### Store / UI

- `frontend/src/store/useAppStore.ts`: packet lifecycle、promote dispatch、stale / error、Direct receipt。
- `frontend/src/store/useChatStore.ts`: Dialogue 上の packet attachment。session / canvas JSON へ書かない。
- `frontend/src/components/context/ProjectedContextPanel.tsx`（新規）: query、status、sources、claims、cluster、Promote、Open URL、閉じる。
- `frontend/src/components/chat/ToolCard.tsx` または専用 card: `web_search` の packet への入口。本文プレビューだけで完結させない。
- `frontend/src/components/ui/ContextMenu.tsx` / PromptBar: Direct Action `Search Web`。選択 Node があるときは hint として明示。
- `frontend/src/components/drawer/SettingsDrawer.tsx` と `frontend/src/types/index.ts`: `webSearch.provider`（`ollama` | `kagi` | `brave`）と per-provider `apiKey`。imageGen と同じく切替で未使用 key を消さない。検索 UI に都度 selector を出さない。
- `frontend/src/types/chat.ts`: `chat:context_packet` event、promote receipt DTO。

### Backend / Agent

- `backend/ports.go`: `WebSearchPort`（`ID()` + `Search`）。
- `backend/web_search.go`（新規）: registry、Ollama / Kagi / Brave adapter、fake adapter、URL 正規化、timeout 15s、error mapping。Ollama `web_fetch` と Kagi `extract` は置かない。
- `backend/context_packet.go`（新規）: packet DTO、claim synthesis 入力、status `complete` / `partial` / `failed`。
- `backend/agent_loop.go`: `web_search` tool。read-before-search は不要。mutation tool ではない。
- `backend/chat_service.go`: packet event、Stop / stale / correlation。
- `backend/config.go`: optional `webSearch`。欠落は `provider=ollama` + 空 keys。
- `app.go`: `SearchWeb` Direct Action bound method。E2E では fake port。
- `backend/system_prompt.go`: 検索結果を確定事実にしない、packet UI で採否する、自動 Node 化しない、を短く指示。

### Tests / E2E

- `frontend/src/tests/f3ContextPacket.test.ts`（新規）
- `frontend/src/tests/f3Promote.test.ts`（新規）
- `backend/web_search_test.go`、`backend/f3_packet_test.go`（新規）
- `frontend/e2e/ce2e-f3.spec.ts`（新規）: F3-01〜05。既存 harness の temp root / fake provider / cleanup を再利用。

## Data Model

### Context Packet

```ts
type PacketStatus = "complete" | "partial" | "failed";
type ClaimKind = "consensus" | "disagreement" | "minority" | "uncertainty" | "freshness";

interface ContextSource {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  retrievedAt: string;
  clusterId?: string;
}

interface ContextClaim {
  claimId: string;
  kind: ClaimKind;
  text: string;
  sourceIds: string[];
  relatedNodeIds?: string[];
}

interface SuggestedPacketRelation {
  claimId?: string;
  sourceId?: string;
  targetNodeId: string;
  kind: "supports" | "opposes" | "similar";
  reason?: string;
}

interface ContextPacket {
  packetId: string;
  query: string;
  retrievedAt: string;
  executor: "direct-tool";
  contextProvider: "ollama-web" | "kagi-web" | "brave-web" | "fake-web";
  status: PacketStatus;
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  runId?: string;
  sources: ContextSource[];
  claims: ContextClaim[];
  suggestedRelations: SuggestedPacketRelation[];
  unresolved: string[];
  followups: string[];
  error?: { code: string; message: string };
}
```

- `sources` は観測。`claims` は推論。synthesis 失敗時は `status=partial` で sources だけを見せ、空 claim を許す。
- `failed` は sources / claims を空にし、document を変えない。
- 同一正規化 URL は最初の 1 件だけ残す。同一 domain は同じ `clusterId` を付け、独立性の加算に使わない。
- session handle は持たない（F-3C の予約）。

### Search request

```ts
interface WebSearchRequest {
  query: string;
  hintNodeIds?: string[];
  knownUrls?: string[];
  workspaceId: string;
  canvasId: string;
  runtimeGeneration: string;
  scopeEpoch: number;
  entryRoute: "dialogue-agent" | "direct-action";
  maxSources?: number; // default 8, max 8
}
```

Hint 本文は Context Resolver の allowlist 済み summary / 短い抜粋だけ。knownUrls は検証済み https のみ。

### Provenance extension

既存 `Provenance` を V1.3 compatible に拡張する。

```ts
interface Provenance {
  origin: "user" | "file-import" | "llm" | "migration" | "web";
  sourceNodeIds?: NodeId[];
  operation?: string;
  provider?: string;
  model?: string;
  createdAt?: string;
  sourceRevisions?: Record<NodeId, number>;
  url?: string;
  domain?: string;
  retrievedAt?: string;
  query?: string;
  contextProvider?: string;
}
```

旧 file は新 field を欠いたまま読める。Save は accepted document のみ。packet は書かない。

### Config

```ts
interface WebSearchProviderKeys {
  apiKey: string;
}

interface WebSearchConfig {
  provider: "ollama" | "kagi" | "brave";
  ollama?: WebSearchProviderKeys;
  kagi?: WebSearchProviderKeys;
  brave?: WebSearchProviderKeys;
}
```

- 既定 `provider` は `ollama`。E2E は config を無視して `fake` を使う。
- Settings は imageGen と同じ保持規則: 表示中 provider の key を編集しても他方の key を消さない。
- 選択中 provider の key が空ならその adapter を呼ばず `web-search-unauthorized`。
- Tavily は config ID を予約しない（実装する amend が必要）。

## Commands and Transactions

1. Resolve query と optional hint / known URL。scope 外本文を拒否する。
2. 選択中 `WebSearchPort` の `Search` を 15s timeout で呼ぶ。未知 ID / 欠落 key / provider error は packet `failed` または error DTO。document 不変。別 strategy へ送らない。
3. 正規化して sources を作る。known URL は scrape せず title=URL、snippet 空、domain=host で追加する。上限 8。
4. 既存 LLM で structured synthesis を 1 回だけ行う。失敗しても sources は残し `partial`。
5. `chat:context_packet` を Frontend へ出す。Dialogue route だけ Chat に attachment を持つ。Direct Action は receipt に持つ。
6. Promote:
   - 再検証（workspace / canvas / generation / scope / packetId / 選択 ID）
   - 選択 claim / source ごとに Text Node を Current Canvas へ作成
   - 承認済み suggested Relation だけ追加
   - document validate 成功時のみ 1 history entry
7. 失敗・stale・cap 超過は元状態のまま。physical side effect なし。
8. Undo は F2 と同じ history cursor。packet 自体は履歴に残さず、必要なら再検索する。

## UI / Screens

- Dialogue: `web_search` tool のあとに Projected Context Panel を出す。assistant 本文だけにソースを閉じ込めない。
- Direct Action: 選択と query が action から分かり、実行後に同じ Panel を出す。Accept カードは出さない。
- Panel: query、status、確認時刻、実行した strategy の短い表示（`Ollama` / `Kagi` / `Brave`）、source cards、claim cards、cluster 注記、Promote、Open URL、閉じる。
- Settings: Web Search provider セレクトと、選択中 provider の API key。検索操作面には出さない。
- Source card: title、domain、snippet、確認時刻。展開で URL。
- Claim card: kind label、text、引用ソース。確定バッジを付けない。
- Promote: 選択チェック、Relation 採否、1 回 5 件。超過は選択解除を促す。
- Open URL: OS browser。アプリ内プレビューなし。
- エラー: 設定を開く、query を直す、閉じる、の次操作を示す。暗黙再検索しない。

## Agent Contract

- `web_search`: required `query`。optional `known_urls`（https 配列）。hint は request snapshot の選択から backend が付与し、model に hidden body を渡させない。
- Tool result は packet の短い要約（query、source titles / urls、claim texts、packetId）を model へ返す。同時に Frontend へ完全 packet を event する。
- `web_search` は Node / Relation を作らない。Promote は人間の明示 UI 操作。
- 既存 `propose_transform` / `propose_relation` / Artifact tools、max 10 rounds、cancel、correlation は維持する。
- Direct Action `SearchWeb` は Agent loop、問い返し、追加 tool round、Dialogue append を行わない。

## Persistence

- Keep `version: "1.3"`。optional provenance field のみ追加。
- Save は accepted Node / Relation。pending packet、raw hits、rejected claims は保存しない。
- Roundtrip は node IDs、content、provenance url / domain / retrievedAt / query、relation endpoints を比較する。
- 旧 V1.3 は新 field なしで読める。unknown version は既存 failure no-op。

## Error Handling

User-visible codes:

- `web-search-unauthorized`
- `web-search-unknown-provider`
- `web-search-timeout`
- `web-search-provider-error`
- `web-search-empty`
- `web-search-invalid-query`
- `web-search-invalid-url`
- `promote-stale`
- `promote-cap-exceeded`
- `promote-out-of-scope`

Provider / JSON エラーは partial Node を作らない。synthesis 失敗は `partial` packet であり document エラーではない。

## Requirement Traceability

| REQ ID | Specification area | Files / components | Verification |
| --- | --- | --- | --- |
| REQ-01 | Query / hint allowlist | `contextResolver.ts`, `WebSearchRequest` | domain + F3-01 |
| REQ-02 | Direct Tool search | `web_search.go`, active strategy | adapter + F3-01 |
| REQ-18 | Provider strategy | registry, `config.go`, SettingsDrawer | config roundtrip + unit |
| REQ-03/11 | Packet invariants / clustering | `contextPacket.ts` | domain tests |
| REQ-04/08 | Candidate lifetime | chat store, persistence, resolver | F3-03 |
| REQ-05/06/07 | Promote + provenance + Relation | `workspaceCommands.ts` | F3-02 |
| REQ-09 | Stale guard | store, chat_service, packet IDs | F3-04 |
| REQ-10/12 | Known URL / errors | URL validator, error mapping | F3-05 |
| REQ-13/14 | Entry + UX | Panel, Direct Action, ToolCard | F3-01/04, E4 |
| REQ-15/16 | Harness / completion | E2E fake port, plan commands | F3-01〜05 |
| REQ-17 | F3 core Gate | review scenario | separate E4 |
| NFR-01〜05 | deps / atomicity / allowlist / secrets / SSRF | manifests, commands, adapter | E1/E3 |

## Work Packages

| WP | REQ IDs | Target files | Completion condition |
| --- | --- | --- | --- |
| WP-0 | REQ-15/16/18 | E2E composition, `WebSearchPort` fake, registry stub | F1/F2 baseline green。fake が決定的 packet を返す。実ネットワークなし |
| WP-1 | REQ-01/03/10/11 | `contextPacket.ts`, resolver, URL / domain normalize | query allowlist、claim/source invariant、URL 拒否、cluster が domain test で pass |
| WP-2 | REQ-04/05/06/07/08 | commands, persistence, store | Promote atomic + undo、packet 非保存、accepted-only resolver |
| WP-3 | REQ-02/09/12/13/15/18 | `web_search.go`, Ollama/Kagi/Brave adapters, agent tool, `SearchWeb`, config, synthesis | registry 切替、key 保持、no failover、stale、errors。本番 adapter は Conditional |
| WP-4 | REQ-04/13/14/18 | Projected Context Panel, Settings provider+keys, Open URL | 検索から Promote / 閉じる / ブラウザ起動、Settings 切替まで UI で完結 |
| WP-5 | REQ-01〜18, NFR-01〜05 | `ce2e-f3.spec.ts`, build, E4 template | F3-01〜05 と plan commands。Gate は別受入 |

## Implementation Order / First Checks

1. **WP-0 — harness first**: 既存 `mise run test` / `go vet` を再実行し、fake `WebSearchPort` と packet fixture を足す。ここで npm / Go module 追加が不要なことを確認する。
2. **WP-1 — packet contract**: 正規化、claim 引用、URL 拒否、cluster を pure test で固める。UI や実 API を先に実装しない。
3. **WP-2 — promote transaction**: `promoteContextItems`、undo、failure injection、V1.3 provenance roundtrip。packet が Save に混入しないことを Go 条件とする。
4. **WP-3 — strategies and routes**: registry、Ollama / Kagi / Brave HTTP adapter、tool / Direct Action / synthesis / stale / errors。Ollama / Kagi は authenticated 200 済み。failover が無いことを unit で固定する。Kagi は POST JSON + Bearer、`extract` なし。Dialogue packet は runId / runEpoch / active run を検証する。
5. **WP-4 — projected context UI**: contract が green になってから Panel、Settings の provider 切替、Open URL を足す。UI から document を直接書き換えない。
6. **WP-5 — vertical acceptance**: F3-01〜05 を `mise run e2e` に追加し、implementer evidence だけ `90_status.md` へ書く。REQ-17 は別 session。

## Verification

- Baseline before implementation: `mise run test` and `mise exec -- go vet ./...`。
- Per WP: domain tests + 対象 Go tests。
- Final: `mise run test`、`mise exec -- go vet ./...`、`mise run build`、`mise run e2e`。
- E2E は real provider env が無いこと、temp root cleanup、検索後の Node 数不変、Promote 後の provenance、stale no-op を assert する。

## Core E2E Scope

### F3-01 — Search emits packet, no mutation

2 つの Text Node を置き 1 つを選択して Dialogue から検索する。request は query と選択 hint だけ。packet が表示され、Node / Relation 数は変わらない。同一 URL は 1 件に畳まれる。

### F3-02 — Promote, relation, undo

claim 1 件と source 1 件を Promotes し、suggested `supports` を 1 つ承認する。derived ではない Text Node、web provenance、Relation、one undo を確認する。元 Node 本文は不変。

### F3-03 — Candidate exclusion and persistence

未採用 packet を次の Context preview と Save/Load から除外する。採用 Node の url / retrievedAt は Load 後も残る。New Workspace 後に古い packet は消える。

### F3-04 — Direct Action and stale

Canvas / PromptBar の Search Web は Dialogue に message を足さない。検索中に New または Canvas 移動した遅着 packet / Promote は no-op。

### F3-05 — Errors and known URL

key なしまたは fault で unauthorized / timeout / empty を出し、document 不変。既知 https URL は scrape せずソースになり、Open URL が外部起動経路を呼ぶ（実ブラウザ検証は E4 でも可）。不正 URL は拒否。

## F3 Core Gate Review

Separate acceptance は代表的な実課題 1 件で REQ-17 を記録する。

- transfer: 外部検索・調査 Agent への移動や転記が減ったか
- grounded use: 根拠付き Projected Context が比較や判断に使われたか
- control: 元状態、由来、取消、未採用が残っていないことを説明できるか
- friction: 表示量、確認、掃除が便益を上回らないか
- decision: Go / Hold / Stop と短い理由、F-3C を試す trigger

telemetry、採用率目標、終了アンケートは追加しない。
