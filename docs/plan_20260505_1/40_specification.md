# Implementation Specification

## Technical Stack

- Backend: Go, Wails bound methods.
- Frontend: React 18, TypeScript, Zustand, React Flow, Tailwind CSS.
- External image APIs: OpenRouter Chat Completions image modality, OpenAI Images / Responses image generation tool, Google Gemini `generateContent`, xAI Images API.

## File Structure

- `app.go`: image generation Wails method signature extension or additional provider-aware method.
- `backend/config.go`: image generation config persistence model and backward-compatible unmarshalling.
- `backend/image.go`: provider override dispatch.
- `backend/openrouter.go`: existing OpenRouter generation implementation.
- `backend/openai.go`: existing OpenAI Images / Responses implementation.
- `backend/google.go`: existing Gemini implementation.
- `backend/xai.go`: existing xAI implementation.
- `frontend/src/types/index.ts`: config and image node metadata types.
- `frontend/src/store/useAppStore.ts`: config save/load preservation, provider-aware image generation action, and prompt input handoff state/action.
- `frontend/src/components/layout/PromptBar.tsx`: Image mode provider selector, provider-aware generate call, and externally appended prompt handling.
- `frontend/src/components/drawer/SettingsDrawer.tsx`: provider settings preservation.
- `frontend/src/components/canvas/ImageNode.tsx`: prompt preview rendering and prompt append click behavior.
- `frontend/wailsjs/go/main/App.*`: regenerate if Wails method signatures change.

## Data Model

### Config

Use provider-specific config as the canonical local config shape:

```ts
imageGen: {
  provider: "openrouter" | "openai" | "google" | "xai";
  downloadPath: string;
  openrouter?: { baseURL: string; model: string; apiKey?: string };
  openai?: { baseURL: string; model: string; apiKey?: string };
  google?: { model: string; apiKey?: string };
  xai?: { model: string; apiKey?: string };
}
```

The backend keeps backward-compatible flat fields only for reading older config. Frontend `saveConfig` must not flatten to only the active provider because that drops inactive provider credentials.

### Image Generation Request

Add an explicit request model on the backend side, or add a provider parameter to the bound method:

```go
type ImageGenerationRequest struct {
    Prompt      string   `json:"prompt"`
    ContextData string   `json:"contextData"`
    RefImages   []string `json:"refImages"`
    Provider    string   `json:"provider,omitempty"`
}
```

Preferred Wails method:

```go
func (a *App) GenerateImageWithProvider(prompt string, contextData string, refImages []string, provider string) (string, error)
```

Keep existing `GenerateImage(prompt, contextData, refImages)` as a compatibility wrapper that uses configured default provider.

### Image Node

Extend `ImageNodeData` with optional fields:

```ts
export interface ImageNodeData extends Record<string, unknown> {
  src: string;
  alt?: string;
  prompt?: string;
  provider?: string;
  model?: string;
}
```

For compatibility:

- display prompt source is `data.prompt || data.alt || ""`.
- existing nodes without `prompt` continue to work.
- canvas save remains `version: "1.1"` unless a future migration adds required fields.

### Prompt Input State

PromptBar currently owns prompt text as local React state. To let ImageNode append a prompt into that input, introduce one of these implementation patterns:

- Preferred: move PromptBar prompt text into Zustand as `promptInput` plus `setPromptInput` / `appendPromptInput` actions.
- Acceptable: keep local PromptBar state and expose an app-level append event/subscription if Zustand state would cause unnecessary wider re-renders.

Preferred Zustand shape:

```ts
interface AppState {
  promptInput: string;
  setPromptInput: (value: string) => void;
  appendPromptInput: (value: string) => void;
}
```

Append formatting:

- if current prompt is empty or whitespace-only: set to clicked prompt.
- otherwise append `\n\n` plus clicked prompt.
- ignore empty clicked prompts.

## UI / Screens

### PromptBar

- Image mode displays a compact provider selector near the Text/Image segmented control.
- Selector options: OpenRouter, OpenAI, Google, xAI.
- Initial value:
  - `config.imageGen.provider` on mount/config load.
  - If the global default changes while no local image provider was manually selected, sync to it.
- Submit Image:
  - collect context text and reference images as today.
  - call provider-aware generation with selected provider.
  - create image node with `src`, `alt`, `prompt`, `provider`, and selected model if easily available.
  - keep the existing prompt text node unless product decision later removes it.
- PromptBar textarea value is controlled by shared prompt input state if the preferred Zustand implementation is used.
- After successful text or image generation, PromptBar clears shared prompt input in the same way it currently clears local prompt state.

### SettingsDrawer

- Provider dropdown remains the default provider selector.
- Switching provider in the drawer must not set other provider configs to `undefined`.
- All provider configs should remain present in `localConfig.imageGen` when saving.
- Field groups can still show only the selected provider to keep UI compact.

### ImageNode

- Render image in the main body.
- Render a bottom caption band or compact overlay containing prompt preview.
- Use line clamp or fixed-height caption to avoid node resizing.
- Tooltip/title may expose the full prompt.
- The prompt preview is clickable when `data.prompt || data.alt` is present.
- Clicking the prompt preview calls `appendPromptInput(promptText)`.
- The click handler should stop propagation enough to avoid accidental double-click overlay opening or unwanted canvas selection changes from the caption action.
- Use button semantics for the clickable caption where practical, with visual hover/focus state.
- Imported images without prompt show no caption or a neutral imported-image label only if already present in `alt`.

## Inputs

- Prompt text from PromptBar.
- Prompt text appended from image node prompt preview clicks.
- Selected image generation provider from PromptBar Image mode.
- Default provider and provider-specific credentials from local config.
- Context nodes and reference images from `traverseContextBackwards`.

## Persistence

- Config persists all provider-specific credentials under `os.UserConfigDir()/fm-doc-canvas/config.json`.
- Canvas JSON persists image node prompt metadata, but never API Keys.
- Existing generated images continue to save under `imageGen.downloadPath`.

## Error Handling

- Unknown provider override returns a backend error before sending an external request.
- Missing provider-specific config returns the existing provider config error.
- Missing API Key errors should surface from provider call or be validated before call when straightforward.
- Provider override must not mutate saved config during request dispatch.

## Import / Export

- Canvas save/load includes optional image node prompt metadata.
- Image export behavior remains unchanged.
- Marp export may continue to export only image content; prompt inclusion in Marp is out of scope for MVP.

## Environment Constraints

- Run `mise install` if required tools are missing.
- Run build/format/test through `mise run` or `mise x --`.
- Network-dependent manual testing requires real API keys and may be skipped in automated verification.

## Verification

- Static/build verification: `mise run build`.
- Manual config verification:
  - enter API Keys for at least two providers.
  - switch default provider.
  - save and reload config.
  - verify inactive provider API Key remains.
- Manual generation verification:
  - generate with PromptBar provider A.
  - generate with PromptBar provider B.
  - confirm global default provider is unchanged unless explicitly saved in Settings.
- Canvas verification:
  - generated image node displays prompt preview.
  - clicking the image node prompt preview appends it to an empty PromptBar.
  - clicking the image node prompt preview appends it after existing PromptBar text without deleting the existing text.
  - save and reload canvas.
  - prompt preview remains.
  - old canvas image nodes still render.
