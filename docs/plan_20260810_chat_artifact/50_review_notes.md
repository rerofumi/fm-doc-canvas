# Review Notes

## Review Findings

### Adopted product definition

- Text / Artifact は Markdown source text をノード内に保持し、ノード上では Markdown をレンダリング、EditorDrawer では pure text として編集、`.md` として export する。
- Artifact は「外部ファイル」ではなく Canvas 内の論理 Markdown 文書である。
- Image は画像とプロンプトを対で保持し、プロンプトを表示・copy できる。
- 編集中（フォーカス中）のノードは常に直接コンテキストへ含める。
- 接続元ノードは `traverseContextBackwards` の順序で直接コンテキストへ含める。
- 非接続ノードは全件自動送信せず、agent が `list_canvas_nodes` で発見し、`read_canvas_node` で必要時に読む。

### Adopted architecture

- Frontend Zustand store を Canvas runtime state の正本とする。
- Backend agent は送信時の request-local Canvas snapshot を参照する。
- mutation tool は Frontend へ proposal を送り、revision 照合後の acknowledgment を待つ。
- applied acknowledgment を受けるまで、Backend は LLM へ編集成功を返さない。
- event は `runId/sessionId/toolCallId/nodeId/baseRevision` で相関する。
- chat session は Canvas JSON と分離して保存するが、`canvasId` で関連付ける。

## Fixed Items

### Claim → Requirements traceability

- 接続関係をチャット文脈として使う要件を `REQ-C13`, `REQ-C14` に追加した。
- 任意ノードの on-demand context を `REQ-C15`, `REQ-C19` に追加した。
- Text / Artifact の Markdown 表示・編集・export、Text revision、Image prompt copy を `REQ-A11`〜`REQ-A14` に追加した。

### State synchronization / race

- ChatRequest に Canvas snapshot と direct context node IDs を追加した。
- event correlation を `REQ-C16` に追加した。
- revision conflict を `REQ-C09`, `REQ-C17` に追加した。
- Frontend acknowledgment を `REQ-C20` に追加し、agent の成功誤認を防いだ。
- Stop 後の未適用 mutation を拒否する要件を `REQ-B08` に追加した。

### Persistence

- Chat persistence を Frontend 単独処理から Wails backend binding に変更した。
- `canvasId` による session 分離を `REQ-N10` に追加した。
- V1.0 / V1.1 は load 時に元ファイルを書き換えず、次回 save で V1.2 にする状態遷移へ統一した。

### Requirement quality

- `E1 or E2` を廃止し、各要件に単一の evidence class を割り当てた。
- 存在しない `npm run lint` を、現行 package script に存在する `npm --prefix frontend run build` へ修正した。
- 起動性能と streaming 中 responsiveness に測定条件を追加した。
- `apply_edit` の 0 件・複数件一致を非変更 error と定義した。
- `apply_edit` を read 済み Text / Artifact 共通の Markdown 差分編集として定義した。
- root binding の対象を実在するルート `app.go` に修正した。
- Zustand の記述を現行 5.x に修正した。

### Retired IDs

- `REQ-B11`: echo stub は最終プロダクト要件ではなく WP-B の一時的 smoke check だったため廃止。ID は再利用しない。
- Sprint B の UI 受入で echo が通常回答に見えて混乱を生んだため、stub は製品コードから削除し、既存 LLM service を使う `GenerateChatReply` に置換した。agent tool/stream/cancel は Sprint C の責務を維持する。
- `REQ-N09`: `REQ-C01` の max tool round と重複していたため廃止。ID は再利用しない。

## Decisions and Rationale

### Direct context と tool context を分離

全 Canvas を毎回 prompt に含めると、無関係な情報と token 消費が増える。一方、target だけでは Canvas の接続構造を活かせない。そのため次の二層とする。

1. target + 接続元: 毎回直接 context
2. その他の node: agent tool による on-demand context

### Frontend source of truth

既存 Canvas は Zustand が保持し、保存時に JSON 化して Backend へ渡す構造である。Backend に別の常設 ArtifactManager を正本として追加すると二重管理になるため採用しない。Backend は run 単位 snapshot と tool run state だけを持つ。

### Revision のみを内部管理

- `revision`: 全 content mutation で増え、競合検出に使う。UI には表示しない。

手動入力のたびに user-facing version を増やすと意味のないカウンターになるため、Artifact の version はデータモデルと UI から削除した。revision は stale edit 検出のために保持する。

## Rejected Options

- **全 Canvas 本文を毎回 prompt へ送る**: token と関連性の問題が大きいため却下。
- **Backend ArtifactManager を永続的な正本にする**: Zustand と二重管理になるため却下。
- **tool_done を受けた Frontend が無応答で適用する**: conflict 時に LLM が成功誤認するため却下。
- **session を Canvas JSON に埋め込む**: 成果物と作業会話を分離する方針を維持。ただし `canvasId` で関連付ける。
- **target 変更で session も自動切替**: focus と会話の関係が暗黙的になるため却下。session は明示切替とする。
- **filename だけで Artifact を識別**: 同名を安全に扱えないため却下。nodeId を identity とする。
- **複数 Artifact の原子的な一括編集**: MVP の mutation/rollback が複雑になるため延期。

## Open Questions / Pre-Implementation Checks

1. Ollama の対象 version/model と、tool calling + streaming + image input の対応範囲を実機確認する。
2. OpenAI-compatible provider ごとの streaming tool call delta の差を既存 `backend/llm.go` に合わせて確認する。
3. `chat:stream` の頻度が Wails event queue と React render に与える影響を測定し、必要なら chunk を batch する。
4. 数万字 Markdown の node preview / EditorDrawer rendering 性能を測定する。
5. Image node の `src` を vision request へ解決する既存 API 経路を確認する。
6. `read_canvas_node` の tool result size 上限と search snippet 上限を実装前に確定する。
7. worklog を enabled / disabled のどちらにするかユーザー確認待ち。

## Deferred Items

- 複数 Artifact への原子的な一括編集
- 外部 `.md` file watch / 双方向同期
- 文体 preset
- Mindmap 自動整列
- 進捗カウンター
- キャラクター相関図
- 外部 MCP / image generation tool
- Playwright 等の E2E framework
- HTML / CSS / JS iframe Artifact
- 多言語 UI

## Documentation Feedback

実装と受理の完了後、確認できた挙動だけを current docs へ反映する。

- `docs/claim.md`: Artifact / ChatDrawer / agent context の利用可能範囲
- `docs/requirement.md`: node context、revision conflict、session association
- `docs/specification.md`: snapshot、tool acknowledgment、persistence schema
- `docs/cheatsheet/`: provider tool calling、Wails event/acknowledgment、edit engine

## Amend History

- 2026-08-10: Full plan 初版。
- 2026-08-10: Claim レビューを反映。論理 Markdown 文書、focus context、connected context、任意 node tool、event correlation、revision acknowledgment、canvasId session、検証可能性を 20 以降へ反映。
- 2026-08-10: User decision を反映。Artifact の user-facing `version` は廃止し、内部競合検出用 `revision` のみ保持する。
