# Implementation Specification

## GUI / Assistant as-built (2026-08-17)

- `useChatStore`がAssistant mode、Canvas別draft、Image Provider、single active operation、Chat session load/saveのauthorityである。
- Direct Text/Imageはworkspace/canvas/runtime generation/scope epoch/selection revisionのsnapshotを適用直前に再検証する。
- Chat session persistenceは`isDefaultTitle`を持つ。markerなしlegacy dataは完全一致`新しい会話`だけをdefaultとして移行し、保存はCanvas単位の順序queueとbackend atomic renameを使用する。
- SubCanvas parent lift/dissolveは共通の決定的配置helperを使用し、domain command、runtime cleanup、freshness invalidation、snapshot Undoを一体で適用する。
- Chat eventはrun単位のmonotonic sequenceで並べ替える。frontend queueはboundedで、terminal/gap/overflowをcleanupし、異常時は一致するrunだけをfail-closedで終了する。

## Technical Stack

- Desktop shell: Wails v2.
- Backend: Go package `main` and `backend`.
- Frontend: React 18, TypeScript, Vite, Tailwind CSS.
- Canvas: `@xyflow/react`.
- State: Zustand.
- Layout: Dagre.
- Markdown rendering: `react-markdown` with `remark-gfm`.

## File Structure

- `main.go`: Wails app bootstrapping, window options, asset embedding, drag-and-drop enablement.
- `app.go`: Wails-bound application facade for config, file, LLM, image generation, image asset, chat session, and chat agent services.
- `backend/config.go`: local configuration schema, defaults, load/save, image path resolution.
- `backend/file.go`: native dialogs, canvas save/load, import, export, image file URL resolution.
- `backend/llm.go`: OpenAI-compatible chat completion calls, text generation, summary generation, vision input, streaming response handling.
- `backend/chat_session.go`: legacy session API compatibility。active Dialogueはmemory-onlyであり永続化しない。
- `backend/canvas_snapshot.go`: request-local Canvas snapshot の検証と index。
- `backend/agent_types.go`, `agent_loop.go`, `system_prompt.go`: tool contract、最大 10 round の agent loop、provider metadata 保持、system prompt。
- `backend/chat_service.go`: run lifecycle、Wails event、cancel、Frontend acknowledgment の管理。
- `backend/image.go`: image generation provider dispatch.
- `backend/openrouter.go`: OpenRouter image generation using chat completions with image-only modality.
- `backend/openai.go`: OpenAI image generation and Responses API image tool handling.
- `backend/google.go`: Google Generative Language image generation handling.
- `backend/xai.go`: xAI image generation/edit handling.
- `backend/image_asset.go`: image data URL creation and generated image persistence.
- `frontend/src/store/useAppStore.ts`: Workspace domain state、Canvas navigation、transform / Relation lifecycle、persistence、React Flow projection。
- `frontend/src/store/useChatStore.ts`: Canvas 別 session、message、active run、target の UI state。
- `frontend/src/types/index.ts`: runtime and persisted canvas types.
- `frontend/src/components/canvas/`: canvas area, text node, Artifact node, image node, image overlay.
- `frontend/src/components/drawer/`: editor, Chat, settings drawers.
- `frontend/src/components/chat/`: Chat header/input/message list、ToolCard。
- `frontend/src/utils/chatContext.ts`, `toolApplication.ts`, `chatSession.ts`: direct context、mutation acknowledgment、transport/UI session 変換。
- `frontend/src/components/layout/`: prompt bar and auto-layout button.

## Data Model

### Runtime Nodes

- Text node: `type: "customNode"`, `data.content`, `data.summary`.
- Artifact node: `type: "artifactNode"`, `data.filename`, `data.language`, `data.content`, `data.summary`, `data.revision`, `data.charCount`, `data.wordCount`, optional edit metadata.
- Image node: `type: "imageNode"`, `data.src`, optional `data.alt`, optional generated `data.prompt`, optional `data.provider`, optional `data.model`.
- Text node は競合検出用の `revision` を保持し、旧データで欠落する場合は 0 として扱う。
- Node dimensions are stored on the React Flow node as `width` and `height`.

### Persisted Canvas

