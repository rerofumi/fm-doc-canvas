# FM Doc Canvas Reference Manual

[日本語](reference.md) | [English](reference_en.md)

This document is an operational reference for the features available through the FM Doc Canvas v0.6.0 GUI. It is based on the implementation as of November 23, 2026.

> **GUI Language Note:** In v0.6.0, the application GUI labels are displayed in Japanese. This manual provides English translations alongside the Japanese labels where helpful.

## 1. Purpose of the Application

FM Doc Canvas is a desktop application for placing text and images on an infinite canvas and connecting them with directed edges to organize ideas and source material. It collects context from selected nodes and their upstream chains so you can query OpenAI-compatible LLMs (including Vision and local LLMs) or generate and edit images across multiple image-generation providers.

The canvas acts as a temporary workbench for thinking and research. Finished outputs can be exported as individual Markdown (`.md`) files, image files, or Marp presentation slides (`.md`).

## 2. Interface

v0.6.0 uses a light-themed, **Canvas-First / Low-Chrome** interface without permanent sidebars. Editing, preview, and configuration overlays open only when needed.

### 2.1 Main Canvas

The workspace where you place, select, move, resize, and connect nodes.

- Drag an empty area (or hold `Space` + drag): Pan the canvas.
- Mouse wheel: Zoom in or out between `0.1` and `4.0` (10%–400%).
- Drag and drop from the OS: Import supported files as nodes at the drop position.

### 2.2 Top Floating Toolbar

A floating toolbar centered at the top of the window.

|Item|Action|
|---|---|
|`+ メモ` (+ Memo)|Adds an empty text node near the center of the viewport and selects it.|
|`整頓` (Auto Layout)|Automatically arranges nodes left-to-right (`LR`) while preserving edge connections, then fits the view.|
|`開く` (Open)|Loads a saved Canvas JSON (`.json`) file.|
|`保存` (Save)|Saves the current canvas to a `.json` file (version `1.1`).|
|`設定` (Settings)|Opens the Settings modal.|

The current zoom percentage (e.g. `100%`) is shown in the top-right corner. Click it to fit all nodes into view (`fitView`).

### 2.3 Bottom Command Dock & Context Strip

The AI generation input area centered at the bottom of the screen.

- **Context Strip** (above the dock): Shows the number of text and image items collected from the current selection and upstream chain in real time (`コンテキスト: テキスト X件 / 画像 Y枚`, or `コンテキストなし` when empty). If upstream traversal stops due to a branch merge or cycle, a warning chip is displayed.
- **Mode Toggle**: Switches between `テキスト` (Text — LLM text generation) and `画像` (Image — multi-provider image generation).
- **Provider Selector** (shown in `画像` mode only): Selects `OpenRouter`, `OpenAI`, `Google`, or `xAI` for the current request. This is a per-request override and does not change the saved default provider.
- **Prompt Input**: Auto-resizing textarea. Press `Ctrl+Enter` (`Command+Enter` on macOS) to submit.
- **`送信` (Send) Button**: Submits the prompt. Displays `生成中` (Generating) while running to prevent duplicate submissions.

### 2.4 Text Node Inspector (NodeInspector)

Double-click a text node (or click the hover `詳細を編集` button / right-click and choose `編集`) to slide open the detail editor on the right side. Drag its left edge to resize its width (`340px`–`900px`, up to `85vw`).

|Item|Action|
|---|---|
|`編集` (Edit)|Edits the Markdown source text.|
|`プレビュー` (Preview)|Renders GitHub Flavored Markdown (GFM).|
|`Markdown 出力` (Export Markdown)|Exports the current content (or summary if content is empty) as a `.md` file.|
|`×`|Closes the inspector and commits changes. Switching to another node also commits automatically.|
|`サマリー` (Summary)|Short summary displayed on the card. Editable directly (if empty, the beginning of the body is shown).|
|`サマリー生成` (Generate Summary)|Regenerates the summary from the current body text using the configured LLM.|
|`元プロンプト` (Original Prompt)|Shown for AI-generated nodes only. Click `入力欄へ追記` (Append to Input) to append it to the Command Dock without erasing existing text.|

### 2.5 Image Lightbox (ImageLightbox)

Double-click an image node (or click the hover `拡大表示` button / right-click and choose `拡大表示`) to open an enlarged preview modal. Close it with `×`, by clicking the backdrop, or by pressing `Escape`.

- The header shows the provider badge and model name (or file path for imported images) and an `画像をエクスポート` (Export Image) button.
- For AI-generated images, the footer displays the full `生成プロンプト` (Generation Prompt) with an `入力欄へ追記` (Append to Input) button.

