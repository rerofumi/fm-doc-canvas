# Review Notes

## Review Findings

- `frontend/src/store/useAppStore.ts` currently flattens `imageGen` during `saveConfig`, preserving only the selected provider's fields in `baseURL/model/apiKey`. This conflicts with the new requirement to keep multiple provider API Keys at once.
- `backend/image.go` chooses provider exclusively from saved `cfg.ImageGen.Provider`, so request-level provider switching needs an API change or additional method.
- `frontend/src/components/layout/PromptBar.tsx` already stores the prompt in `ImageNodeData.alt` and creates a separate prompt text node, but `frontend/src/components/canvas/ImageNode.tsx` only uses `alt` as the `<img>` alt attribute and overlay alt, not as visible card text.
- `frontend/src/components/layout/PromptBar.tsx` keeps prompt input in component-local state, while `ImageNode` is a separate React Flow node component. Prompt click-to-append needs shared state or an explicit event bridge; directly coupling ImageNode to PromptBar local state is not possible.
- `frontend/src/types/index.ts` has a `ProviderConfig` union that omits Google despite current app support. It appears unused, but should be corrected or removed during implementation to avoid misleading future work.

## Fixed Items

- Plan documents were generated from the 2026-05-05 claim.
- `docs/cheatsheet/image_generation_providers.md` was added from existing code behavior and official provider documentation.
- `docs/cheatsheet/index.md` and `docs/cheatsheet/link.md` were updated with source records.

## Deferred Items

- Decide whether same-provider multiple profiles are needed. MVP treats one credential set per provider as sufficient.
- Decide whether to remove the separate prompt text node after image generation. MVP keeps it for compatibility.
- Decide whether provider/model metadata should be shown on image cards. MVP records it if cheap, but only prompt display is required.
- Decide whether clicked prompt appends with blank-line separation or another delimiter. Current specification uses a blank line for readability.

## Rejected Options

- Saving PromptBar provider selection directly into global config for every generation: rejected because request-level switching should not silently alter user defaults.
- Adding a brand-new canvas file version solely for optional prompt metadata: rejected for MVP because optional fields can preserve `1.1` compatibility.
- Putting API Keys in canvas files for portability: rejected because secrets must remain local config only.
- Replacing PromptBar input with clicked image prompt: rejected because the updated app requirement explicitly says current input must not be erased.

## Current Non-Goals

- Keychain-backed secret storage.
- Provider model discovery API.
- Multi-provider batch generation.
- Streaming partial image display.
- Full provider-specific option UI.

## Future Plans

- Add provider/model badges to image nodes.
- Add regeneration from image node prompt metadata.
- Add a dedicated "reuse prompt" command or icon if caption click is not discoverable enough in user testing.
- Add profiles for multiple API Keys within the same provider.
- Add official API update checks for cheatsheets when provider docs materially change.

## Next Plan Candidates

- Secure credential storage.
- Image generation history and reproducibility metadata.
- Provider capability matrix and model picker.

## Documentation Feedback

- After implementation, update `docs/app_requirement.md`, `docs/requirement.md`, and `docs/specification.md` with confirmed as-built behavior.
- If the Wails method shape differs from this specification, reflect the final method names in `40_specification.md` and current docs.
