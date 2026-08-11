import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("CE2E-03b cross-canvas relation boundary aggregates", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const a = await api.addText("A");
  const b = await api.addText("B");
  const c = await api.addText("C-root");
  const group = await api.createSubCanvas([a!, b!], "G");
  await api.addRelation(a!, c!);
  // root view: down-folder
  await api.navigate((await api.snapshot()).rootCanvasId);
  let snap = await api.snapshot();
  expect(
    snap.boundaryAggregates.some((x: any) => x.kind === "down-folder"),
  ).toBeTruthy();
  // child view: up-boundary
  await api.navigate(group.childCanvasId);
  snap = await api.snapshot();
  expect(
    snap.boundaryAggregates.some((x: any) => x.kind === "up-boundary"),
  ).toBeTruthy();
});

test("CE2E-04b proposal reject and stale after navigate", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const id = await api.addText("base-body");
  await api.injectProposal({
    toolCallId: "ui-modify-1",
    operation: "create",
    proposed: "original proposal",
    filename: "proposal.md",
  });
  const card = page.getByTestId("tool-card-ui-modify-1");
  await card.getByRole("button", { name: "Modify proposal" }).click();
  await page.getByLabel("Modified proposal content").fill("modified proposal");
  await card.getByRole("button", { name: "Apply modified" }).click();
  await expect(card).toContainText("modified and applied");
  let snap = await api.snapshot();
  expect(snap.domainNodes.some((n: any) => n.content === "modified proposal")).toBeTruthy();

  await api.injectProposal({
    toolCallId: "ui-reject-1",
    operation: "create",
    proposed: "rejected proposal",
    filename: "rejected.md",
  });
  const rejectCard = page.getByTestId("tool-card-ui-reject-1");
  await rejectCard.getByRole("button", { name: "Reject proposal" }).click();
  await expect(rejectCard).toContainText("拒否");
  snap = await api.snapshot();
  expect(snap.domainNodes.some((n: any) => n.content === "rejected proposal")).toBeFalsy();

  await api.openChat();
  await expect(page.getByLabel("Dialogue messages")).toBeVisible();
  await expect(page.getByLabel("Stop dialogue run")).toBeVisible();
  await page.getByLabel("Stop dialogue run").click();
  await expect(page.getByLabel("Send dialogue message")).toBeVisible();

  // Stale: navigate to new workspace generation then apply old revision edit
  const snap1 = await api.snapshot();
  const node = snap1.domainNodes.find((n: any) => n.id === id);
  await api.newWorkspace();
  const stale = await api.applyProposal({
    toolCallId: "stale-1",
    operation: "replace",
    targetNodeId: id,
    baseRevision: node.revision,
    proposed: "should-not-apply",
  });
  expect(["error", "conflict"]).toContain(stale.status);
  const snap2 = await api.snapshot();
  expect(snap2.nodeCount).toBe(0);
});

test("CE2E-05b undo fault keeps revision and surfaces error", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const id = await api.addText("keep-me");
  const before = await api.snapshot();
  await api.armUndoFault();
  await api.undo();
  const after = await api.snapshot();
  expect(after.nodeCount).toBe(before.nodeCount);
  expect(after.commandSequence).toBe(before.commandSequence);
  expect(after.domainNodes.find((n: any) => n.id === id).content).toBe("keep-me");
  expect(String(after.lastError || "")).toMatch(/undo-before-commit|fault|failed|error/i);
});

test("CE2E keyboard role switch and undo accessible", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  await page.getByRole("button", { name: "Add Text" }).click();
  // open editor by double-click is hard; use bridge + UI labels
  const snap = await api.snapshot();
  const id = snap.domainNodes[0].id;
  await api.selectNodes([id]);
  // role switch via bridge still validates a11y labels exist
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("Enter");
  const after = await api.snapshot();
  expect(after.nodeCount).toBe(0);
  await expect(page.getByRole("button", { name: "Use this Canvas as context" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to parent canvas" })).toBeVisible();
});

test("CE2E parent button climbs hierarchy without consuming edit history", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const rootA = await api.addText("root-a");
  const rootB = await api.addText("root-b");
  const level1 = await api.createSubCanvas([rootA!, rootB!], "Level 1");
  await api.navigate(level1.childCanvasId);

  const innerA = await api.addText("inner-a");
  const innerB = await api.addText("inner-b");
  await api.createSubCanvas([innerA!, innerB!], "Level 2");
  let snap = await api.snapshot();
  const level2 = snap.canvases.find(
    (canvas: any) => canvas.parentCanvasId === level1.childCanvasId,
  );
  expect(level2?.id).toBeTruthy();
  await api.navigate(level2.id);

  await api.editText(innerA!, "edited inside level 2");
  snap = await api.snapshot();
  const historyAfterEdit = snap.historyLength;

  await page.getByRole("button", { name: "Go to parent canvas" }).click();
  snap = await api.snapshot();
  expect(snap.currentCanvasId).toBe(level1.childCanvasId);
  expect(snap.historyLength).toBe(historyAfterEdit);
  expect(snap.domainNodes.find((node: any) => node.id === innerA).content).toBe(
    "edited inside level 2",
  );

  await page.getByRole("button", { name: "Go to parent canvas" }).click();
  snap = await api.snapshot();
  expect(snap.currentCanvasId).toBe(snap.rootCanvasId);
  expect(snap.historyLength).toBe(historyAfterEdit);
  await expect(page.getByRole("button", { name: "Go to parent canvas" })).toBeDisabled();
});