### 2.6 Settings Modal (SettingsModal)

Click `設定` in the top toolbar to open Settings. It has three tabs: `LLM 設定` (LLM Settings), `画像生成` (Image Generation), and `キャンバス管理` (Canvas Management). See "8. Settings" for details.

### 2.7 Toast Notifications & Confirmation Dialogs

Completions, warnings (such as rejected cyclic edges or branch-merge stops), and errors appear as non-blocking toast notifications. Destructive actions such as `キャンバスを初期化` (Clear Canvas) require confirmation in a dialog.

## 3. Node Types

### 3.1 Text Node

Holds notes, Markdown text, and AI responses.

- Displays `要約` (Summary) if a summary is set, or `メモ` (Memo) showing the body text, clamped to 8 lines.
- Hovering over the card reveals `詳細を編集` (Edit) and `ノードを削除` (Delete) buttons in the top-right corner.
- AI-generated text nodes show a `Prompt:` footer (up to 3 lines). Clicking it appends the original prompt to the Command Dock without overwriting existing input (separated by `\n\n` if text is already present).

### 3.2 Image Node

Displays an imported local image or an AI-generated image.

- When selected, drag the resize handles around the card to resize it (minimum `180×140`).
- Hovering over the card reveals `拡大表示` (Enlarge) and `ノードを削除` (Delete) buttons.
- Generated image nodes show a `Prompt:` footer with a provider badge; clicking it appends the prompt to the Command Dock.
- Image nodes can be passed as visual context for LLM Vision queries or as reference images for image generation.

## 4. Selection, Directed Edges, and Context Collection

### 4.1 Selecting and Deleting Nodes

- Click: Select a single node.
- `Shift` + Click: Add or remove nodes from a multi-selection.
- `Shift` + Drag: Draw a selection box to select multiple nodes.
- Click an empty area: Clear selection.
- `Delete` or `Backspace`: Delete selected nodes or edges.

### 4.2 Directed Edges and Cycle Prevention

Drag from a node's right handle (source) to another node's left handle (target) to create a directed edge with an arrowhead.

- Duplicate edges between the same source and target are ignored.
- Edges that would form a direct or indirect cycle (including self-loops) are detected before creation and rejected with a warning toast.

### 4.3 Context Collection Rules

When you submit a prompt from the Command Dock, context is collected according to your selection and directed edges:

|Selection|Collection Rule|
|---|---|
|0 nodes selected|Sends only the prompt entered in the Command Dock.|
|1 node selected|Traverses incoming edges upstream from the selected node and collects text and image items in order (root → selected node). If traversal encounters a branch merge (2 or more incoming edges) or a cycle, it stops before that point and shows a warning in the Context Strip.|
|2+ nodes selected|Orders the selected nodes using topological sort based on edges among them (breaking ties by `x` position, then `y` position, then selection order), collecting text and image items separately. If a cycle exists among selected nodes, remaining nodes fall back to layout order with a warning.|

## 5. Context Menus

Available menu items depend on what you right-click. Press `Escape` or click outside to close.

### 5.1 Right-clicking a Text Node

|Item|Action|
|---|---|
|`編集` (Edit)|Opens the Text Node Inspector.|
|`Markdown 出力` (Export Markdown)|Exports the node content as a `.md` file.|
|`Marp 出力` (Export Marp)|Exports this node and its upstream chain as Marp Markdown (`.md`).|
|`削除` (Delete)|Deletes the node.|

### 5.2 Right-clicking an Image Node

|Item|Action|
|---|---|
|`拡大表示` (Enlarge)|Opens the Image Lightbox.|
|`画像出力` (Export Image)|Exports the image file.|
|`Marp 出力` (Export Marp)|Exports this node and its upstream chain as Marp Markdown (`.md`).|
|`削除` (Delete)|Deletes the node.|

### 5.3 Right-clicking Multiple Selected Nodes

|Item|Action|
|---|---|
|`Marp 出力（N件）` (Export Marp — N items)|Exports the selected nodes in topological/layout order as Marp Markdown.|
|`選択ノードを削除` (Delete Selected Nodes)|Deletes all selected nodes.|

### 5.4 Right-clicking an Edge

|Item|Action|
|---|---|
|`エッジを削除` (Delete Edge)|Deletes the edge.|

## 6. AI Generation Features

### 6.1 Text Generation (`テキスト` Mode)

Generates text using an OpenAI-compatible API (`POST {baseURL}/chat/completions`).

1. Select any nodes you want to include as context (optional).
2. Switch the Command Dock to `テキスト` and enter your instruction or question.
3. Click `送信` or press `Ctrl+Enter` (`Command+Enter` on macOS).
4. On completion, a new text node is placed to the right of the anchor node and connected with directed edges.

