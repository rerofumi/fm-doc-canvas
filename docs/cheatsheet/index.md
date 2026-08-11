# Cheatsheet Index

| File | Topic | Target Version | Confirmed | Knowledge Type | When to Read |
| --- | --- | --- | --- | --- | --- |
| `link.md` | Source link registry | N/A | 2026-08-11 | Web source registry | Before adding external API or runtime references |
| `domain_primer.md` | AI協働型Workspace domain | Product-domain invariant | 2026-08-11 | Domain explanation from local user research | Before changing Workspace, Context, Proposal, lifetime, or E2E behavior |
| `image_generation_providers.md` | Image generation provider API behavior | OpenRouter Chat Completions image modality; OpenAI Images/Responses image generation; Gemini `generateContent`; xAI Images API | 2026-05-05 | Official Web docs + local implementation | Before changing image generation providers, provider selection, request payloads, response parsing, or model defaults |
| `chat_tool_provider_compatibility.md` | Chat tool-call provider metadata | Google Gemini OpenAI compatibility thought signatures | 2026-08-11 | Official Web docs + local regression test | Before changing agent Chat Completions request/response types, streaming tool-call assembly, or multi-round tool history |
| `wails_playwright_e2e.md` | Wails browser E2E feasibility and boundaries | Wails 2.12.0; Playwright 1.62.1 candidate; Windows 11 | 2026-08-11 | Official Web docs + local CLI/build/test verification | Before adopting or changing the E2E runner, Wails dev harness, test data isolation, or native smoke boundary |
