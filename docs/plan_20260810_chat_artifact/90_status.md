# Status

state: implementing
worklog: enabled

tier: Full
plan: plan_20260810_chat_artifact

## Acceptance Table

### Sprint A: Node / Markdown

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-A01 | 「+ Artifact」で Artifact を追加 | UI 操作 | E2 | WP-A1 | implemented | `App.tsx` のボタン、`useAppStore.addArtifactNode` | pass |
| REQ-A02 | Artifact data に revision/count 等を保持 | 生成・roundtrip test | E1 | WP-A1 | implemented | `types/index.ts`, `utils/artifact.ts`, `useAppStore.ts` | pass |
| REQ-A03 | EditorDrawer で Markdown source を編集 | UI 操作 | E2 | WP-A1 | implemented | `EditorDrawer.tsx` の Artifact 分岐と `updateArtifactContent` | pass |
| REQ-A04 | Edit / Preview を切替 | UI 操作・screenshot | E2 | WP-A1 | implemented | `EditorDrawer.tsx` の既存 Edit/Preview を Artifact に適用 | pass |
| REQ-A05 | filename/summary/charCount を表示 | screenshot | E2 | WP-A1 | implemented | `ArtifactNode.tsx` の summary footer、`EditorDrawer.tsx` の filename 編集欄・count 表示 | pass |
| REQ-A06 | charCount/wordCount を再計算 | unit test | E1 | WP-A1 | implemented | `utils/artifact.ts:getContentStats`, `updateArtifactContent` | pass |
| REQ-A07 | V1.2 で Artifact と canvasId を永続化 | roundtrip test | E1 | WP-A2 | implemented | `CanvasFileV1_2`, `saveCanvas`, `loadCanvas` | pass |
| REQ-A08 | V1.0/V1.1 を読込・編集 | fixture test | E1 | WP-A2 | implemented | `loadCanvas` の V1.0/V1.1 migration 分岐 | pass |
| REQ-A09 | 空の新規 Canvas だけ初期 Artifact を生成 | 新規/既存 UI 確認 | E2 | WP-A1 | implemented | `App.tsx` の初期 Artifact 生成、load 時の既存 nodes 維持 | pass |
| REQ-A10 | Artifact と Text/Image を接続 | UI 操作 | E2 | WP-A1 | implemented | `ArtifactNode.tsx` の React Flow handles | pass |
| REQ-A11 | Artifact 上で Markdown を render、Text は Summary 表示 | UI 操作 | E2 | WP-A1 | implemented | `ArtifactNode.tsx` の ReactMarkdown、`CustomNode.tsx` の Summary 表示 | pass |
| REQ-A12 | Text/Artifact を `.md` export | file 内容確認 | E2 | WP-A2 | implemented | `useAppStore.exportNode` → `ExportMarkdownWithFilename`、Backend `DefaultFilename` に Artifact filename を設定 | pass |
| REQ-A13 | Image prompt を表示・copy | UI/clipboard 確認 | E2 | WP-A3 | implemented | `ImageNode.tsx` の prompt footer/copy button | pass |
| REQ-A14 | Text revision を移行・更新 | migration/store test | E1 | WP-A1 | implemented | `TextNodeData.revision`, `updateNodeContent`, V1 migration | pass |

### Sprint B: ChatDrawer / Session

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-B01 | ChatDrawer を開閉・resize | UI 操作 | E2 | WP-B1 | implemented | `ChatDrawer.tsx`, `ChatToggleButton.tsx`。default 420px、320px〜viewport 80% clamp、listener cleanup | pass |
| REQ-B02 | node type 別 target 表示 | 3 node type の UI 確認 | E2 | WP-B1 | implemented | `chatContext.ts:describeChatTarget`, `ChatHeader.tsx`。type + Artifact filename/Text先頭/Image promptを表示 | pass |
| REQ-B03 | target なしでは全 Canvas を自動送信しない | UI/payload 確認 | E2 | WP-B1 | implemented | targetなしは「対象未選択」。`buildChatRequestContext` は同一session履歴だけを `GenerateChatReply` へ渡し、全Canvasを送らない | pass |
| REQ-B04 | session を明示切替 | UI 操作 | E2 | WP-B1 | implemented | `ChatHeader.tsx` select、`useChatStore.setActiveSession`、session別 activeRuns | pass |
| REQ-B05 | Canvas に紐づく session を作成 | UI/保存データ確認 | E2 | WP-B1 | implemented | `+ New`、Canvas load中の操作無効化、canvasId別 `ChatSessionService` 保存 | pass |
| REQ-B06 | Enter 送信・Shift+Enter 改行 | UI 操作 | E2 | WP-B1 | implemented | `ChatInput.tsx` の keyboard handler | pass |
| REQ-B07 | streaming 進行中表示 | screenshot | E2 | WP-B1 | implemented | `GenerateChatReply` 待機中のindicator、session別run routing。逐次agent chunkはREQ-C05 | pass |
| REQ-B08 | Stop で run cancel、未適用 edit を拒否 | integration test | E1 | WP-C4 | todo | - | - |
| REQ-B09 | focus 変更で target を更新 | UI 操作 | E2 | WP-B1 | implemented | Text/Artifact Editor focusとImage Canvas clickを `App.tsx` でtargetへ同期 | pass |
| REQ-B10 | EditorDrawer close で target null | UI 操作 | E2 | WP-B1 | implemented | `EditorDrawer.handleClose` と `App.tsx` のisEditorOpen同期 | pass |
| REQ-B12 | target 変更で session を自動切替しない | UI 操作 | E2 | WP-B1 | implemented | `setTarget` と `setActiveSession` を独立actionとして保持 | pass |

