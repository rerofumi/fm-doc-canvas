import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("WP-1 Markdown external links", () => {
  test("Artifact preview and Editor Preview delegate HTTP(S) links without WebView navigation", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();

    await page.evaluate(() => {
      const runtime = (window as any).runtime;
      const calls: string[] = [];
      runtime.BrowserOpenURL = (url: string) => calls.push(url);
      (window as any).__markdownLinkCalls = calls;
    });

    const artifactId = await app.addArtifact(
      "[external](https://example.com/wp1) [blocked](javascript:alert(1))",
      "wp1-links.md",
    );
    const node = page.locator(`.react-flow__node[data-id="${artifactId}"]`);
    const artifactLink = node.getByRole("link", { name: "external" });
    await expect(artifactLink).toBeVisible();
    const artifactURL = page.url();
    const artifactSnapshot = (await app.snapshot()).json;
    await artifactLink.click();
    expect(page.url()).toBe(artifactURL);
    expect((await app.snapshot()).json).toBe(artifactSnapshot);
    expect(await page.evaluate(() => (window as any).__markdownLinkCalls)).toEqual([
      "https://example.com/wp1",
    ]);

    await node.dblclick({ position: { x: 8, y: 8 } });
    await page.getByTestId("editor-preview").click();
    const editorLink = page.getByRole("link", { name: "external" }).last();
    await expect(editorLink).toBeVisible();
    const editorURL = page.url();
    const editorSnapshot = (await app.snapshot()).json;
    // The canvas node remains mounted behind the drawer; dispatch the real DOM
    // click on the editor anchor without letting the covered canvas node win.
    await editorLink.dispatchEvent("click");
    expect(page.url()).toBe(editorURL);
    expect((await app.snapshot()).json).toBe(editorSnapshot);
    expect(await page.evaluate(() => (window as any).__markdownLinkCalls)).toEqual([
      "https://example.com/wp1",
      "https://example.com/wp1",
    ]);

    await page.getByRole("link", { name: "blocked" }).last().dispatchEvent("click");
    expect(page.url()).toBe(editorURL);
    expect(await page.evaluate(() => (window as any).__markdownLinkCalls)).toEqual([
      "https://example.com/wp1",
      "https://example.com/wp1",
    ]);
  });
});
