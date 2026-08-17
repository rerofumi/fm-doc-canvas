import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";
import fs from "node:fs";
import path from "node:path";
import { tempRoot } from "./helpers";

test.describe("WP-1 canvas-first layout", () => {
  test("header actions are discoverable and file operations live in Settings", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();

    const appHeader = page.locator("header").filter({ hasText: "FM Doc Canvas" });
    await expect(page.getByTestId("shell-undo")).toBeVisible();
    await expect(page.getByTestId("shell-auto-layout")).toBeVisible();
    await expect(page.getByTestId("shell-chat-toggle")).toBeVisible();
    await expect(appHeader.getByRole("button", { name: /New Workspace/i })).toHaveCount(0);
    await expect(appHeader.getByTestId("save-canvas-action")).toHaveCount(0);
    await expect(appHeader.getByTestId("load-canvas-action")).toHaveCount(0);

    await page.getByTestId("shell-chat-toggle").click();
    await expect(page.getByTestId("assistant-close")).toBeVisible();
    await page.getByTestId("assistant-close").click();

    await page.getByTestId("shell-settings").click();
    const settings = page.getByTestId("settings-drawer");
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByText("File Operations")).toBeVisible();
    await expect(settings.getByTestId("save-canvas-action")).toBeVisible();
    await expect(settings.getByTestId("load-canvas-action")).toBeVisible();
    await expect(settings.getByTestId("settings-new-workspace")).toBeVisible();
    await app.addText("Settings action target");
    await settings.getByTestId("settings-new-workspace").click();
    await expect.poll(async () => (await app.snapshot()).nodeCount).toBe(0);
  });

  test("breadcrumb and canvas occupy the full content area at supported widths", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();

    const breadcrumb = page.getByRole("navigation", { name: "Canvas breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole("button", { name: "Use this Canvas as context" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Generation mode" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveCount(0);
    await expect(page.getByTestId("canvas-root")).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="canvas-root"]')?.getBoundingClientRect();
        return {
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          canvasBottom: canvas?.bottom ?? 0,
          viewportHeight: window.innerHeight,
        };
      });
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.bodyClientWidth);
      expect(layout.canvasBottom).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
    }
  });

  test("Direct submit remains available through the unified Assistant", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    await page.getByTestId("assistant-mode-direct").click();
    const input = page.getByTestId("assistant-prompt");
    await input.fill("WP-1 direct submit");
    await page.getByTestId("assistant-submit").click();
    await expect(page.getByTestId("direct-result-surface")).toContainText("Direct Text", { timeout: 15_000 });
  });

  test("Clear Canvas uses a confirmation dialog and remains undoable", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const first = await app.addText("Clear target");
    const second = await app.addText("Keep in history");
    await app.addRelation(first!, second!, "supports", "clear fixture relation");
    const before = await app.snapshot();
    expect(before.nodeCount).toBe(2);
    expect(before.relationCount).toBe(1);

    await page.getByTestId("shell-settings").click();
    const settings = page.getByTestId("settings-drawer");
    await settings.getByTestId("clear-canvas-action").click();
    const dialog = page.getByTestId("clear-canvas-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("button").first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.locator("button").last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.locator("button").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByTestId("clear-canvas-action")).toBeFocused();
    expect((await app.snapshot()).nodeCount).toBe(2);

    await settings.getByTestId("clear-canvas-action").click();
    await dialog.locator("button").first().click();
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByTestId("clear-canvas-action")).toBeFocused();

    await settings.getByTestId("clear-canvas-action").click();
    const overlay = page.locator('[role="presentation"]');
    await overlay.click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByTestId("clear-canvas-action")).toBeFocused();

    await settings.getByTestId("clear-canvas-action").click();
    await page.getByTestId("clear-canvas-dialog").locator("button").last().click();
    await expect.poll(async () => (await app.snapshot()).nodeCount).toBe(0);
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-full/);
    await expect(page.getByTestId("shell-settings")).toBeFocused();
    expect((await app.snapshot()).relationCount).toBe(0);

    await page.getByTestId("shell-undo").click();
    await expect.poll(async () => (await app.snapshot()).nodeCount).toBe(2);
    expect((await app.snapshot()).relationCount).toBe(1);
  });

  test("Auto Layout and Settings Save/Load update domain snapshots", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const first = await app.addText("Layout A");
    const second = await app.addText("Layout B");
    await app.moveNode(first!, 900, 80);
    await app.moveNode(second!, 80, 640);
    const before = await app.snapshot();
    const beforePositions = new Map(before.nodes.map((node: any) => [node.id, `${node.position.x},${node.position.y}`]));

    await page.getByTestId("shell-auto-layout").click();
    await expect.poll(async () => {
      const snapshot = await app.snapshot();
      return snapshot.nodes.some((node: any) => beforePositions.get(node.id) !== `${node.position.x},${node.position.y}`);
    }).toBe(true);
    const laidOut = await app.snapshot();
    expect(laidOut.json).toContain("Layout A");
    expect(laidOut.historyLength).toBeGreaterThan(before.historyLength);

    await page.getByTestId("shell-settings").click();
    let settings = page.getByTestId("settings-drawer");
    await settings.getByTestId("save-canvas-action").click();
    const savedPath = path.join(tempRoot(), "save", "workspace.json");
    expect(fs.existsSync(savedPath)).toBeTruthy();
    const savedJson = fs.readFileSync(savedPath, "utf8");
    await app.editText(first!, "Changed after save");
    expect((await app.snapshot()).json).toContain("Changed after save");

    // FixedDialog's open path is an isolated E2E fixture path, never a real
    // user path. Copy the saved adapter output there before clicking Load.
    const openPath = path.join(tempRoot(), "fixtures", "workspace.json");
    fs.mkdirSync(path.dirname(openPath), { recursive: true });
    fs.writeFileSync(openPath, savedJson, "utf8");
    await page.getByTestId("shell-settings").click();
    settings = page.getByTestId("settings-drawer");
    await settings.getByTestId("load-canvas-action").click();
    // Load resets domain history after the validated replacement; wait for
    // that terminal signal instead of matching the pre-load snapshot content.
    await expect.poll(async () => (await app.snapshot()).historyLength).toBe(0);
    const loaded = await app.snapshot();
    expect(loaded.json).toContain("Layout A");
    expect(loaded.json).not.toContain("Changed after save");
  });
});
