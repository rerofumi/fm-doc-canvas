# Review Notes

## Review Findings

- This documentation pass only reorganized and regenerated documentation. No implementation review findings were fixed in code.
- Existing uncommitted changes outside `docs/` were present before this pass and were left untouched.

## Fixed Items

- Existing `docs/` content was moved under `docs/plan_20260406/`.
- Current documentation was recreated from the implemented code instead of copying historical plan documents.
- `docs/cheatsheet/` index files were added to match the fm-dev-process structure.

## Deferred Items

- API behavior details in provider implementations should be validated against current official API documentation before future provider changes.
- Settings storage currently keeps API keys in plain text; improving secret storage remains outside this documentation-only pass.
- Marp export produces Markdown only and does not render or validate slide output.

## Rejected Options

- Historical phase documents were not merged into current docs because the user requested moving existing documents into `plan_20260406`.
- No external Web-derived cheatsheets were authored because this pass did not perform external API research.

## Current Non-Goals

- No code changes.
- No dependency updates.
- No behavioral changes to generation, persistence, import, or export.

## Future Plans

- Add provider-specific cheatsheets when changing OpenRouter, OpenAI, Google, or xAI integration behavior.
- Add tests or scripted verification for canvas file compatibility and path safety.
- Reconcile README data path wording with the implemented `fm-doc-canvas` config directory if documentation consistency is prioritized.

## Documentation Feedback

- Keep `docs/` limited to current implemented behavior.
- Keep future feature plans, rejected options, and phase history under `docs/plan_*`.
- Keep external API facts under `docs/cheatsheet/` with source links and confirmation dates.

