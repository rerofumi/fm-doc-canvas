# Source Links

## OpenRouter Image Generation

- URL: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- Source type: Official documentation
- Confirmation date: 2026-05-05
- Related local cheatsheet: `image_generation_providers.md`
- Related local files: `backend/openrouter.go`
- Reason: Confirms `chat/completions`, `modalities`, image-capable model discovery, and `message.images[].image_url.url` response handling.

## OpenAI Image Generation Guide

- URL: https://platform.openai.com/docs/guides/images/image-generation
- Source type: Official documentation
- Confirmation date: 2026-05-05
- Related local cheatsheet: `image_generation_providers.md`
- Related local files: `backend/openai.go`
- Reason: Confirms Images API vs Responses API usage, image generation endpoint behavior, and base64 image output handling.

## OpenAI Image Generation Tool

- URL: https://platform.openai.com/docs/guides/tools-image-generation/
- Source type: Official documentation
- Confirmation date: 2026-05-05
- Related local cheatsheet: `image_generation_providers.md`
- Related local files: `backend/openai.go`
- Reason: Confirms Responses API `image_generation` tool behavior, supported controller models, and `image_generation_call.result` base64 output.

## Google Gemini Image Generation

- URL: https://ai.google.dev/gemini-api/docs/image-generation
- Source type: Official documentation
- Confirmation date: 2026-05-05
- Related local cheatsheet: `image_generation_providers.md`
- Related local files: `backend/google.go`
- Reason: Confirms `generateContent`, `inlineData` image input, and `inlineData` image output behavior for Gemini image generation.

## xAI Image Generations

- URL: https://docs.x.ai/docs/guides/image-generations
- Source type: Official documentation
- Confirmation date: 2026-05-05
- Related local cheatsheet: `image_generation_providers.md`
- Related local files: `backend/xai.go`
- Reason: Confirms image generation parameters, `response_format`, `n`, and unsupported `quality` / `size` / `style` options.
