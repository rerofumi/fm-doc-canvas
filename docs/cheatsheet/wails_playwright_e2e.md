# Wails / Playwright E2E Feasibility

Wails desktop app の UI → JavaScript binding → Go Backend を横断する E2E 候補と、現時点の検証状態を記録する。

## Target / Confirmation

- Confirmation date: 2026-08-11
- OS: Windows 11
- Project runtime: Wails CLI / Go module v2.12.0
- Local tools: Go 1.26.1、Node 24.14.1、npm 11.11.0
- WebView2: 151.0.4129.72（`wails doctor` の調査結果）
- Candidate runner: `@playwright/test` 1.62.1
- Knowledge type: 公式 documentation + local CLI / build / test verification

## Official Behavior Used

- Wails v2 `wails dev` は、desktop app とともに browser から Go binding を呼べる development server を起動する。
- Playwright Test は `webServer` 設定で test 前に local server を起動し、ready URL を待てる。
- Playwright は page load 前の `addInitScript` で browser-side API を mock できる。ただし本計画の Core E2E は、可能な限り Wails dev server の実 binding を通す。

Source URLs は [link.md](./link.md) に記録する。

## Local Verification

### Baseline project checks

2026-08-11 に次を実行し、すべて exit 0 を確認した。

```text
mise exec -- go test ./...
mise exec -- go vet ./...
mise exec -- npm --prefix frontend run test:sprint-c
mise exec -- npm --prefix frontend run build
mise run build
```

`mise run build` は Wails v2.12.0 / windows/amd64 で binding 生成、Frontend compile、Go compile を完了した。既存 `test:sprint-c` は pure logic test であり、DOM、Wails IPC、native UI を通す E2E ではない。

### Playwright candidate check

- Command: `mise exec -- npm view @playwright/test version`
- Result: `1.62.1`
- Command: `mise exec -- npm exec --yes --package=@playwright/test -- playwright --version`
- Result: `Version 1.62.1`

一時 `npm exec --package=playwright` から `require('playwright')` して Edge を起動する smoke は、package を project dependency として解決できず `MODULE_NOT_FOUND` で終了した。この結果は browser 非互換を示さず、CLI 確認だけでは runner 採用の十分な Go 証拠にならない。

## Implementation session 2026-08-11

- mise pin: Go 1.26.1, Node 24.14.1.
- Backend ports / TempFileSystem / Fixture providers / AppOptions validation tests added and pass.
- Frontend runtime seam (`runtimeEnvironment.tsx`) and deterministic domain ID/clock injection path added.
- `mise run e2e` task exists but intentionally fails (exit 2) until Playwright browser + Wails binding smoke succeeds.
- Decision remains HOLD for `@playwright/test` adoption.


## WP-0 Go evidence (2026-08-11 night)

Executed `mise run e2e` successfully on Windows 11.

Confirmed:
1. `@playwright/test` **1.62.1** is a frontend devDependency / lockfile entry.
2. Browser channel **msedge** headless launched via Playwright.
3. Wails dev server at `http://127.0.0.1:34115` served the app; Playwright called real `window.go.main.App.Greet("WP0")` and received the Go response.
4. Orchestrator (`frontend/e2e/run-e2e.mjs`) started Wails with `FM_E2E=1` + `FM_E2E_TEMP_ROOT`, ran smoke, then `taskkill /T /F` cleaned the process tree; no residual `wails`/`fm-doc-canvas` processes observed after exit.
5. Temp root under `%TEMP%\fm-doc-canvas-e2e-*` was used and removed on success; real `%AppData%\fm-doc-canvas` was not used as the E2E root.
6. Single entrypoint: `mise run e2e` → `npm --prefix frontend run test:e2e` → orchestrator.

Command evidence (abridged):
```text
mise run e2e
[e2e] server ready; running playwright smoke...
ok 1 ... Wails binding Greet is reachable from browser
1 passed
[e2e] playwright smoke passed
[e2e] cleaning up wails process tree...
[e2e] temp root removed
```

