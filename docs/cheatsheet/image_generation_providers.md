# Image Generation Provider API Cheatsheet

Confirmed: 2026-05-05

This cheatsheet summarizes external API behavior that affects the current image generation provider implementations. The local source of truth for exact request payloads remains:

- `backend/openrouter.go`
- `backend/openai.go`
- `backend/google.go`
- `backend/xai.go`
- `backend/image.go`

## OpenRouter Image Generation

- Current local implementation uses `POST {baseURL}/chat/completions`.
- Required payload shape:
  - `model`: configured model id.
  - `messages`: single user message.
  - `modalities`: currently `["image", "text"]`.
- Official docs state image generation models are identified by `image` in `output_modalities`.
- Official docs allow `modalities: ["image", "text"]` for text+image output models and `["image"]` for image-only models.
- Response image is expected in `choices[0].message.images[].image_url.url`.
- OpenRouter documents generated images as base64 data URLs, commonly PNG.
- Local implementation also scans `message.content` for a `data:image/...;base64,...` fallback.
- Implementation caveat: if image-only models fail with `["image", "text"]`, consider model-aware modality selection.

## OpenAI Images API

- Current local no-reference implementation uses `POST {baseURL}/images/generations`.
- Payload includes:
  - `model`
  - `prompt`
  - `n: 1`
  - `response_format: "b64_json"` for DALL-E models or non-OpenAI-compatible base URLs.
- Official docs describe the Images API as supporting generation, edits, and DALL-E 2 variations.
- Official docs state current image generation is available through both Images API and Responses API.
- Local implementation expects `data[0].b64_json` and saves it as a PNG data URL.

## OpenAI Responses API Image Generation Tool

- Current local reference-image implementation uses `POST {baseURL}/responses`.
- Top-level `model` is a text-capable controller model.
- Local implementation uses candidates such as `gpt-5`, `gpt-5-mini`, and `gpt-4o-mini`.
- If configured model starts with `gpt-image-`, local code treats it as the image generation tool model, not as the top-level Responses model.
- Payload uses:
  - `input[].content[]` with `input_text` and `input_image`.
  - `tools: [{ "type": "image_generation" }]`.
  - `tool_choice: { "type": "image_generation" }`.
- Official docs state image output is returned as an `image_generation_call` with base64 `result`.
- Official docs state the image generation tool can use GPT Image models and that Responses API model should be a supported mainline model, while the tool performs the image generation.
- Local implementation reads first `output[].type == "image_generation_call"`, detects `output_format`, and saves `result` as PNG/JPEG/WebP data URL.
- Local implementation limits reference images to 5.

## Google Gemini Image Generation

- Current local implementation uses `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
- Payload uses `contents[].parts[]`.
- Text prompt is sent as `{ "text": fullPrompt }`.
- Reference images are converted from data URLs to:
  - `inline_data.mime_type`
  - `inline_data.data`
- Official Gemini image generation docs show `gemini-2.5-flash-image` with `generateContent`, inline image inputs, and image results returned in `inlineData`.
- Local implementation expects image output in `candidates[0].content.parts[].inlineData`.
- Implementation caveat: older preview image models may require explicit response modalities, but the current default `gemini-2.5-flash-image` examples do not require local code changes.

## xAI Image Generation / Edits

- Current local no-reference implementation uses `POST https://api.x.ai/v1/images/generations`.
- Current local reference-image implementation uses `POST https://api.x.ai/v1/images/edits`.
- Payload includes:
  - `model`
  - `prompt`
  - `response_format: "b64_json"`
  - `n: 1`
  - first reference image as `image.url` only when provided.
- Official docs state `n` supports 1-10 images and `response_format` supports `url` or `b64_json`.
- Official docs state `quality`, `size`, and `style` are not currently supported.
- Local implementation treats xAI generated base64 as JPEG data URL.
- Local implementation supports only the first reference image because xAI edit flow is treated as single-image input.

## Cross-Provider Implementation Notes

- Keep API Keys in local config only.
- Use provider-specific config as the canonical app config shape; flat `baseURL/model/apiKey` is backward compatibility only.
- Request-level provider selection should dispatch by provider name without mutating saved default provider.
- Normalize provider errors with provider name and HTTP status/body when available.
- Data URL handling matters:
  - OpenRouter and OpenAI Responses can return base64 data directly.
  - Google returns inline base64 data and MIME type separately.
  - xAI can return `b64_json` or URL depending on response format.
