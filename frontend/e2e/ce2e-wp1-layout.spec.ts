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
    await expect(appHeader.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(appHeader.getByRole("button", { name: /Auto Layout/ })).toBeVisible();
    await expect(appHeader.getByRole("button", { name: "AI Assistant" })).toBeVisible();
    await expect(appHeader.getByRole("button", { name: /New Workspace/i })).toHaveCount(0);
    await expect(appHeader.getByRole("button", { name: /Save Workspace|Save Canvas/i })).toHaveCount(0);
    await expect(appHeader.getByRole("button", { name: /Load Workspace|Load Canvas/i })).toHaveCount(0);

    await appHeader.getByRole("button", { name: "AI Assistant" }).click();
    await expect(page.getByLabel("Close assistant")).toBeVisible();
    await page.getByLabel("Close assistant").click();

    await appHeader.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByTestId("settings-drawer");
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByText("File Operations")).toBeVisible();
    await expect(settings.getByRole("button", { name: "Save Canvas" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "Load Canvas" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "New Workspace" })).toBeVisible();
    await app.addText("Settings action target");
    await settings.getByRole("button", { name: "New Workspace" }).click();
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
    await page.getByRole("tab", { name: "Direct" }).click();
    const input = page.getByLabel("Chat message input");
    await input.fill("WP-1 direct submit");
    await page.getByRole("button", { name: "生成" }).click();
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

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByTestId("settings-drawer");
    await settings.getByRole("button", { name: "Clear Canvas" }).click();
    const dialog = page.getByRole("dialog", { name: "Clear Canvas" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Clear Canvas" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByRole("button", { name: "Clear Canvas" })).toBeFocused();
    expect((await app.snapshot()).nodeCount).toBe(2);

    await settings.getByRole("button", { name: "Clear Canvas" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByRole("button", { name: "Clear Canvas" })).toBeFocused();

    await settings.getByRole("button", { name: "Clear Canvas" }).click();
    const overlay = page.locator('[role="presentation"]');
    await overlay.click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-0/);
    await expect(settings.getByRole("button", { name: "Clear Canvas" })).toBeFocused();

    await settings.getByRole("button", { name: "Clear Canvas" }).click();
    await page.getByRole("dialog", { name: "Clear Canvas" })
      .getByRole("button", { name: "Clear Canvas" })
      .click();
    await expect.poll(async () => (await app.snapshot()).nodeCount).toBe(0);
    await expect(dialog).toBeHidden();
    await expect(settings).toHaveClass(/translate-x-full/);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
    expect((await app.snapshot()).relationCount).toBe(0);

    await page.getByRole("button", { name: "Undo" }).click();
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

    await page.getByRole("button", { name: /Auto Layout/ }).click();
    await expect.poll(async () => {
      const snapshot = await app.snapshot();
      return snapshot.nodes.some((node: any) => beforePositions.get(node.id) !== `${node.position.x},${node.position.y}`);
    }).toBe(true);
    const laidOut = await app.snapshot();
    expect(laidOut.json).toContain("Layout A");
    expect(laidOut.historyLength).toBeGreaterThan(before.historyLength);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    let settings = page.getByTestId("settings-drawer");
    await settings.getByRole("button", { name: "Save Canvas" }).click();
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
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    settings = page.getByTestId("settings-drawer");
    await settings.getByRole("button", { name: "Load Canvas" }).click();
    // Load resets domain history after the validated replacement; wait for
    // that terminal signal instead of matching the pre-load snapshot content.
    await expect.poll(async () => (await app.snapshot()).historyLength).toBe(0);
    const loaded = await app.snapshot();
    expect(loaded.json).toContain("Layout A");
    expect(loaded.json).not.toContain("Changed after save");
  });
});