**Decision: Go for `@playwright/test` 1.62.1 as Core E2E runner** for browser vertical-slice tests. Native WebView2 dialog/drag-drop remains separate E2 smoke (REQ-17).

Known noise (non-blocking):
- Wails log `Unknown message from front end: runtime:ready` when driving the dev server from an external browser.
- `wails dev` still opens a native WebView2 window during smoke; cleanup kills the process tree.

## Current Decision

**Go (WP-0 smoke passed)**。

Previous HOLD checklist items 1–6 are satisfied by the evidence above. Remaining Core E2E product scenarios (CE2E-01〜05) still need implementation on this runner.

~~**HOLD / conditional candidate**~~ superseded.


`@playwright/test` を adopted stack にする前に、implementation WP-0 で次をすべて満たす。

1. exact version を `frontend/package.json` / lockfile に追加する。
2. browser binary または既存 Edge channel を headless 起動する。
3. Wails dev server の harmless Go binding を browser UI から一回呼ぶ。
4. Wails / Vite / native window / browser の子 process が成功時・失敗時とも残らない。
5. test data を一時 directory へ隔離し、実 `%AppData%/fm-doc-canvas` を変更しない。
6. 一つの `mise run e2e` で start、ready wait、test、cleanup を完了する。

Go にならない場合は、Core E2E を logic test や手動確認へ格下げせず、実行済み smoke を持つ別 runner を調査して plan を amend する。

## Candidate Commands

Local Wails v2.12.0 の help と調査結果に基づく候補。implementation 時に再確認する。

```text
mise exec -- wails dev -m -nosyncgomod -noreload -nogorebuild -nocolour
mise exec -- npm --prefix frontend exec playwright test
mise run e2e
```

`mise run e2e` は fixed port または動的 port、ready wait、timeout、process tree cleanup を隠蔽する project task とする。

## Required Test Seams

- `FM_E2E` 等の明示 test mode。
- constructorでreal pathを開かないBackend ports: MemoryConfigStore、Dialog、root-guard付きTempFileSystem / AssetStore、Fixture LLM / Image、capturing Event、FakeClock、seeded IDs。
- App mount前にstoreへ注入するFrontend runtime seam: generated Wails binding adapter、seeded ID、fixed Clock。module-scopeの`crypto.randomUUID` / `Date.now`に依存しない。
- user data、config、legacy chat、image output、save/load fixtureを明示temp rootへ隔離し、path未指定時はfail closedするcomposition root。
- deterministic fake LLM / Image provider。Core E2EはAPI key、external network、Ollamaに依存させない。
- stable accessible name / role。必要な箇所だけ `data-testid` を追加する。
- native dialog は test adapter で path を注入するか、browser test から分けて native E2 smoke とする。

## Coverage Boundary

Browser E2E が検証するもの:

- React UI、generated Wails binding、Go service、event correlation、test persistence adapter の vertical slice。
- Workspace start、role roundtrip、SubCanvas scope、Context preview、Proposal / undo、Discard。

別の native Wails E2 smoke が検証するもの:

- WebView2 上の drag & drop。
- native save / open / export dialog。
- clipboard、window、OS 固有 rendering。

## Risks / Failure Conditions

- Wails dev が native window を同時起動し、headless CI や process cleanup が不安定。
- port 34115 または Vite auto port の競合。
- `wails dev` が go.mod sync、frontend install、binding generation を行い意図しない差分を作る。
- Playwright browser download が network と cache write を必要とする。
- Browser test は OS WebView2 固有挙動を保証しない。
- `mise.toml` の `go = "latest"`、`node = "lts"`、Wails `@latest` が将来 drift する。

## Update Conditions

- Wails、Playwright、Node、WebView2 の major/minor version を更新した時。
- `wails dev` の flags、binding transport、default port が変わった時。
- E2E が残留 process、実 user data 汚染、flaky timeout を起こした時。
- CI runner または supported OS を変更した時。


