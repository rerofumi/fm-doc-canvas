import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.FM_E2E_BASE_URL || "http://127.0.0.1:34115";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Prefer installed Edge when available; chromium is fallback via project.
    ...devices["Desktop Edge"],
    channel: process.env.FM_E2E_BROWSER_CHANNEL || "msedge",
    headless: true,
  },
  projects: [
    {
      name: "edge-or-chromium",
      use: process.env.FM_E2E_BROWSER_CHANNEL
        ? { channel: process.env.FM_E2E_BROWSER_CHANNEL }
        : { channel: "msedge" },
    },
  ],
  // webServer is orchestrated by run-e2e.mjs so process-tree cleanup stays explicit.
});
