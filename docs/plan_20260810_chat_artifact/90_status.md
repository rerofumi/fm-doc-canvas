# Status

state: done
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
| REQ-B08 | Stop で run cancel、未適用 edit を拒否 | integration test | E1 | WP-C4 | implemented | run 単位の `ChatService.Cancel`、Frontend の active run 照合。`TestCancelOnlyReleasesPendingApplicationsForTargetRun`、`TestChatServiceCancelEmitsOneTerminalEvent` | pass |
| REQ-B09 | focus 変更で target を更新 | UI 操作 | E2 | WP-B1 | implemented | Text/Artifact Editor focusとImage Canvas clickを `App.tsx` でtargetへ同期 | pass |
| REQ-B10 | EditorDrawer close で target null | UI 操作 | E2 | WP-B1 | implemented | `EditorDrawer.handleClose` と `App.tsx` のisEditorOpen同期 | pass |
| REQ-B12 | target 変更で session を自動切替しない | UI 操作 | E2 | WP-B1 | implemented | `setTarget` と `setActiveSession` を独立actionとして保持 | pass |

`REQ-B11` は廃止済み。ID は再利用しない。

### Sprint C: Agent / Context / Editing

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-C01 | 最大 10 tool round で停止 | unit test | E1 | WP-C3 | implemented | `runAgent` の round loop、`TestAgentStopsAfterTenToolRounds` | pass |
| REQ-C02 | 7 tools が個別に動作 | tool unit test | E1 | WP-C2 | implemented | `TestSevenToolDefinitionsAndReadTools`、`TestApplyEditCoversTextZeroMultipleUnicodeAndWrongType`、`TestWriteArtifactRequiresReadOrExplicitNewDocument` | pass |
| REQ-C03 | Text/Artifact の apply_edit は一意一致のみ変更 | unit test | E1 | WP-C2 | implemented | `TestToolContractsReadAndApplyExactlyOneMatch`、`TestApplyEditCoversTextZeroMultipleUnicodeAndWrongType`（0/複数/Unicode/型違い） | pass |
| REQ-C04 | context.Context で cancel | delayed server test | E1 | WP-C3 | implemented | `completeChat` の `NewRequestWithContext`、`TestChatServiceCancelEmitsOneTerminalEvent` | pass |
| REQ-C05 | chat:stream を相関付きで送信 | integration test | E1 | WP-C3 | implemented | OpenAI-compatible SSE を `streamChat` で逐次処理。`TestStreamChatEmitsUTF8DeltasAndAssemblesToolCall` と correlation integration test | pass |
| REQ-C06 | tool start/done/apply event を送信 | integration test | E1 | WP-C3 | implemented | `runAgent` の tool start/done、`ChatService.waitForApplication` の apply、同 integration test | pass |
| REQ-C07 | run ごとに終端 event 1 件 | state test | E1 | WP-C3 | implemented | `ChatService.execute` の単一 terminal emit。cancel/正常終了後も追加 event がないことを integration test で確認 | pass |
| REQ-C08 | system prompt の必須指示 | unit test | E1 | WP-C2 | implemented | tool 後の自然言語応答と JSON 単独出力禁止を含む `agentSystemPrompt`、`TestSystemPromptContainsRequiredInstructions` | pass |
| REQ-C09 | Text/Artifact は baseRevision 一致時だけ edit 適用 | store test | E1 | WP-C4 | implemented | `applyToolProposalToNodes` の一致適用・stale conflict・revision/count 更新を `sprintC.test.ts` で確認 | pass |
| REQ-C10 | write_artifact の create/replace 条件 | tool/store test | E1 | WP-C4 | implemented | `TestWriteArtifactRequiresReadOrExplicitNewDocument`、Frontend の filename collision/create/replace tests | pass |
| REQ-C11 | ToolCard の diff/status 表示 | UI 確認 | E2 | WP-C4 | implemented | `ToolCard.tsx` が tool、対象 node、summary/result、diff、status を表示 | pass |
| REQ-C12 | 記録済み Ollama version/model で roundtrip | 実機ログ・screenshot | E2 | WP-C3 | implemented | Ollama 0.32.7 / `qwen3.5:4b`。受入セッションで `TestOllamaAgentRoundTrip` が read→apply→ack→自然言語応答を 5.65s で再完了（2026-08-11） | pass |
| REQ-C13 | focus node を direct context に含める | request builder test | E1 | WP-C1 | implemented | `buildChatRequestContext` の request snapshot test（target + direct IDs） | pass |
| REQ-C14 | 接続元を traversal 順で direct context に含める | graph fixture test | E1 | WP-C1 | implemented | `sprintC.test.ts` の chain order、branch warning、loop warning/ID uniqueness tests | pass |
| REQ-C15 | list/read canvas tools で任意 node を取得 | index/3 node type test | E1 | WP-C1 | implemented | `TestSevenToolDefinitionsAndReadTools` で list/search と Text/Artifact/Image read、missing node を確認 | pass |
| REQ-C16 | event に run/session/edit correlation を含める | schema/routing test | E1 | WP-C4 | implemented | integration test で全 event の run/session と apply proposal の一意 toolCallId/targetNodeId/baseRevision を確認 | pass |
| REQ-C17 | stale edit を conflict として拒否 | store conflict test | E1 | WP-C4 | implemented | `applyToolProposalToNodes` の stale revision conflict test、Backend acknowledgment status tests | pass |
| REQ-C18 | Text/Artifact は同 revision の read 後のみ変更 | run state test | E1 | WP-C2 | implemented | read 成功時だけ revision を記録。`TestFailedReadArtifactDoesNotAuthorizeEdit` と read/write contract tests | pass |
| REQ-C19 | target なしで全 node 本文を初期送信しない | request builder test | E1 | WP-C1 | implemented | `sprintC.test.ts` で targetless request の direct context が空であることを確認 | pass |
| REQ-C20 | Frontend acknowledgment 後だけ tool success | integration test | E1 | WP-C4 | implemented | `TestChatServiceEmitsStreamToolEventsAndWaitsForAcknowledgment`、timeout と applied/conflict/cancelled/error の status tests | pass |
| REQ-C21 | provider tool call metadata を次 round へ無変更で再送 | payload regression test | E1 | WP-C3 | implemented | `ToolCall.ExtraContent` と stream assembly。`TestAgentPreservesGeminiThoughtSignatureAcrossToolRound` が Gemini署名付き tool call→tool result→次requestを検証 | pass |