- **Vision (Image Input)**: When collected context includes image nodes, they are sent as multimodal Vision inputs. Configure a Vision-capable model.
- **Local LLM Support**: When `API Key` is left blank, the `Authorization` header is omitted so you can connect to unauthenticated local LLM servers (such as Ollama or LocalAI).
- **Auto Summary**: After text generation succeeds, a summary is automatically generated for the card. If summary generation fails, the body text is preserved and an error toast is shown.

### 6.2 Image Generation (`画像` Mode)

Generates or edits images using four supported providers: OpenRouter, OpenAI, Google, and xAI.

1. Optionally select reference image nodes and/or text nodes with instructions.
2. Switch the Command Dock to `画像` and choose a provider.
3. Enter a prompt and click `送信` or press `Ctrl+Enter` (`Command+Enter` on macOS).
4. The generated image is saved locally in `画像保存先ディレクトリ` with a collision-free filename, and a single new image node is added to the canvas.

**Reference Image Handling by Provider**:

- **OpenAI**: Uses the Images API when no reference images are provided, and the Responses API when reference images are included (up to 5 reference images).
- **xAI**: Uses `/v1/images/generations` without reference images, or `/v1/images/edits` with the first reference image.
- **OpenRouter / Google**: Sends reference images along with the prompt (multi-image and editing support depend on the selected model).

## 7. Importing, Saving, and Exporting Files

### 7.1 Importing Files via Drag and Drop

Drag supported files from your OS file manager onto the canvas to create nodes at the drop position.

|Type|Supported Extensions|Result|
|---|---|---|
|Text|`.txt`, `.md`|Reads the file and adds a new text node.|
|Image|`.png`, `.jpg`, `.jpeg`, `.webp`|Copies the file into `<downloadPath>/Import/` with a collision-free filename and adds a new image node.|

Unsupported extensions or read/copy failures show an error toast.

### 7.2 Saving and Opening a Canvas

- **Save (`保存`)**: Saves the canvas to a user-chosen `.json` file (version `1.1`), including nodes, edges, positions, sizes, and safe metadata. Secrets such as API keys are never written to Canvas JSON.
- **Open (`開く`)**: Loads a saved `.json` file. Compatible with existing `v1.0` and `v1.1` Canvas JSON files.

Unsaved edits are lost when the application exits, so save your work explicitly.

### 7.3 Single-Node Export

- **Text Node**: Export as `.md` from the context menu (`Markdown 出力`) or the Text Node Inspector (`Markdown 出力`).
- **Image Node**: Export in the original image format from the context menu (`画像出力`) or the Image Lightbox (`画像をエクスポート`).

### 7.4 Exporting Marp Slides

Right-click a node and choose `Marp 出力` (or `Marp 出力（N件）` when multiple nodes are selected).

- From a single node, exports that node and its upstream chain; from a multi-selection, exports the selected nodes in topological/layout order.
- Prepends Marp frontmatter (`marp: true`, `paginate: true`) and separates each node with `---`.
- Text nodes become slide Markdown; image nodes are embedded as `![bg contain](file://...)` (or `<!-- image missing: ... -->` if the file cannot be resolved).

## 8. Settings

Click `設定` in the top toolbar to open Settings, then click `保存` (Save) to apply changes (`キャンセル` or `Escape` discards changes).

### 8.1 `LLM 設定` (LLM Settings) Tab

|Item|Description|
|---|---|
|`Base URL`|OpenAI-compatible API endpoint (e.g. `https://api.openai.com/v1`, `http://localhost:11434/v1`).|
|`Model`|Model name used for text generation and summaries. Specify a Vision-capable model when sending image context.|
|`API Key`|API key for the LLM provider. Toggle visibility with the eye icon. Leave blank for local LLMs that do not require auth.|
|`System Prompt`|Shared system instructions for text generation. When blank, the built-in default system prompt is used.|
|`サマリー最大文字数目安` (Summary Max Chars)|Target maximum character count for auto-generated summaries (`10`–`2000`, default `100`).|

### 8.2 `画像生成` (Image Generation) Tab

|Item|Description|
|---|---|
|`デフォルトプロバイダー` (Default Provider)|Default image-generation provider (`OpenRouter`, `OpenAI`, `Google`, or `xAI`).|
|`画像保存先ディレクトリ` (Image Download Directory)|Storage directory for generated and imported images. Default relative path is `Image/`.|
|`プロバイダー別設定` (Per-Provider Settings)|Switch tabs to configure each of the 4 providers independently. Changing the default provider preserves all other providers' keys and models.|

