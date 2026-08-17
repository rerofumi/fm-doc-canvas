import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("late chat stream and tool events stay inert after mutation cancel and Undo", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const injected = await api.injectProposal({
    toolCallId: "round4-late-tool",
    operation: "create",
    proposed: "old proposal",
  });
  const beforeMutation = await api.snapshot();

  await api.addText("mutation");
  await api.undo();
  const beforeLateEvents = await api.snapshot();
  expect(beforeLateEvents.asyncRuns[injected.runId].status).toBe("cancelled");
  const cancelledMessage = beforeLateEvents.chat.sessions
    .flatMap((session: any) => session.messages)
    .find((message: any) => message.runId === injected.runId);
  expect(cancelledMessage).toMatchObject({
    content: "",
    messageDescriptor: { code: "chat.cancelled" },
    status: "cancelled",
  });
  expect(cancelledMessage.content).not.toContain("キャンセルしました");
  await expect(page.getByText("Cancelled.", { exact: false })).toBeVisible();

  // Domain cancellation stores only the locale-neutral descriptor. MessageBubble
  // must re-present that same message when the application locale changes.
  await page.getByTestId("assistant-close").click();
  await page.getByTestId("shell-settings").click();
  const settings = page.getByTestId("settings-drawer");
  await settings.locator("#settings-language").selectOption("ja");
  await settings.locator("button").first().click();
  await page.getByTestId("shell-chat-toggle").click();
  await expect(page.getByText("キャンセルしました。", { exact: false })).toBeVisible();

  for (const event of [
    {
      runId: injected.runId,
      sessionId: injected.sessionId,
      type: "chat:stream",
      text: "late stream",
    },
    {
      runId: injected.runId,
      sessionId: injected.sessionId,
      type: "chat:tool_start",
      toolEvent: {
        toolCallId: "round4-late-start",
        name: "late_tool",
        status: "running",
      },
    },
    {
      runId: injected.runId,
      sessionId: injected.sessionId,
      type: "chat:tool_done",
      toolEvent: {
        toolCallId: "round4-late-done",
        name: "late_tool",
        status: "done",
      },
    },
  ] as const) {
    await api.emitChatEvent(event);
  }

  const afterLateEvents = await api.snapshot();
  expect(afterLateEvents.chat.sessions).toEqual(beforeLateEvents.chat.sessions);
  expect(afterLateEvents.json).toBe(beforeLateEvents.json);
  expect(afterLateEvents.domainNodes).toEqual(beforeLateEvents.domainNodes);
  expect(beforeMutation.chat.sessions.length).toBeGreaterThan(0);
});

test("pane context menu Escape returns focus to the Canvas root", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const pane = page.locator(".react-flow__pane").first();
  await pane.click({ button: "right", position: { x: 120, y: 120 } });
  await expect(page.getByRole("menu", { name: "Canvas options" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="canvas-root"]')).toBeFocused();
});
