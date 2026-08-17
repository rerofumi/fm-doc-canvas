# Source Links

## i18next TypeScript

- URL: https://www.i18next.com/overview/typescript
- Source type: Official documentation
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Related local files: future `frontend/src/i18n/`
- Reason: TypeScript 5 support、resource type augmentation、`strictKeyChecks`、selector API、large catalog の compile-time guidance を確認する。

## i18next Configuration

- URL: https://www.i18next.com/overview/configuration-options
- Source type: Official documentation
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Related local files: future `frontend/src/i18n/i18n.ts`
- Reason: bundled `resources`、`lng`、`fallbackLng`、`supportedLngs`、`cimode` 等の instance configuration を確認する。

## react-i18next Quick Start

- URL: https://react.i18next.com/guides/quick-start
- Source type: Official documentation
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Related local files: future `frontend/src/i18n/i18n.ts`, React components
- Reason: `i18next` + `react-i18next` initialization、`initReactI18next`、`useTranslation` の React integration を確認する。

## react-i18next useTranslation

- URL: https://react.i18next.com/latest/usetranslation-hook
- Source type: Official documentation
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Reason: hook による `t` / i18n instance access、runtime language change、Suspense behavior を確認する。

## i18next npm package 26.3.6

- URL: https://www.npmjs.com/package/i18next/v/26.3.6
- Source type: npm package registry metadata
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Reason: exact version、license、package metadata と local install target を固定する。

## react-i18next npm package 17.0.11

- URL: https://www.npmjs.com/package/react-i18next/v/17.0.11
- Source type: npm package registry metadata
- Confirmation date: 2026-08-17
- Related local cheatsheet: `ui_i18n.md`
- Reason: exact version と React / i18next / TypeScript peer compatibility の local verification target を固定する。

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

## Ollama Cloud Web Search

- URL: https://docs.ollama.com/capabilities/web-search
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Related local files: future `backend/web_search.go`
- Reason: Confirms `POST https://ollama.com/api/web_search`, bearer auth, `query` / `max_results`, and `results[].title|url|content`. Also documents `web_fetch`, which F-3 core must not call.

## Kagi Search API (OpenAPI)

- URL: https://kagi.com/api/docs/openapi/search/search
- Source type: Official OpenAPI documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Related local files: future `backend/web_search.go`
- Reason: Confirms request `query` / `workflow` / `limit` and response `data.search[].title|url|snippet`. Documents `extract`, which F-3 core must not send.

## Kagi API overview

- URL: https://kagi.com/api/docs
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: production server と generated OpenAPI を確認。2026-08-13 の認証付き実測で POST JSON + Bearer が HTTP 200 となり、adapter の採用根拠になった。

## Kagi Search API (current help)

- URL: https://help.kagi.com/kagi/api/search.html
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: GET + Bot の公式利用例との矛盾を確認するため参照。2026-08-13 の同一実キーでは GET + Bot が 404、POST JSON + Bearer が 200 だったため、help例は今回のkey/adapter契約には採用しない。

## Brave Search API

- URL: https://brave.com/search/api/
- Source type: Official product documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Related local files: future `backend/web_search.go`
- Reason: Independent Web index and structured SERP as the first Context Provider candidate.

## Brave Web Search Get Started

- URL: https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: Confirms `GET /res/v1/web/search`, `X-Subscription-Token`, `title` / `url` / `description`, `extra_snippets`, `count`, freshness.

## Brave Web Search API Reference

- URL: https://api-dashboard.search.brave.com/api-reference/web/search/get
- Source type: Official API reference
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: Confirms response envelope and query parameters for the Web Search endpoint.

## Tavily Search API

- URL: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Source type: Official API reference
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: Fallback candidate schema (`title` / `url` / `content`) and the `include_answer` trap for this product.

## OpenAI Images and Vision

- URL: https://developers.openai.com/api/docs/guides/images-vision
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `multimodal_vision.md`
- Related local files: `backend/llm.go`, `backend/agent_loop.go`
- Reason: Confirms Chat Completions can take image inputs; Responses `image_generation` is not the F-4 path.

## OpenAI Chat Completions content parts

- URL: https://developers.openai.com/api/reference/resources/chat
- Source type: Official API reference
- Confirmation date: 2026-08-13
- Related local cheatsheet: `multimodal_vision.md`
- Reason: Confirms user `content` may be `text` + `image_url` (data URL) on the same Chat Completions API the agent loop already uses.

## xAI Web Search Tool

- URL: https://docs.x.ai/developers/tools/web-search
- Source type: Official documentation
- Confirmation date: 2026-08-13
- Related local cheatsheet: `web_context_providers.md`
- Reason: Confirms Responses API / SDK `web_search` is a grounded-answer tool, not a SERP Context Provider.
