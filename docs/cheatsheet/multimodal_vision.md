# Multimodal Vision and Image Tool Cheatsheet

Confirmed: 2026-08-13

This cheatsheet records pre-implementation research for F-4 (`plan_20260813_multimodal_context`). It is about existing local image generation / vision paths and official Chat Completions image input. Product requirements stay in the plan directory.

## Target / Environment

- Target: Wails v2.12.0 desktop app; existing `ImageGenService` / `ImagePort`; existing OpenAI-compatible Chat Completions agent loop
- Confirmation date: 2026-08-13
- Environment: Windows 11 planning session; local source inspection + official docs. No new authenticated image/VLM call in this session
- Knowledge type: Official Web docs + local implementation

## Local Implementation — Go

| Path | Fact |
| --- | --- |
| `backend/image.go` | `ImageGenService.GenerateImage(prompt, contextData, refImages)` and `GenerateImageWithProvider(...)`. Providers: OpenRouter, OpenAI, Google, xAI |
| `backend/ports.go` | `ImagePort` already exists. `FixtureImage` returns `generated/fixture.png` without network |
| `backend/llm.go` | `GenerateTextWithImages` already sends `content[].type=image_url` data URLs. Agent `streamChat` currently uses string user content |
| `backend/agent_loop.go` | No `generate_image` tool. `read_canvas_node` for `type=image` returns `imageRef`, `prompt`, `imageIncluded: false` |
| `app.go` `NewE2EAppFromEnv` | Sets `opts.Image = FixtureImage`, but `NewAppWithOptions` leaves `imageGenService` / `imageAssetService` nil. WP-0 must wire them |
| PromptBar | Direct Image generation already uses allowlisted text + image data URLs. Request-level provider selector does not persist the default |

**Decision: Go** for reusing `ImagePort` and `GenerateTextWithImages` content-part shape. No new provider SDK.

## Official Chat Completions Vision + Tools

- Source: https://developers.openai.com/api/docs/guides/images-vision
- Source: https://developers.openai.com/api/reference/resources/chat
- Confirmation date: 2026-08-13
- Chat Completions accepts user `content` as an array of `text` and `image_url` parts (`url` may be a data URL).
- The same Chat Completions request may include `tools` function definitions. This planning session did not execute a live combined vision+tools call.
- Responses API has a built-in `image_generation` tool. F-4 must not migrate the agent loop to Responses.

**Decision: Go** for attaching allowlisted images to the existing Chat Completions user message. **Conditional** for real-model quality of vision+tool-calling together. Core E2E uses `FixtureLLM` and must not require a live VLM.

**Fallback**: If a production model rejects image parts with tools, keep generation on ImagePort and keep vision as a separate non-tool completeChat path, then amend. Do not silently drop images.

## Image Generation Providers

Reuse [image_generation_providers.md](./image_generation_providers.md). Confirmed 2026-05-05 and still the local source of truth. F-4 does not add a provider.

Update this file if OpenRouter / OpenAI / Gemini / xAI request or response shapes change, or if E2E ImagePort wiring changes.

## Local Verification

- Environment: repository inspection only
- Command / reproduction: read `backend/image.go`, `backend/llm.go`, `backend/agent_loop.go`, `app.go`, `frontend/src/components/layout/PromptBar.tsx`, `frontend/src/domain/contextResolver.ts`
- Expected: existing image generation Direct Action; Dialogue metadata-only; E2E Image fixture unwired
- Actual: matches expected
- Failure condition: treating Dialogue metadata-only or nil E2E ImagePort as already supporting F-4

## Open Questions

- Authenticated vision+tools 200 on the user's current LLM model: Conditional. Not a Core E2E pass condition.
- Physical generated files after undo: remain on disk by existing invariant. No GC in F-4.

## When to Re-read

Before changing `generate_image`, Dialogue Vision payload, ImagePort wiring, or moving image generation to Responses / a new SDK.