### Non-Functional / Compatibility

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-N01 | 旧版は load 時非破壊、次回 save で V1.2 | closure waiver | EX | WP-A2 | implemented | REQ-A07 / A08 の V1.2 save と旧版 load を受理済み。専用 fixture の load-only 非破壊確認は省略 | EX accepted — 専用テスト未実施。形式変更または旧版読込問題の報告時に再検証 |
| REQ-N02 | cold start 中央値が既存の 1.5 倍以内 | closure waiver | EX | WP-QA | implemented | 日常利用で起動性能の課題を感じていないというユーザー判断。5 回測定は未実施 | EX accepted — 定量的な性能退行を見逃す残余リスク。体感悪化時に再計測 |
| REQ-N03 | streaming 操作中に新規 100ms 超 Long Task なし | closure waiver | EX | WP-QA | implemented | 日常利用で操作応答の課題を感じていないというユーザー判断。DevTools 計測は未実施 | EX accepted — Long Task の定量証拠なし。引っ掛かり発生時に再計測 |
| REQ-N04 | `mise run build` 成功 | command output | E1 | WP-QA | implemented | 受入セッションで `mise run build` exit 0、Wails bindings 生成・Windows executable 作成（2026-08-11） | pass |
| REQ-N05 | Frontend TypeScript/Vite build 成功 | command output | E1 | WP-QA | implemented | 受入セッションで Wails production Frontend compile と `test:sprint-c` の Vite build が exit 0 | pass |
| REQ-N06 | secret 実値を source/evidence に保存しない | closure waiver | EX | WP-QA | implemented | 既存の config 経路を維持。専用 secret scan / 差分監査は未実施 | EX accepted — 見落としの残余リスク。credential 経路変更または公開前に再検証 |
| REQ-N07 | Markdown XSS payload が実行されない | closure waiver | EX | WP-QA | implemented | 現行 Markdown 表示を維持。専用 payload test は未実施 | EX accepted — 未信頼本文の安全性を実証していない。外部 Context 取込前に再検証 |
| REQ-N08 | chat history を backend 経由で再起動復元 | UI 再起動確認 | E2 | WP-B2 | implemented | `App.tsx` のload/debounce/切替flush、`ChatSessionService`、load error表示。Save JSON後の再起動Loadで復帰をユーザー確認 | pass |
| REQ-N10 | session を canvasId で分離 | 2 Canvas persistence test | E1 | WP-B2 | implemented | Canvas切替時beginLoad、`TestChatSessionServiceSeparatesCanvases`、JSON wrapper/migration tests、`go test ./...` exit 0 | pass |

