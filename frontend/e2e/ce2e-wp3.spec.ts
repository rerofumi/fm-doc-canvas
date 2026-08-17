import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("WP-3 unified Assistant contract", () => {
  test("shared draft follows mode and restores per Canvas", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    const input = page.getByTestId("assistant-prompt");

    await input.fill("root draft");
    await page.getByTestId("assistant-mode-direct").click();
    await expect(input).toHaveValue("root draft");

    const root = await app.snapshot();
    const rootNodeA = await app.addText("Draft scope A");
    const rootNodeB = await app.addText("Draft scope B");
    const child = await app.createSubCanvas([rootNodeA!, rootNodeB!], "Draft child");
    await app.navigate(child.childCanvasId);
    await expect(input).toHaveValue("");
    await input.fill("child draft");
    await app.navigate(root.currentCanvasId);
    await expect(input).toHaveValue("root draft");
    await app.navigate(child.childCanvasId);
    await expect(input).toHaveValue("child draft");

    await page.getByTestId("assistant-close").click();
    await expect(page.locator("aside.fixed")).toHaveClass(/translate-x-full/);
    await app.openChat();
    await expect(page.getByTestId("assistant-prompt")).toHaveValue("child draft");
  });

  test("textarea keyboard contract is newline versus explicit submit", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    const input = page.getByTestId("assistant-prompt");

    await input.fill("line one");
    await input.press("Enter");
    await expect(input).toHaveValue("line one\n");
    await input.press("Shift+Enter");
    await expect(input).toHaveValue("line one\n\n");

    const sourceA = await app.addText("Keyboard source A");
    const sourceB = await app.addText("Keyboard source B");
    await app.selectNodes([sourceA!, sourceB!]);
    await input.fill("fixture:relation-batch");
    await input.press("Control+Enter");
    await expect(page.locator('[aria-label="Dialogue messages"]')).toContainText("fixture relation batch", { timeout: 15_000 });
    await expect(input).toHaveValue("");
    expect((await app.snapshot()).chat.sessions[0]?.messages.some((message: any) => message.role === "user" && message.content === "fixture:relation-batch")).toBeTruthy();
  });

  test("Chat and Direct Web search preserve entry route and result surface", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    const input = page.getByTestId("assistant-prompt");

    await input.fill("dialogue route query");
    await page.getByTestId("assistant-web-search").click();
    await expect.poll(async () => (await app.snapshot()).lastSearchRequest?.entryRoute).toBe("dialogue-agent");
    let snapshot = await app.snapshot();
    const chatSession = snapshot.chat.sessions.find((session: any) => session.id === snapshot.chat.activeSessionId);
    expect(chatSession?.messages.some((message: any) => message.role === "user" && message.content === "dialogue route query")).toBeTruthy();

    await page.getByTestId("assistant-mode-direct").click();
    await input.fill("direct route query");
    await page.getByTestId("assistant-web-search").click();
    await expect.poll(async () => (await app.snapshot()).lastSearchReceipt?.entryRoute).toBe("direct-action");
    snapshot = await app.snapshot();
    expect(snapshot.lastSearchReceipt?.packet.query).toContain("direct route query");
    await expect(page.getByRole("region", { name: "Projected Context" })).toBeVisible();
  });

  test("default marker persists in raw JSON, hydrates without target, and names once", async ({ page }) => {
    await openApp(page);
    let app = await e2e(page);
    await app.newWorkspace();
    const targetNode = await app.addText("Target-derived");
    await app.setChatTarget(targetNode!);
    await app.openChat();
    await page.getByTestId("assistant-new-session").click();
    const defaultSnapshot = await app.snapshot();
    const defaultSession = defaultSnapshot.chat.sessions.find((session: any) => session.id === defaultSnapshot.chat.activeSessionId);
    expect(defaultSession?.title).toBe("Target-derived について");
    expect(defaultSession?.isDefaultTitle).toBe(true);
    const defaultRaw = JSON.parse(await app.readChatSessionsRaw());
    const defaultPersisted = defaultRaw.canvases[defaultSnapshot.currentCanvasId].sessions.find((session: any) => session.id === defaultSession.id);
    expect(defaultPersisted?.isDefaultTitle).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!(window as any).__E2E__?.snapshot);
    app = await e2e(page);
    // The E2E bootstrap creates a fresh in-memory workspace and does not
    // restore the target. Hydration must still trust the persisted marker.
    await app.newWorkspace();
    await app.openChat();
    await expect.poll(async () => (await app.snapshot()).chat.target).toBeNull();
    await expect.poll(async () => (await app.snapshot()).chat.sessions.find((session: any) => session.id === defaultSession.id)?.title).toBe("Target-derived について");
    await expect.poll(async () => (await app.snapshot()).chat.sessions.find((session: any) => session.id === defaultSession.id)?.isDefaultTitle).toBe(true);
    const reloadedRaw = JSON.parse(await app.readChatSessionsRaw());
    const reloadedPersisted = reloadedRaw.canvases[(await app.snapshot()).currentCanvasId].sessions.find((session: any) => session.id === defaultSession.id);
    expect(reloadedPersisted?.title).toBe("Target-derived について");
    expect(reloadedPersisted?.isDefaultTitle).toBe(true);

    const input = page.getByTestId("assistant-prompt");
    const message = "  初回   Unicode 😀 title with more than twenty-four characters  ";
    const expectedTitle = Array.from(message.trim().replace(/\s+/g, " ")).slice(0, 24).join("");
    await input.fill(message);
    await input.press("Control+Enter");
    await expect.poll(async () => (await app.snapshot()).chat.sessions.find((session: any) => session.title === expectedTitle)?.title).toBe(expectedTitle);
    await expect.poll(async () => (await app.snapshot()).chat.sessions.find((session: any) => session.title === expectedTitle)?.isDefaultTitle).toBe(false);
    await expect.poll(async () => (await app.snapshot()).chat.saveError).toBeNull();
    const firstMessageRaw = JSON.parse(await app.readChatSessionsRaw());
    const firstMessagePersisted = firstMessageRaw.canvases[(await app.snapshot()).currentCanvasId].sessions.find((session: any) => session.title === expectedTitle);
    expect(firstMessagePersisted?.isDefaultTitle).toBe(false);

    const titleAfterFirstMessage = (await app.snapshot()).chat.sessions.find((session: any) => session.title === expectedTitle)?.title;
    expect(titleAfterFirstMessage).toBe(expectedTitle);
    await input.fill("second user message must not rename");
    await input.press("Control+Enter");
    await expect.poll(async () => (await app.snapshot()).chat.sessions.find((session: any) => session.title === titleAfterFirstMessage)?.title).toBe(titleAfterFirstMessage);
    await expect.poll(async () => JSON.parse(await app.readChatSessionsRaw()).canvases[(await app.snapshot()).currentCanvasId].sessions.find((session: any) => session.title === titleAfterFirstMessage)?.isDefaultTitle).toBe(false);
  });

  test("Direct late result is discarded after Canvas navigation and draft remains", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const sourceA = await app.addText("Delayed direct source A");
    const sourceB = await app.addText("Delayed direct source B");
    const root = await app.snapshot();
    const child = await app.createSubCanvas([sourceA!, sourceB!], "Delayed direct child");
    await app.navigate(child.childCanvasId);
    await app.selectNodes([sourceA!]);
    await app.openChat();
    await page.getByTestId("assistant-mode-direct").click();
    await page.getByTestId("direct-mode-image").click();
    const input = page.getByTestId("assistant-prompt");
    await input.fill("delayed direct image");
    const before = await app.snapshot();
    await app.armDelayedImageGeneration();
    await page.getByTestId("assistant-submit").click();
    await expect(page.getByRole("status").filter({ hasText: "Working" })).toBeVisible();
    await app.navigate(root.currentCanvasId);
    await app.releaseDelayedImageGeneration();
    await app.navigate(child.childCanvasId);
    await expect(input).toHaveValue("delayed direct image");
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.domainNodes.some((node: any) => node.kind === "image" && node.provenance?.prompt === "delayed direct image")).toBeFalsy();
  });

  test("Direct Text creates a real node and one Undo removes it", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    await page.getByTestId("assistant-mode-direct").click();
    const input = page.getByTestId("assistant-prompt");
    const before = await app.snapshot();
    await input.fill("create direct text");
    await page.getByTestId("assistant-submit").click();
    await expect(page.getByTestId("direct-result-surface")).toContainText("Direct Text", { timeout: 15_000 });
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount + 1);
    const created = after.domainNodes.find((node: any) => node.kind === "text" && node.provenance?.origin === "llm");
    expect(created?.id).toBeTruthy();
    await expect(page.getByTestId("direct-created-node-id")).toContainText(created.id);
    expect((await app.snapshot()).lastDirectReceipt?.createdNodeId).toBe(created.id);
    await page.getByTestId("direct-action-undo").click();
    await expect.poll(async () => (await app.snapshot()).nodeCount).toBe(before.nodeCount);
  });

  test("Direct Text delayed stale result keeps draft and creates no node", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const source = await app.addText("Delayed direct text source");
    const sourcePeer = await app.addText("Delayed direct text peer");
    const root = await app.snapshot();
    const child = await app.createSubCanvas([source!, sourcePeer!], "Delayed direct text child");
    await app.navigate(child.childCanvasId);
    await app.selectNodes([source!]);
    await app.openChat();
    await page.getByTestId("assistant-mode-direct").click();
    const input = page.getByTestId("assistant-prompt");
    await input.fill("delayed direct text");
    const before = await app.snapshot();
    await app.armDelayedTextGeneration();
    await page.getByTestId("assistant-submit").click();
    await expect(page.getByRole("status").filter({ hasText: "Working" })).toBeVisible();
    await app.navigate(root.currentCanvasId);
    await app.releaseDelayedTextGeneration();
    await app.navigate(child.childCanvasId);
    await expect(input).toHaveValue("delayed direct text");
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.domainNodes.some((node: any) => node.kind === "text" && node.provenance?.origin === "llm" && node.content === "fixture-llm-response")).toBeFalsy();
  });

  test("pending operation rejects duplicate actions and drawer reopen keeps progress", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    await page.getByTestId("assistant-mode-direct").click();
    await page.getByTestId("direct-mode-image").click();
    const input = page.getByTestId("assistant-prompt");
    await input.fill("operation guard image");
    await app.armDelayedImageGeneration();
    const submit = page.getByTestId("assistant-submit");
    await submit.click();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation?.kind).toBe("direct-image");
    await expect(submit).toBeDisabled();
    await expect(page.getByTestId("assistant-mode-chat")).toBeDisabled();
    await expect(page.getByTestId("assistant-mode-direct")).toBeDisabled();
    await expect(page.getByTestId("assistant-image-provider")).toBeDisabled();
    await expect(page.getByTestId("direct-mode-text")).toBeDisabled();
    await expect(page.getByTestId("direct-mode-image")).toBeDisabled();
    await expect(page.getByTestId("assistant-web-search")).toBeDisabled();
    await expect(page.getByTestId("assistant-next-action")).toBeDisabled();
    await page.getByTestId("assistant-close").click();
    await expect(page.locator("aside.fixed")).toHaveClass(/translate-x-full/);
    await app.openChat();
    await expect(page.getByRole("status").filter({ hasText: "Working" })).toBeVisible();
    await app.releaseDelayedImageGeneration();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation).toBeNull();
  });

  test("pending Chat search disables session, New, provider, tabs, and actions", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    await page.getByTestId("assistant-prompt").fill("pending chat search");
    await app.armDelayedSearchWeb();
    await page.getByTestId("assistant-web-search").click();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation?.kind).toBe("web-search");
    await expect(page.getByTestId("assistant-mode-chat")).toBeDisabled();
    await expect(page.getByTestId("assistant-mode-direct")).toBeDisabled();
    await expect(page.getByTestId("assistant-session")).toBeDisabled();
    await expect(page.getByTestId("assistant-new-session")).toBeDisabled();
    await expect(page.getByTestId("assistant-image-provider")).toBeDisabled();
    await expect(page.getByTestId("assistant-next-action")).toBeDisabled();
    await expect(page.getByTestId("assistant-web-search")).toBeDisabled();
    await app.releaseDelayedSearchWeb();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation).toBeNull();
  });

  test("Next Action cancel immediately releases the shared operation guard", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    await app.armDelayedNextActions();
    await page.getByTestId("assistant-next-action").click();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation?.kind).toBe("next-actions");
    await page.getByTestId("next-action-cancel").click();
    await expect.poll(async () => (await app.snapshot()).chat.activeOperation).toBeNull();
    await expect.poll(async () => (await app.orchestrationSnapshot()).status).toBe("cancelled");
    await app.releaseDelayedNextActions();
  });

  test("assistant layout stays within viewport at supported sizes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("assistant-action-row")).toBeVisible();
      const layout = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        drawerWidth: document.querySelector("aside.fixed")?.getBoundingClientRect().width ?? 0,
      }));
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.bodyClientWidth);
      expect(layout.drawerWidth).toBeGreaterThanOrEqual(320);
      expect(layout.drawerWidth).toBeLessThanOrEqual(viewport.width * 0.8 + 1);
    }
  });

  test("Tab order reaches visible Assistant tabs, input, and action row targets", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();
    const directTab = page.getByTestId("assistant-mode-direct");
    await directTab.focus();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("tab");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("assistant-session")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("assistant-new-session")).toBeFocused();
    await page.getByTestId("assistant-prompt").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("assistant-next-action")).toBeFocused();
  });
});
