import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { e2e, openApp } from "./helpers";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const demoDir = path.join(repoRoot, "manuals", "demo");

test("README 用の日本語プロダクト検討デモを撮影する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page, { locale: "ja", navigatorLanguages: ["ja-JP", "ja"] });

  const app = await e2e(page);
  const workspace = fs.readFileSync(
    path.join(demoDir, "product-planning-ja.canvas.json"),
    "utf8",
  );
  await app.loadJSON(workspace);

  await expect(page.getByText("product-brief.md")).toBeVisible();
  await page.getByRole("button", { name: "Fit View" }).click();
  await page.waitForTimeout(800);

  const images = {
    architecture: `data:image/png;base64,${fs.readFileSync(path.join(demoDir, "architecture.png")).toString("base64")}`,
    releaseFlow: `data:image/png;base64,${fs.readFileSync(path.join(demoDir, "release-flow.png")).toString("base64")}`,
  };
  await page.locator('img[alt="障害対応ナレッジ基盤の提案アーキテクチャ"]').evaluate(
    (element, src) => { (element as HTMLImageElement).src = src; },
    images.architecture,
  );
  await page.locator('img[alt="段階リリースのフロー図"]').evaluate(
    (element, src) => { (element as HTMLImageElement).src = src; },
    images.releaseFlow,
  );

  await page.screenshot({
    path: path.join(repoRoot, "manuals", "screenshot_readme_product_planning_ja.png"),
    fullPage: true,
  });
});
