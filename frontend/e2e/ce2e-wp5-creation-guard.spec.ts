import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("WP-5 new-node creation guard guidance", () => {
  test("Text guard error shows canonical resend guidance and keeps Canvas unchanged", async ({ page }) => {
    await openApp(page);
    const api = await e2e(page);
    await api.newWorkspace();
    await api.openChat();

    await page.getByLabel("Chat message input").fill("fixture:create_text_node Text Nodeを作成しないで");
    await page.getByRole("button", { name: "送信" }).click();

    const error = page.getByRole("alert").filter({ hasText: "新しい Text Node を作成してください" });
    await expect(error).toContainText("現在のメッセージ");
    await expect(error).toContainText("明記");
    await expect(error).toContainText("変更は未適用");
    expect((await api.snapshot()).domainNodes).toHaveLength(0);
  });

  test("Artifact guard error shows canonical resend guidance and keeps Canvas unchanged", async ({ page }) => {
    await openApp(page);
    const api = await e2e(page);
    await api.newWorkspace();
    await api.openChat();

    await page.getByLabel("Chat message input").fill("fixture:create_artifact Artifact Nodeとして書き込まないで");
    await page.getByRole("button", { name: "送信" }).click();

    const error = page.getByRole("alert").filter({ hasText: "新しい Artifact Node を作成してください" });
    await expect(error).toContainText("現在のメッセージ");
    await expect(error).toContainText("明記");
    await expect(error).toContainText("変更は未適用");
    expect((await api.snapshot()).domainNodes).toHaveLength(0);
  });
});
