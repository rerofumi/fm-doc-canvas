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

## Google Gemini Thought Signatures

- URL: https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures
- Source type: Official documentation
- Confirmation date: 2026-08-11
- Related local cheatsheet: `chat_tool_provider_compatibility.md`
- Related local files: `backend/agent_types.go`, `backend/llm.go`, `backend/agent_loop.go`
- Reason: Confirms that OpenAI-compatible function calls carry `extra_content.google.thought_signature` and that the signature must be preserved in subsequent tool-loop requests.

## Wails Development Server

- URL: https://wails.io/docs/gettingstarted/development/
- Source type: Official documentation
- Confirmation date: 2026-08-11
- Related local cheatsheet: `wails_playwright_e2e.md`
- Related local files: `wails.json`, `mise.toml`
- Reason: Confirms that `wails dev` runs the application, generates Go-to-JavaScript bindings, and serves the application through a browser-accessible development server.

## Wails v2 CLI

- URL: https://wails.io/docs/reference/cli/
- Source type: Official documentation
- Confirmation date: 2026-08-11
- Related local cheatsheet: `wails_playwright_e2e.md`
- Related local files: `mise.toml`, `wails.json`
- Reason: Records the `wails dev` development-server behavior and CLI flags that must be rechecked when implementing the E2E harness.

## Playwright Web Server

- URL: https://playwright.dev/docs/test-webserver
- Source type: Official documentation
- Confirmation date: 2026-08-11
- Related local cheatsheet: `wails_playwright_e2e.md`
- Related local files: future `frontend/playwright.config.ts`, `mise.toml`
- Reason: Confirms Playwright Test can start a local server, wait on a URL, set a base URL, and control timeout/reuse behavior.

## Playwright Browser API Mocking

- URL: https://playwright.dev/docs/mock-browser-apis
- Source type: Official documentation
- Confirmation date: 2026-08-11
- Related local cheatsheet: `wails_playwright_e2e.md`
- Related local files: future E2E setup
- Reason: Confirms browser-side APIs can be installed before page scripts with `addInitScript`; useful only for boundaries that cannot use the real Wails bridge.