Per-provider defaults:

|Provider|Base URL (Default)|Model (Default)|API Key|
|---|---|---|---|
|`OpenRouter`|`https://openrouter.ai/api/v1`|`sourceful/riverflow-v2-fast`|Required|
|`OpenAI`|`https://api.openai.com/v1`|`gpt-image-1.5`|Required|
|`Google`|(Fixed endpoint)|`gemini-2.5-flash-image`|Required|
|`xAI`|(Fixed endpoint)|`grok-imagine-image`|Required|

### 8.3 `キャンバス管理` (Canvas Management) Tab

- **`キャンバスを初期化（Clear Canvas）`**: After confirmation, deletes all nodes, edges, selections, and active edits on the canvas. This action cannot be undone. Saved image files on disk remain intact.

## 9. Stored Data and Security

### 9.1 Application Settings (`config.json`)

Settings are stored per OS at:

- **Windows**: `%APPDATA%\fm-doc-canvas\config.json`
- **macOS**: `~/Library/Application Support/fm-doc-canvas/config.json`
- **Linux**: `~/.config/fm-doc-canvas/config.json`

Legacy flat `imageGen` fields (`baseURL`, `model`, `apiKey`) are automatically migrated into the per-provider structure on load.

> **Security Note:** API keys are stored in plaintext only in local `config.json` and are never written to Canvas JSON, logs, or error messages. Do not share `config.json` in public repositories or with third parties.

### 9.2 Canvas Data

Saved via `保存` to a user-selected `.json` file. No credentials or secrets are stored in Canvas JSON.

### 9.3 Image Files and Path Validation

Generated images are stored in the configured `画像保存先ディレクトリ` (default `Image/`), and dropped images are copied into its `Import/` subdirectory. Path traversal (`..`, absolute paths, or paths escaping the download directory) is rejected when resolving, reading, or exporting images.

When moving a Canvas JSON file to another computer, move the image storage directory along with it.

## 10. Keyboard Shortcuts

|Action|Key|
|---|---|
|Submit from Command Dock|`Ctrl+Enter` (`Command+Enter` on macOS)|
|Multi-select / Box select|`Shift` + Click / `Shift` + Drag|
|Pan canvas|`Space` + Drag (or drag empty area)|
|Delete selected nodes or edges|`Delete` or `Backspace`|
|Close context menu, lightbox, settings modal, or dialog|`Escape`|

## 11. Troubleshooting

### The Send Button Is Disabled

- Confirm the prompt input is not empty.
- Check whether another generation request is currently in progress (`生成中`).

### Text or Image Generation Fails

- Check `Base URL`, `Model`, and `API Key` in Settings.
- In `画像` mode, confirm that the provider currently selected in the Command Dock has its API key and model configured.
- When including image nodes in text generation, make sure your configured LLM model supports Vision input.

### Cannot Connect Two Nodes with an Edge

- Duplicate edges in the same direction and edges that would create a cycle (loop) are rejected. Check the direction and existing connections.

### A Warning Appears in the Context Strip

- When 1 node is selected and upstream traversal encounters a branch merge (2+ incoming edges) or a cycle in loaded data, traversal stops before that point to avoid ambiguous ordering. To combine multiple branches, select the desired nodes explicitly using `Shift` + Click or box selection.

### Images Are Missing After Opening a Canvas

- Canvas JSON references local image paths rather than embedding image binaries. Verify that the original image download directory and its `Import/` folder are present and match `画像保存先ディレクトリ` in Settings.

## 12. Basic Workflow Examples

### Organize Notes into a Marp Presentation

1. Add notes using `+ メモ` in the top toolbar, or drag and drop `.txt` / `.md` files onto the canvas.
2. Connect related nodes left-to-right with directed edges.
3. Select the final node, set the Command Dock to `テキスト`, and ask the LLM to organize the upstream notes into a slide outline.
4. Double-click the generated text node and refine it in the Node Inspector (`編集` / `プレビュー`).
5. Select the nodes to include (or right-click the final node to include its upstream chain) and choose `Marp 出力` to export a `.md` slide deck.

### Create Image Variations from a Reference Image

1. Drag and drop a `.png`, `.jpg`, `.jpeg`, or `.webp` file onto the canvas.
2. Optionally add a text node describing the desired edits and select both nodes.
3. Switch the Command Dock to `画像`, pick a provider, enter a prompt, and submit.
4. Double-click the resulting image node to inspect it in the Lightbox; click `入力欄へ追記` to reuse and tweak the prompt if needed.
5. Right-click the finished image and choose `画像出力` (or `画像をエクスポート` in the Lightbox) to save it.
