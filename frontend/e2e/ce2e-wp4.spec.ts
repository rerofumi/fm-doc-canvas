import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("WP-4 context badge and resolver contract", () => {
  test("Chat, Direct Text, and Direct Image badges match resolver payload counts", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const text = await app.addText("context text");
    const image = await app.addImage("generated/context.png", "context image");
    await app.selectNodes([text!, image!]);
    await app.openChat();

    const badge = page.getByTestId("context-preview");
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute("data-context-mode", "dialogue");
    await expect(badge).toHaveAttribute("data-context-operation", "read");
    await expect(badge).toContainText("1 text");
    await expect(badge).toContainText("1 image");
    await expect(badge).toHaveAttribute("aria-label", "Context payload: 1 text, 1 image");
    expect((await app.snapshot()).context.payloadItems.filter((item: any) => item.kind === "text")).toHaveLength(1);
    expect((await app.snapshot()).context.payloadItems.filter((item: any) => item.kind.startsWith("image"))).toHaveLength(1);
    await expect(badge.getByRole("button")).toHaveCount(0);
    await expect(badge.locator("input[type=checkbox]")).toHaveCount(0);

    await page.getByTestId("assistant-mode-direct").click();
    await expect(badge).toHaveAttribute("data-context-mode", "direct");
    await expect(badge).toHaveAttribute("data-context-operation", "generate-text");
    await expect(badge).toContainText("1 text");
    await expect(badge).toContainText("1 image");
    let direct = await app.snapshot();
    expect(direct.directContext.payloadItems.filter((item: any) => item.kind === "text")).toHaveLength(1);
    expect(direct.directContext.payloadItems.filter((item: any) => item.kind.startsWith("image"))).toHaveLength(1);

    await page.getByTestId("direct-mode-image").click();
    await expect(badge).toHaveAttribute("data-context-operation", "generate-image");
    await expect(badge).toContainText("1 text");
    await expect(badge).toContainText("1 image");
    direct = await app.snapshot();
    expect(direct.directImageContext.payloadItems.filter((item: any) => item.kind === "text")).toHaveLength(1);
    expect(direct.directImageContext.payloadItems.filter((item: any) => item.kind.startsWith("image"))).toHaveLength(1);
  });

  test("Direct selector is outside action row and follows the body", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    await app.openChat();

    const directSelector = page.getByTestId("direct-mode-selector");
    await expect(directSelector).toHaveCount(0);
    await page.getByTestId("assistant-mode-direct").click();
    await expect(directSelector).toBeVisible();
    await expect(page.getByTestId("assistant-action-row")).toBeVisible();

    const order = await page.locator("aside").evaluate((aside) => {
      const ids = [
        "direct-result-surface",
        "direct-mode-selector",
        "context-preview",
        "assistant-prompt",
        "assistant-action-row",
      ];
      return ids.map((id) => {
        const node = aside.querySelector(`[data-testid="${id}"]`);
        return node ? Array.from(aside.querySelectorAll("*" )).indexOf(node) : -1;
      });
    });
    expect(order.every((index) => index >= 0)).toBeTruthy();
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("legacy exclusion is ignored after re-selection and badge count increases", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const first = await app.addText("legacy excluded text");
    const second = await app.addText("reselected text");
    await app.selectNodes([first!]);
    await app.exclude(first!, true);
    await app.openChat();

    const badge = page.getByTestId("context-preview");
    await expect(badge).toContainText("1 text");
    let snapshot = await app.snapshot();
    expect(snapshot.context.payloadItems.some((item: any) => item.kind === "text" && item.nodeId === first)).toBeTruthy();

    await app.selectNodes([second!]);
    await expect(badge).toContainText("1 text");
    snapshot = await app.snapshot();
    expect(snapshot.context.payloadItems.some((item: any) => item.kind === "text" && item.nodeId === second)).toBeTruthy();

    await app.selectNodes([first!, second!]);
    await expect(badge).toContainText("2 texts");
    snapshot = await app.snapshot();
    expect(snapshot.context.payloadItems.filter((item: any) => item.kind === "text")).toHaveLength(2);
    expect(snapshot.context.payloadItems.some((item: any) => item.nodeId === first)).toBeTruthy();
    expect(snapshot.context.payloadItems.some((item: any) => item.nodeId === second)).toBeTruthy();
    await expect(badge.getByRole("button")).toHaveCount(0);
    await expect(badge.locator("input[type=checkbox]")).toHaveCount(0);
  });
});