- Version `1.0` contains text nodes only.
- Version `1.1` contains mixed text/image nodes.
- Version `1.2` is a legacy text/image/Artifact format with `metadata.canvasId`.
- Version `1.3` contains Workspace / Canvas tree、text/image/Artifact nodes、typed Relation、reason、provenance。
- Persisted edges include `source`, `target`, optional handles, edge type, and optional marker metadata.
- Saving emits formatted JSON with `version: "1.3"`.
- 旧versionはload時にWorkspace/Canvas/revisionをmigrationし、loadだけでは元ファイルを書き換えない。

### Local Config

- `llm`: `baseURL`, `model`, optional `apiKey`, optional `systemPrompt`.
- `generation`: `summaryMaxChars`.
- `imageGen`: `provider`, `downloadPath`, provider-specific OpenRouter/OpenAI/Google/xAI settings.
- OpenRouter default image model is `sourceful/riverflow-v2-fast`. The app migrates the previous default `sourceful/riverflow-v2-standard-preview` to this value when loading/saving config.

## UI / Screens

- Header: app title, new Text / Artifact buttons, auto layout button, Chat toggle, settings button.
- Canvas: React Flow background, controls, minimap, custom node types, context menu.
- Editor drawer: Text / Artifact の Markdown edit/preview、summary、Artifact filename、count、summary regeneration、resizable drawer width. Preview と Artifact Node は共通 `MarkdownContent` を使い、全 anchor の既定遷移を抑止する。絶対 HTTP(S) だけを Wails `BrowserOpenURL` へ渡す。
- Chat drawer: target 表示、Canvas 内 session 作成／切替、message stream、Stop、ToolCard、resizable drawer width.
- Settings drawer: file operations, LLM settings, image generation provider settings, generation settings, canvas clearing.
- Prompt bar: Text / Image mode toggle, selected-node indicators, request-level image provider selector in Image mode, prompt textarea, submit button.
- Image node prompt preview: generated image nodes show a compact prompt caption. Clicking the caption appends that prompt to the shared Prompt bar input without deleting existing text.
- Canvas breadcrumb: root〜Current Canvas pathを表示する。`Parent`は`parentCanvasId`へ1階層移動し、rootではdisabled。document mutation history / Undoとは独立する。
- Transform / Relation: modifier multi-selection、Direct summarize / compare / counterpoint、Proposal comparison / Modify / Accept / Reject、post-apply diff / Undo、Relation editorを提供する。

## Inputs

- Text prompt from the prompt bar.
- Prompt text appended from image node prompt captions.
- Request-level image provider selected in the prompt bar Image mode.
- Selected nodes and upstream nodes collected via `traverseContextBackwards`.
- Drag-and-dropped files with supported extensions.
- Native file dialogs for save/load/export.
- API settings from the settings drawer.
- Chat prompt、active target、upstream direct context、request-local Canvas snapshot。

## Context Traversal

Context ResolverはCurrent Canvas、明示selection、exclusion、accepted Relation / provenanceを正本としてbody allowlistを構築する。別Canvas本文、未採用Proposal、excluded bodyを暗黙送信しない。

Chat request は target と traversal 結果だけを初期 direct context に含める。target がない場合は Canvas 全文を送らない。snapshot 全体はローカル Backend が request 単位で保持し、LLM は `list_canvas_nodes`、`read_canvas_node`、Artifact 専用 read/list/search tool で必要なノードだけを追加取得する。

ChatDrawer は現在の user message を session へ append する前に履歴を取得し、`ChatRequest.history` の `ChatHistoryMessage` として送る。Frontend は完了済み user / assistant の最新12件に絞り、Backend は role、非空、上限を再検証する。本文は空判定以外で正規化せず完全保持し、provider message は `system → history → current user` の順とする。Canvas direct context と vision payload は current user message にだけ付与する。

`create_text_node` は明示的な新規 Text Node 作成専用 tool であり、`role: text` を `ToolApplyProposal` から Frontend proposal / domain `create-text` command へ伝搬する。Backend の role 共通 `creationIntent(prompt, role)` は current prompt だけを認可対象とし、自然な日本語・英語の対象roleと作成動作を要求する。否定・取消と既存node編集を優先して拒否し、過去履歴や短い了承だけでは作成を許可しない。role がない legacy `write_artifact` create event は後方互換として Artifact を作成する。Node作成は既存の acknowledgment、run freshness、単一 Undo 経路を使う。

明示作成guardの拒否だけは `creationGuardError` を使い、Textでは `新しい Text Node を作成してください`、Artifactでは `新しい Artifact Node を作成してください` を現在のメッセージへ明記して再送するよう案内し、変更未適用も示す。引数不備、provider/tool error、node_id付き既存Artifact編集errorにはこの案内を付加しない。