`REQ-N09` は廃止済み。ID は再利用しない。

## Plan Checks

| Check | Expected evidence | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- |
| Build | `mise run build` exit 0 | implemented | 2026-08-11 `mise run build` exit 0。bindings/frontend/app compile、`build/bin/fm-doc-canvas.exe` 生成 | pass |
| Frontend build | `mise x -- npm --prefix frontend run build` exit 0 | implemented | Wails production build の TypeScript/Vite compile exit 0 | pass |
| Frontend Sprint C tests | `mise x -- npm --prefix frontend run test:sprint-c` exit 0 | implemented | graph/context/mutation/count/conflict/create tests pass（2026-08-11） | pass |
| Go tests / vet | `mise x -- go test ./...`; `mise x -- go vet ./...` exit 0 | implemented | 両 command exit 0（2026-08-11）。Ollama live test も受入セッションで pass | pass |
| Core E2E | `30_requirement.md` の 1〜9 | implemented | Sprint A〜C の個別ユーザー受理、Go/Frontend tests、build、Ollama/Gemini tool loop を代替証拠とする。一続きの 1〜9 は未実施 | EX accepted — 横断回帰の残余リスク。関連不具合または大きなフロー変更時に再導入 |

## Closure Waivers

2026-08-11、ユーザーは残存していた追加 QA を、現時点で課題を感じておらず計測・実施の便益が低いものとして closure 条件から除外し、本計画を閉じる判断を行った。

- `EX accepted` は試験合格を意味しない。未実施内容、代替証拠、残余リスク、再検討条件を各行へ記録した closure waiver である。
- REQ-N01 は REQ-A07 / A08、Core E2E は Sprint A〜C の個別受理と既存自動検証を代替証拠とする。
- 性能問題、旧版読込問題、credential 経路変更、未信頼 Markdown の取込、横断フロー変更が生じた場合は該当項目を新しい計画で再検証する。

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
| 2026-08-11 | User acceptance + Codex acceptance session | Sprint C accepted | ユーザーが tool の実動作を確認し承認。REQ-B08、REQ-C01〜C21 を pass。Go/Frontend tests、vet、Wails build、Ollama `qwen3.5:4b` roundtrip を再実行し成功。 |
| 2026-08-11 | User closure decision | Plan closed with explicit EX waivers | 残存 QA に現時点の課題を感じていないため、REQ-N01〜N03、N06、N07 と Core E2E を未実施のまま EX として受理。全機能 Sprint は受理済みのため `state: done`。 |

## Abandoned / No-Go Reason

`state: abandoned` の場合だけ記録する。