`REQ-B11` は廃止済み。ID は再利用しない。

### Sprint C: Agent / Context / Editing

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-C01 | 最大 10 tool round で停止 | unit test | E1 | WP-C3 | todo | - | - |
| REQ-C02 | 7 tools が個別に動作 | tool unit test | E1 | WP-C2 | todo | - | - |
| REQ-C03 | Text/Artifact の apply_edit は一意一致のみ変更 | unit test | E1 | WP-C2 | todo | - | - |
| REQ-C04 | context.Context で cancel | delayed server test | E1 | WP-C3 | todo | - | - |
| REQ-C05 | chat:stream を相関付きで送信 | integration test | E1 | WP-C3 | todo | - | - |
| REQ-C06 | tool start/done/apply event を送信 | integration test | E1 | WP-C3 | todo | - | - |
| REQ-C07 | run ごとに終端 event 1 件 | state test | E1 | WP-C3 | todo | - | - |
| REQ-C08 | system prompt の必須指示 | unit test | E1 | WP-C2 | todo | - | - |
| REQ-C09 | Text/Artifact は baseRevision 一致時だけ edit 適用 | store test | E1 | WP-C4 | todo | - | - |
| REQ-C10 | write_artifact の create/replace 条件 | tool/store test | E1 | WP-C4 | todo | - | - |
| REQ-C11 | ToolCard の diff/status 表示 | UI 確認 | E2 | WP-C4 | todo | - | - |
| REQ-C12 | 記録済み Ollama version/model で roundtrip | 実機ログ・screenshot | E2 | WP-C3 | todo | - | - |
| REQ-C13 | focus node を direct context に含める | request builder test | E1 | WP-C1 | todo | - | - |
| REQ-C14 | 接続元を traversal 順で direct context に含める | graph fixture test | E1 | WP-C1 | todo | - | - |
| REQ-C15 | list/read canvas tools で任意 node を取得 | index/3 node type test | E1 | WP-C1 | todo | - | - |
| REQ-C16 | event に run/session/edit correlation を含める | schema/routing test | E1 | WP-C4 | todo | - | - |
| REQ-C17 | stale edit を conflict として拒否 | store conflict test | E1 | WP-C4 | todo | - | - |
| REQ-C18 | Text/Artifact は同 revision の read 後のみ変更 | run state test | E1 | WP-C2 | todo | - | - |
| REQ-C19 | target なしで全 node 本文を初期送信しない | request builder test | E1 | WP-C1 | todo | - | - |
| REQ-C20 | Frontend acknowledgment 後だけ tool success | integration test | E1 | WP-C4 | todo | - | - |

### Non-Functional / Compatibility

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-N01 | 旧版は load 時非破壊、次回 save で V1.2 | fixture load/save test | E1 | WP-A2 | todo | - | - |
| REQ-N02 | cold start 中央値が既存の 1.5 倍以内 | 5 回測定結果 | E2 | WP-QA | todo | - | - |
| REQ-N03 | streaming 操作中に新規 100ms 超 Long Task なし | DevTools 記録 | E2 | WP-QA | todo | - | - |
| REQ-N04 | `mise run build` 成功 | command output | E1 | WP-QA | todo | - | - |
| REQ-N05 | Frontend TypeScript/Vite build 成功 | command output | E1 | WP-QA | todo | - | - |
| REQ-N06 | secret 実値を source/evidence に保存しない | rg/diff review | E3 | WP-QA | todo | - | - |
| REQ-N07 | Markdown XSS payload が実行されない | UI payload test | E2 | WP-QA | todo | - | - |
| REQ-N08 | chat history を backend 経由で再起動復元 | UI 再起動確認 | E2 | WP-B2 | implemented | `App.tsx` のload/debounce/切替flush、`ChatSessionService`、load error表示。Save JSON後の再起動Loadで復帰をユーザー確認 | pass |
| REQ-N10 | session を canvasId で分離 | 2 Canvas persistence test | E1 | WP-B2 | implemented | Canvas切替時beginLoad、`TestChatSessionServiceSeparatesCanvases`、JSON wrapper/migration tests、`go test ./...` exit 0 | pass |

`REQ-N09` は廃止済み。ID は再利用しない。

## Plan Checks

| Check | Expected evidence | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Build | `mise run build` exit 0 | implemented | mise shim環境の `wails build -nocolour` exit 0、`build/bin/fm-doc-canvas.exe` 生成 | - |
| Frontend build | `mise x -- npm --prefix frontend run build` exit 0 | implemented | Direct `npm --prefix frontend run build` exit 0（TypeScript/Vite） | - |
| Go tests | `mise x -- go test ./...` exit 0 | implemented | Managed mise Go 1.26.1 の `go test ./...` exit 0 | - |
| Core E2E | `30_requirement.md` の 1〜9 | todo | - | - |

## Evidence Class Notes

- **E1**: automated command/test と出力
- **E2**: 手順付き runtime observation、screenshot、log
- **E3**: file/symbol/diff pointer と静的確認
- **E4**: acceptance session または人間の品質判断
- **EX**: 直接検証不能。reason/fallback/residual risk/decision condition が必要

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-10 | User acceptance | Sprint A accepted | REQ-A01〜REQ-A14 を確認済み。Sprint B/C は未受理。 |
| 2026-08-10 | User acceptance | Sprint B ChatDrawer/chat accepted | REQ-B01〜B07、REQ-B09、REQ-B10、REQ-B12、REQ-N08、REQ-N10 を確認済み。REQ-B08 は Sprint C/WP-C4。 |

## Abandoned / No-Go Reason

`state: abandoned` の場合だけ記録する。
