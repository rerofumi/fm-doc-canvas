import { expect, test } from "@playwright/test";
import {
  e2e,
  expectEffectiveLocale,
  openApp,
  setLocaleBeforeLoad,
  switchLocale,
} from "./helpers";

for (const locale of ["ja", "en"] as const) {
  test.describe(`I18N matrix ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page, { locale });
    });

    test("I18N-01 first UI uses system/invalid/explicit effective locale", async ({ page }) => {
      await expectEffectiveLocale(page, locale);
      await expect(page.getByTestId("shell-add-text")).toBeVisible();
      await expect(page.getByTestId("shell-settings")).toBeVisible();
      await expect(page.locator("html")).not.toHaveAttribute("lang", "system");
    });

    test("I18N-02 switch and reload preserve explicit preference and state", async ({ page }) => {
      await page.getByTestId("shell-settings").click();
      await expect(page.getByTestId("settings-drawer")).toBeVisible();
      await switchLocale(page, locale === "ja" ? "en" : "ja");
      await expectEffectiveLocale(page, locale === "ja" ? "en" : "ja");
      await expect(page.getByTestId("settings-drawer")).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("shell-add-text")).toBeVisible();
      await expectEffectiveLocale(page, locale === "ja" ? "en" : "ja");
      expect(await page.evaluate(() => localStorage.getItem("fm-doc-canvas.locale"))).toBe(locale === "ja" ? "en" : "ja");
    });

    test("I18N-03 shell/settings/canvas dialog copy and accessible names", async ({ page }) => {
      await page.getByTestId("shell-add-text").click();
      await expect(page.locator('[data-testid="canvas-root"]')).toBeVisible();
      await page.getByTestId("shell-settings").click();
      await expect(page.getByTestId("settings-drawer")).toContainText(locale === "ja" ? "言語" : "Language");
      await page.getByTestId("clear-canvas-action").click();
      const dialog = page.getByTestId("clear-canvas-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(locale === "ja" ? "Canvas" : "Clear Canvas");
      await expect(dialog.locator("button").first()).toBeFocused();
    });

    test("I18N-04 assistant/direct/context surfaces redraw in locale", async ({ page }) => {
      await page.getByTestId("shell-chat-toggle").click();
      const drawer = page.getByTestId("chat-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText(locale === "ja" ? "メッセージ" : "message");
      await expect(drawer.locator("input, textarea").first()).toBeVisible();
      await expect(drawer.locator("button").filter({ has: page.locator("svg") }).first()).toBeVisible();
    });

    test("I18N-05 localized error keeps recovery guidance without raw diagnostics", async ({ page }) => {
      const app = await e2e(page);
      await page.getByTestId("shell-chat-toggle").click();
      await app.armSearchFault("search-failed");
      // Start the real WebSearch path so the failure is rendered by the same
      // packet/tool boundary used in production, rather than only arming a
      // fixture fault.
      await app.searchWeb("localized recovery query", { entryRoute: "dialogue-agent" });
      const drawer = page.getByTestId("chat-drawer");
      await expect(drawer).toBeVisible();
      const panel = page.getByTestId("projected-context-panel");
      await expect(panel).toBeVisible();
      const alert = panel.getByRole("alert");
      await expect(alert).toContainText(locale === "ja" ? "検索結果を読み込めませんでした" : "search result could not be loaded");
      await expect(panel).not.toContainText("search-failed");
      await expect(panel).not.toContainText("Error:");
      await panel.getByTestId("projected-context-open-settings").click();
      await expect(page.getByTestId("settings-drawer")).toBeVisible();
      await switchLocale(page, locale === "ja" ? "en" : "ja");
      await expectEffectiveLocale(page, locale === "ja" ? "en" : "ja");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("alert")).toContainText(locale === "ja" ? "search result could not be loaded" : "検索結果を読み込めませんでした");
      await expect(panel).not.toContainText("search-failed");
    });

    test("I18N-06 canvas save/load faults stay semantic, recover, and retranslate", async ({ page }) => {
      const app = await e2e(page);
      await app.newWorkspace();
      const nodeId = await app.addText("save-load-content");
      const before = await app.snapshot();
      const alternate = locale === "ja" ? "en" : "ja";

      await page.getByTestId("shell-settings").click();
      await app.armCanvasFileFault("save");
      await page.getByTestId("save-canvas-action").click();
      const banner = page.getByTestId("global-error-banner");
      await expect(banner).toContainText(
        locale === "ja" ? "Canvasを保存できませんでした" : "Canvas could not be saved",
      );
      await expect(banner).not.toContainText("e2e canvas save binding fault");
      const saveFault = await app.snapshot();
      expect(saveFault.domainNodes.find((node: any) => node.id === nodeId)?.content).toBe("save-load-content");
      expect(saveFault.workspaceId).toBe(before.workspaceId);

      await switchLocale(page, alternate);
      await expect(banner).toContainText(
        alternate === "ja" ? "Canvasを保存できませんでした" : "Canvas could not be saved",
      );
      expect((await app.snapshot()).lastError).toBe("canvas.saveFailed");

      // The one-shot seam is consumed; retrying follows the same production
      // store/binding path and closes Settings on success.
      await page.getByTestId("save-canvas-action").click();
      await expect(page.getByTestId("settings-drawer")).toHaveClass(/translate-x-full/);

      await page.getByTestId("shell-settings").click();
      await app.armCanvasFileFault("load");
      await page.getByTestId("load-canvas-action").click();
      await expect(banner).toContainText(
        alternate === "ja" ? "Canvasを読み込めませんでした" : "Canvas could not be loaded",
      );
      await expect(banner).not.toContainText("e2e canvas load binding fault");
      expect((await app.snapshot()).lastError).toBe("canvas.loadFailed");

      await switchLocale(page, locale);
      await expect(banner).toContainText(
        locale === "ja" ? "Canvasを読み込めませんでした" : "Canvas could not be loaded",
      );
      const loadFault = await app.snapshot();
      expect(loadFault.domainNodes.find((node: any) => node.id === nodeId)?.content).toBe("save-load-content");
      expect(loadFault.workspaceId).toBe(before.workspaceId);
    });

    test("I18N-06 user content and default workspace data survive language switch", async ({ page }) => {
      const bridge = await page.evaluateHandle(() => (window as any).__E2E__);
      const initial = await page.evaluate(() => (window as any).__E2E__.snapshot());
      await page.evaluate(() => (window as any).__E2E__.addText("user-owned-content"));
      await page.getByTestId("shell-settings").click();
      await switchLocale(page, locale === "ja" ? "en" : "ja");
      const after = await page.evaluate(() => (window as any).__E2E__.snapshot());
      expect(JSON.stringify(after)).toContain("user-owned-content");
      expect(JSON.stringify(after)).not.toContain("fm-doc-canvas.locale");
      await bridge.dispose();
      expect(initial).toBeTruthy();
    });

    test("I18N-05 proposal and SubCanvas recovery retranslate without raw diagnostics", async ({ page }) => {
      const app = await e2e(page);
      await app.newWorkspace();
      const source = await app.addText("fault source");
      const target = await app.addText("fault target");
      const snapshot = await app.snapshot();
      await page.getByTestId("shell-chat-toggle").click();
      await app.armTransformFault();
      await app.injectProposal({
        toolCallId: "i18n-fault-" + locale,
        operation: "transform",
        proposed: "fault proposal",
        transform: {
          operation: "compare",
          sourceNodeIds: [source, target],
          sourceRevisions: {
            [source!]: snapshot.domainNodes.find((node: any) => node.id === source).revision,
            [target!]: snapshot.domainNodes.find((node: any) => node.id === target).revision,
          },
          content: "fault proposal",
          summary: "fault",
          reason: "fixture",
          suggestedRelations: [],
        },
      });
      const card = page.locator('[data-testid="tool-card-i18n-fault-' + locale + '"]');
      await expect(card).toBeVisible();
      await card.getByTestId("tool-decision-accept").click();
      const proposalAlert = card.getByRole("alert");
      await expect(proposalAlert).toBeVisible();
      const firstProposalCopy = await proposalAlert.innerText();
      expect(firstProposalCopy).not.toContain("apply-transform-before-commit");
      await page.getByTestId("assistant-close").click();
      await page.getByTestId("shell-settings").click();
      await switchLocale(page, locale === "ja" ? "en" : "ja");
      await expect(proposalAlert).toBeVisible();
      expect(await proposalAlert.innerText()).not.toBe(firstProposalCopy);

      await page.getByTestId("settings-close").click();
      const groupA = await app.addText("group A");
      const groupB = await app.addText("group B");
      const group = await app.createSubCanvas([groupA!, groupB!], "Fault group");
      await app.openContextMenu({ type: "node", id: group.folderId });
      await page.getByTestId("context-menu-rename-subcanvas").click();
      const rename = page.getByTestId("subcanvas-name");
      await rename.fill(" ");
      await page.getByTestId("subcanvas-confirm-rename").click();
      const subcanvasAlert = page.getByRole("dialog").getByRole("alert");
      await expect(subcanvasAlert).toBeVisible();
      const firstSubcanvasCopy = await subcanvasAlert.innerText();
      expect(firstSubcanvasCopy).not.toContain("Error:");
      expect(firstSubcanvasCopy.length).toBeGreaterThan(0);
      await switchLocale(page, locale);
      await expect(subcanvasAlert).toBeVisible();
      const secondSubcanvasCopy = await subcanvasAlert.innerText();
      expect(secondSubcanvasCopy).not.toBe(firstSubcanvasCopy);
      expect(secondSubcanvasCopy).not.toContain("Error:");
      await page.getByTestId("subcanvas-name").fill("Fault group renamed");
      await page.getByTestId("subcanvas-confirm-rename").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("I18N-07 all primary surfaces fit at both supported viewports", async ({ page }) => {
      const app = await e2e(page);
      const expectInViewport = async (locator: import("@playwright/test").Locator) => {
        const metrics = await locator.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });
        expect(metrics.left).toBeGreaterThanOrEqual(-1);
        expect(metrics.top).toBeGreaterThanOrEqual(-1);
        expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      };
      for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
        await page.setViewportSize(viewport);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await expect(page.getByTestId("shell-add-text")).toBeVisible();
        await expectInViewport(page.locator("header").last());
        await page.getByTestId("shell-settings").click();
        await page.waitForTimeout(350);
        const settings = page.getByTestId("settings-drawer");
        await expect(settings).toBeVisible();
        await expectInViewport(settings);
        await expect(page.getByTestId("clear-canvas-action")).toBeVisible();
        await page.getByTestId("clear-canvas-action").scrollIntoViewIfNeeded();
        await expectInViewport(page.getByTestId("clear-canvas-action"));
        await page.getByTestId("clear-canvas-action").click();
        const dialog = page.getByTestId("clear-canvas-dialog");
        await expect(dialog).toBeVisible();
        await expectInViewport(dialog);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await page.getByTestId("settings-close").click();

        await page.getByTestId("shell-chat-toggle").click();
        await page.waitForTimeout(350);
        const assistant = page.getByTestId("chat-drawer");
        await expect(assistant).toBeVisible();
        await expectInViewport(assistant);
        await page.getByTestId("assistant-submit").scrollIntoViewIfNeeded();
        await expectInViewport(page.getByTestId("assistant-submit"));
        await expect(page.getByTestId("assistant-submit")).toBeVisible();
        await app.injectProposal({
          toolCallId: `i18n-proposal-${locale}-${viewport.width}`,
          operation: "create",
          proposed: "viewport proposal",
          filename: "viewport.md",
        });
        const proposal = page.getByTestId(`tool-card-i18n-proposal-${locale}-${viewport.width}`);
        await expect(proposal).toBeVisible();
        await proposal.scrollIntoViewIfNeeded();
        await expectInViewport(proposal);
        await expect(proposal.getByTestId("tool-decision-accept")).toBeVisible();

        const node = await app.addText("viewport context");
        await app.selectNodes([node!]);
        await app.openContextMenu({ type: "node", id: node! });
        await expect(page.getByTestId("context-menu-transform-summarize")).toBeVisible();
        const contextMenu = page.locator('[role="menu"]').last();
        await expect(contextMenu).toBeVisible();
        await expectInViewport(contextMenu);
        await expectInViewport(page.getByTestId("context-menu-transform-summarize"));
        await page.keyboard.press("Escape");

        await app.searchWeb("viewport search", { entryRoute: "direct-action" });
        const projected = page.getByTestId("projected-context-panel");
        await expect(projected).toBeVisible();
        await expectInViewport(projected);
        await expect(projected.getByTestId("projected-context-close")).toBeVisible();
        await projected.getByTestId("projected-context-close").click();
        await page.getByTestId("assistant-close").click();
      }
    });
  });
}

test("I18N-01 system and invalid preferences resolve deterministically before first render", async ({ page }) => {
  await setLocaleBeforeLoad(page, "system", ["ja-JP", "en-US"]);
  await openApp(page, { locale: "system", navigatorLanguages: ["ja-JP", "en-US"] });
  await expectEffectiveLocale(page, "ja");
  await page.evaluate(() => localStorage.setItem("fm-doc-canvas.locale", "invalid"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectEffectiveLocale(page, "ja");
});

test("I18N-02 browser languagechange updates system locale and ignores explicit locale", async ({ page }) => {
  await setLocaleBeforeLoad(page, "system", ["en-US"]);
  await openApp(page, { locale: "system", navigatorLanguages: ["en-US"] });
  await expectEffectiveLocale(page, "en");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["ja-JP"] });
    Object.defineProperty(navigator, "language", { configurable: true, get: () => "ja-JP" });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expectEffectiveLocale(page, "ja");
  await expect(page.getByTestId("shell-add-text")).toContainText("テキスト");

  await page.evaluate(() => localStorage.setItem("fm-doc-canvas.locale", "en"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectEffectiveLocale(page, "en");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["ja-JP"] });
    Object.defineProperty(navigator, "language", { configurable: true, get: () => "ja-JP" });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expectEffectiveLocale(page, "en");
  await expect(page.getByTestId("shell-add-text")).toContainText("Text");
});
