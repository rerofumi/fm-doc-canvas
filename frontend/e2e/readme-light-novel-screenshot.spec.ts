import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { e2e, openApp } from "./helpers";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const demoDir = path.join(repoRoot, "manuals", "demo", "light-novel");

test("README 用のライトノベルプロット検討デモを撮影する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page, { locale: "ja", navigatorLanguages: ["ja-JP", "ja"] });

  const app = await e2e(page);
  await app.loadJSON(fs.readFileSync(path.join(demoDir, "light-novel-plot-ja.canvas.json"), "utf8"));

  await expect(page.getByText("story-pitch.md")).toBeVisible();
  await page.getByRole("button", { name: "Fit View" }).click();
  await page.waitForTimeout(800);

  const assets = [
    ["主人公・風見カイトのキャラクターシート", "kaito-character-sheet.png"],
    ["ヒロイン・リネットのキャラクターシート", "lynette-character-sheet.png"],
    ["全5章のプロットフロー", "plot-arc.png"],
  ] as const;
  for (const [alt, filename] of assets) {
    const src = `data:image/png;base64,${fs.readFileSync(path.join(demoDir, filename)).toString("base64")}`;
    await page.locator(`img[alt="${alt}"]`).evaluate(
      (element, dataURL) => { (element as HTMLImageElement).src = dataURL; },
      src,
    );
  }

  await page.screenshot({
    path: path.join(repoRoot, "manuals", "screenshot_readme_light_novel_plot_ja.png"),
    fullPage: true,
  });
});
