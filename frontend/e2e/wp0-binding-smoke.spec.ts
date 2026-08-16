import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * WP-0 Go criteria smoke:
 * 1) browser can open Wails dev server
 * 2) harmless Go binding (Greet) works through real window.go bridge
 * 3) temp user-data root is isolated when FM_E2E_TEMP_ROOT is set
 */

test.describe.configure({ mode: "serial" });

test("Wails binding Greet is reachable from browser", async ({ page }) => {
  const baseURL = process.env.FM_E2E_BASE_URL;
  test.skip(!baseURL, "FM_E2E_BASE_URL is required (set by run-e2e.mjs)");

  // Deny non-loopback navigations/requests as a network guardrail.
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost") || url.startsWith("ws://127.0.0.1") || url.startsWith("ws://localhost") || url.startsWith("data:") || url.startsWith("blob:")) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });

  await page.goto(baseURL!, { waitUntil: "domcontentloaded" });

  // Wait until Wails injects the Go bridge.
  await page.waitForFunction(() => {
    const w = window as unknown as {
      go?: { main?: { App?: { Greet?: (name: string) => unknown } } };
    };
    return typeof w.go?.main?.App?.Greet === "function";
  }, undefined, { timeout: 45_000 });

  const greeting = await page.evaluate(async () => {
    const w = window as unknown as {
      go: { main: { App: { Greet: (name: string) => Promise<string> | string } } };
    };
    return w.go.main.App.Greet("WP0");
  });

  expect(String(greeting)).toContain("WP0");
  expect(String(greeting)).toMatch(/show time/i);

  // UI smoke: blank workspace header controls should be present.
  await expect(page.getByRole("button", { name: "Add Text" })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator("header").getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByTestId("settings-drawer").getByRole("button", { name: "New Workspace" }),
  ).toBeVisible();

  // Optional temp-root isolation marker written by orchestrator.
  const tempRoot = process.env.FM_E2E_TEMP_ROOT;
  if (tempRoot) {
    const marker = path.join(tempRoot, "e2e-marker.txt");
    expect(fs.existsSync(marker)).toBeTruthy();
    // Ensure real AppData config path is not the temp root.
    const appData = process.env.APPDATA || "";
    if (appData) {
      const realCfg = path.join(appData, "fm-doc-canvas");
      expect(path.resolve(tempRoot)).not.toBe(path.resolve(realCfg));
    }
  }
});
