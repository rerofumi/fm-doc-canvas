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
- `app.go`: Wails-bound application facade for config, file, LLM, image generation, and image asset services.
- `backend/config.go`: local configuration schema, defaults, load/save, image path resolution.
- `backend/file.go`: native dialogs, canvas save/load, import, export, image file URL resolution.
- `backend/llm.go`: OpenAI-compatible chat completion calls, text generation, summary generation, vision input.
- `backend/image.go`: image generation provider dispatch.
- `backend/openrouter.go`: OpenRouter image generation using chat completions with image-only modality.
- `backend/openai.go`: OpenAI image generation and Responses API image tool handling.
- `backend/google.go`: Google Generative Language image generation handling.
- `backend/xai.go`: xAI image generation/edit handling.
- `backend/image_asset.go`: image data URL creation and generated image persistence.
- `frontend/src/store/useAppStore.ts`: application state, canvas persistence, generation actions, export actions, React Flow callbacks.
- `frontend/src/types/index.ts`: runtime and persisted canvas types.
- `frontend/src/components/canvas/`: canvas area, text node, image node, image overlay.
- `frontend/src/components/drawer/`: editor and settings drawers.
- `frontend/src/components/layout/`: prompt bar and auto-layout button.

## Data Model

### Runtime Nodes

- Text node: `type: "customNode"`, `data.content`, `data.summary`.
- Image node: `type: "imageNode"`, `data.src`, optional `data.alt`, optional generated `data.prompt`, optional `data.provider`, optional `data.model`.
- Node dimensions are stored on the React Flow node as `width` and `height`.

### Persisted Canvas

- Version `1.0` contains text nodes only.
- Version `1.1` contains mixed text/image nodes.
- Persisted edges include `source`, `target`, optional handles, edge type, and optional marker metadata.
- Saving emits formatted JSON with `version: "1.1"`.

### Local Config

- `llm`: `baseURL`, `model`, optional `apiKey`, optional `systemPrompt`.
- `generation`: `summaryMaxChars`.
- `imageGen`: `provider`, `downloadPath`, provider-specific OpenRouter/OpenAI/Google/xAI settings.
- OpenRouter default image model is `sourceful/riverflow-v2-fast`. The app migrates the previous default `sourceful/riverflow-v2-standard-preview` to this value when loading/saving config.

## UI / Screens

- Header: app title, new node button, auto layout button, settings button.
- Canvas: React Flow background, controls, minimap, custom node types, context menu.
- Editor drawer: Markdown edit mode, preview mode, summary field, summary regeneration, resizable drawer width.
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

## Context Traversal

`traverseContextBackwards` starts at a selected target node, includes the target node, then follows incoming edges upstream. It returns nodes in upstream-to-target order. If a node has more than one incoming edge or a loop is detected, it returns a warning with message `リンク構造にエラーがあります`.

## Persistence

- Config is stored under `os.UserConfigDir()/fm-doc-canvas/config.json`.
- Generated images are saved under the configured `imageGen.downloadPath`.
- Imported images are copied under `downloadPath/Import/`.
- Canvas state persists only through explicit JSON save/load operations.

## Error Handling

- Backend methods return errors for missing Wails context, unsupported file types, dialog failures, file I/O failures, API request failures, non-200 API responses, malformed responses, missing generated output, invalid paths, and missing image files.
- OpenRouter non-200 errors include the configured model and request URL to make model availability and endpoint issues easier to diagnose.
- Frontend catches generation/import/export errors, logs them, and shows alert dialogs for user-visible failures.
- Canvas load errors are rethrown after logging.

## Import / Export

- Import text: `.txt` and `.md` are read into a text node.
- Import image: `.png`, `.jpg`, `.jpeg`, `.webp` are copied into `Import/` and represented as an image node.
- Export text node: saves Markdown content through a native save dialog.
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