Text / Artifact の mutation は `read_canvas_node` または `read_artifact` が成功した同一 run / revision を要求する。Backend は mutation proposal を event で送り、Frontend が revision を再確認して返す acknowledgment が `applied` の場合だけ tool success とする。

## Persistence

- Config is stored under `os.UserConfigDir()/fm-doc-canvas/config.json`.
- Generated images are saved under the configured `imageGen.downloadPath`.
- Imported images are copied under `downloadPath/Import/`.
- Canvas state persists only through explicit JSON save/load operations.
- Dialogue sessions are memory-only and are not written to Canvas JSON or the application config area.

## Collaborative Transform & Relation

- Direct Actionはdedicated one-shot backend requestを使い、最新Workspace/Canvas/generation/scope/source revisionをawait後に再検証する。
- Dialogue / Agentはstructured Transform / Relation Proposalを生成し、document mutation前にsource-output comparisonとdecision UIを表示する。
- Accept / Modifyまたは検証済みDirect resultはderived Text Node、provenance、approved Relationを一つのhistory transactionで適用する。
- Relation reverseはendpointを交換し、React Flowのsource/target handle roleを維持する。
- rejected / stale / cancelled / invalid resultはdocument、history、revision、selectionを変更しない。

## Error Handling

- Backend methods return errors for missing Wails context, unsupported file types, dialog failures, file I/O failures, API request failures, non-200 API responses, malformed responses, missing generated output, invalid paths, and missing image files.
- OpenRouter non-200 errors include the configured model and request URL to make model availability and endpoint issues easier to diagnose.
- Frontend catches generation/import/export errors, logs them, and shows alert dialogs for user-visible failures.
- Canvas load errors are rethrown after logging.
- Chat agent run は run/session/toolCall ID で相関し、Stop、timeout、conflict、acknowledgment error を終端状態として返す。

## Collaboration Orchestration

- `SuggestNextActions`は専用system promptとkind別shape契約を使うone-shot plannerであり、provider設定の汎用system promptへfallbackしない。
- Frontend Context Resolverは明示Focus、bounded Dialogue、selection、accepted Relation、Generated View hintを区別する。未選択時だけCurrent CanvasのText-bearing Nodeをbounded fallbackに使い、execution targetは暗黙補完しない。
- Action Proposalはruntime-onlyで、clarify / compare / counterpoint / web_search / suggest_relations / suggest_clustersを固定role / AL / routeへmappingする。
- proposal panelは最大50vhの独立scroll領域とし、ChatInputを表示したまま長文cardへアクセスできる。
- child actionは一つだけdispatchし、既存Direct Transform、Context Packet、Relation / Cluster Proposal、Dialogueを主result surfaceとして再利用する。
- Gemini OpenAI互換のtool continuationではassistant tool callとtool resultの`tool_call_id`、function `name`、thought signatureを保持する。

## Import / Export

- Import text: `.txt` and `.md` are read into a text node.
- Import image: `.png`, `.jpg`, `.jpeg`, `.webp` are copied into `Import/` and represented as an image node.
- Export Text / Artifact node: saves Markdown content through a native save dialog. Artifact は filename を既定名に使う。
- Export image node: resolves the image path and copies it to the chosen destination.
- Export Marp: traverses selected nodes plus upstream context, topologically orders included nodes, and writes a Marp Markdown document.

## Environment Constraints

- Use `mise install` before development if required tools are missing.
- Run Go, npm, and Wails commands through `mise x --` or `mise run`.
- Network-dependent generation requires valid provider credentials and external API availability.

## Verification

- Build: `mise run build`.
- Static frontend build: Wails build runs `npm run build`, which invokes `tsc && vite build`.
- Manual verification should cover node editing, connection traversal warnings, generation modes, image import/display, JSON save/load, settings persistence, and export paths.
- Chat / agent verification should cover target context、memory-only lifetime、tool read/edit、revision conflict、Stop、ToolCard status。
- F2 verification covers real modifier selection、Proposal lifecycle、Direct diff/Undo、Relation create/edit/reverse/remove、accepted-only Context、stale no-op。
- F6 verification coversF6-01〜07、real-canvas相当fallback、long proposal scroll、strict provider/tool continuation。Core E2Eは41件pass。
- Plan-defined automated checks include Go tests/vet, Frontend Sprint C tests, and Wails production build through `mise`.
