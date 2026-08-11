# Implementation Specification

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
- `backend/chat_session.go`: `canvasId` ごとの chat session load/save と旧一時形式の migration。
- `backend/canvas_snapshot.go`: request-local Canvas snapshot の検証と index。
- `backend/agent_types.go`, `agent_loop.go`, `system_prompt.go`: tool contract、最大 10 round の agent loop、provider metadata 保持、system prompt。
- `backend/chat_service.go`: run lifecycle、Wails event、cancel、Frontend acknowledgment の管理。
- `backend/image.go`: image generation provider dispatch.
- `backend/openrouter.go`: OpenRouter image generation using chat completions with image-only modality.
- `backend/openai.go`: OpenAI image generation and Responses API image tool handling.
- `backend/google.go`: Google Generative Language image generation handling.
- `backend/xai.go`: xAI image generation/edit handling.
- `backend/image_asset.go`: image data URL creation and generated image persistence.
- `frontend/src/store/useAppStore.ts`: application state, canvas persistence, generation actions, export actions, React Flow callbacks.
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
- Version `1.2` contains text/image/Artifact nodes and `metadata.canvasId`.
- Persisted edges include `source`, `target`, optional handles, edge type, and optional marker metadata.
- Saving emits formatted JSON with `version: "1.2"`.
- V1.0 / V1.1 は load 時に runtime `canvasId` と不足 revision を補い、load だけでは元ファイルを書き換えない。

### Local Config

- `llm`: `baseURL`, `model`, optional `apiKey`, optional `systemPrompt`.
- `generation`: `summaryMaxChars`.
- `imageGen`: `provider`, `downloadPath`, provider-specific OpenRouter/OpenAI/Google/xAI settings.
- OpenRouter default image model is `sourceful/riverflow-v2-fast`. The app migrates the previous default `sourceful/riverflow-v2-standard-preview` to this value when loading/saving config.

## UI / Screens

- Header: app title, new Text / Artifact buttons, auto layout button, Chat toggle, settings button.
- Canvas: React Flow background, controls, minimap, custom node types, context menu.
- Editor drawer: Text / Artifact の Markdown edit/preview、summary、Artifact filename、count、summary regeneration、resizable drawer width.
- Chat drawer: target 表示、Canvas 内 session 作成／切替、message stream、Stop、ToolCard、resizable drawer width.
- Settings drawer: file operations, LLM settings, image generation provider settings, generation settings, canvas clearing.
- Prompt bar: Text / Image mode toggle, selected-node indicators, request-level image provider selector in Image mode, prompt textarea, submit button.
- Image node prompt preview: generated image nodes show a compact prompt caption. Clicking the caption appends that prompt to the shared Prompt bar input without deleting existing text.

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

`traverseContextBackwards` starts at a selected target node, includes the target node, then follows incoming edges upstream. It returns nodes in upstream-to-target order. If a node has more than one incoming edge or a loop is detected, it returns a warning with message `リンク構造にエラーがあります`.

Chat request は target と traversal 結果だけを初期 direct context に含める。target がない場合は Canvas 全文を送らない。snapshot 全体はローカル Backend が request 単位で保持し、LLM は `list_canvas_nodes`、`read_canvas_node`、Artifact 専用 read/list/search tool で必要なノードだけを追加取得する。

Text / Artifact の mutation は `read_canvas_node` または `read_artifact` が成功した同一 run / revision を要求する。Backend は mutation proposal を event で送り、Frontend が revision を再確認して返す acknowledgment が `applied` の場合だけ tool success とする。

## Persistence

- Config is stored under `os.UserConfigDir()/fm-doc-canvas/config.json`.
- Generated images are saved under the configured `imageGen.downloadPath`.
- Imported images are copied under `downloadPath/Import/`.
- Canvas state persists only through explicit JSON save/load operations.
- Chat sessions are stored separately under the application config area as `chat-sessions.json`, grouped by `canvasId`.

## Error Handling

- Backend methods return errors for missing Wails context, unsupported file types, dialog failures, file I/O failures, API request failures, non-200 API responses, malformed responses, missing generated output, invalid paths, and missing image files.
- OpenRouter non-200 errors include the configured model and request URL to make model availability and endpoint issues easier to diagnose.
- Frontend catches generation/import/export errors, logs them, and shows alert dialogs for user-visible failures.
- Canvas load errors are rethrown after logging.
- Chat agent run は run/session/toolCall ID で相関し、Stop、timeout、conflict、acknowledgment error を終端状態として返す。

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
- Chat / agent verification should cover target context、session restore、tool read/edit、revision conflict、Stop、ToolCard status。
- Plan-defined automated checks include Go tests/vet, Frontend Sprint C tests, and Wails production build through `mise`.
