import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("F5 Generated Structures core", () => {
  test("F5-01 Direct relation batch preview, accept, and one undo", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const sourceA = await app.addText("Alpha relation source");
    const sourceB = await app.addText("Beta relation target");
    await app.selectNodes([sourceA!, sourceB!]);
    const before = await app.snapshot();

    expect(before.chat.sessions).toHaveLength(0);
    await expect(app.suggestRelations()).resolves.toBeTruthy();
    const card = page.getByTestId("relation-batch-proposal");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Accept selected (1)" })).toBeVisible();

    let snap = await app.snapshot();
    expect(snap.relationCount).toBe(0);
    expect(snap.chat.sessions).toHaveLength(0);
    await card.getByRole("button", { name: "Accept selected (1)" }).click();

    snap = await app.snapshot();
    expect(snap.relationCount).toBe(1);
    expect(snap.pendingDirectProposal).toBeNull();
    await app.undo();
    snap = await app.snapshot();
    expect(snap.relationCount).toBe(0);
  });

  test("F5-02 Dialogue relation batch and Cluster View proposals", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const sourceA = await app.addText("Dialogue relation source");
    const sourceB = await app.addText("Dialogue relation target");
    await app.selectNodes([sourceA!, sourceB!]);
    await app.openChat();
    const input = page.getByPlaceholder(/メッセージを入力/);
    await input.fill("fixture:relation-batch");
    await input.press("Enter");

    const relationCard = page.getByTestId("relation-batch-proposal");
    await expect(relationCard).toBeVisible({ timeout: 15_000 });
    await expect(relationCard).toContainText("fixture relation batch");
    await relationCard
      .getByRole("button", { name: "Accept selected dialogue relations" })
      .click();
    expect((await app.snapshot()).relationCount).toBe(1);

    await app.newWorkspace();
    const clusterA = await app.addText("Dialogue cluster A");
    const clusterB = await app.addText("Dialogue cluster B");
    const clusterC = await app.addText("Dialogue cluster C");
    await app.selectNodes([clusterA!, clusterB!, clusterC!]);
    await app.openChat();
    await page.getByPlaceholder(/メッセージを入力/).fill("fixture:cluster-view");
    await page.getByPlaceholder(/メッセージを入力/).press("Enter");

    const viewCard = page.getByTestId("generated-view-proposal");
    await expect(viewCard).toBeVisible({ timeout: 15_000 });
    await expect(viewCard).toContainText("Fixture View");
    const beforeAccept = await app.snapshot();
    expect(beforeAccept.activeGeneratedView).toBeNull();
    await page.getByRole("button", { name: "Accept proposal" }).click();
    const afterAccept = await app.snapshot();
    expect(afterAccept.activeGeneratedView?.label).toBe("Fixture View");
    expect(afterAccept.chat.sessions.length).toBeGreaterThan(0);
  });

  test("F5-03 Cluster View overlay, hints, conversion, and composite undo", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("View member A");
    const b = await app.addText("View member B");
    const c = await app.addText("View member C");
    await app.addText("View member D");
    const before = await app.snapshot();

    await app.suggestClusters();
    const proposal = page.getByTestId("cluster-view-proposal");
    await expect(proposal).toBeVisible();
    await proposal.getByRole("button", { name: "Accept cluster view" }).click();
    await expect(page.getByTestId("generated-view-banner")).toBeVisible();

    let snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount);
    expect(snap.relationCount).toBe(before.relationCount);
    expect(snap.activeGeneratedView?.clusters).toHaveLength(2);
    expect(snap.context.viewHints.length).toBeGreaterThan(0);
    expect(snap.json).not.toContain("Fixture View");

    await page.getByRole("button", { name: "Convert Cluster B to SubCanvas" }).click();
    const dialog = page.getByTestId("convert-cluster-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Folder label").fill("Converted evidence");
    await dialog.getByRole("button", { name: "Confirm convert to SubCanvas" }).click();

    snap = await app.snapshot();
    expect(snap.domainNodes.some((node: any) => node.kind === "folder" && node.label === "Converted evidence")).toBeTruthy();
    expect(snap.activeGeneratedView?.clusters).toHaveLength(1);
    await app.undo();
    snap = await app.snapshot();
    expect(snap.domainNodes.some((node: any) => node.kind === "folder")).toBeFalsy();
    expect(snap.activeGeneratedView?.clusters).toHaveLength(2);
  });

  test("F5-04 delayed suggestion becomes a no-op after New Workspace", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Delayed A");
    const b = await app.addText("Delayed B");
    await app.selectNodes([a!, b!]);
    await app.armDelayedSuggest();
    const pending = app.suggestRelations();
    await expect
      .poll(async () => (await app.snapshot()).lastSuggestReceipt?.status)
      .toBe("pending");
    await app.newWorkspace();
    await app.releaseDelayedSuggest();
    await expect(pending).resolves.toBeFalsy();

    const snap = await app.snapshot();
    expect(snap.nodeCount).toBe(0);
    expect(snap.pendingDirectProposal).toBeNull();
    expect(snap.lastSuggestReceipt?.status).toBe("error");
  });

  test("F5-05 invalid suggestion leaves document unchanged and exposes error", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Error A");
    const b = await app.addText("Error B");
    await app.selectNodes([a!, b!]);
    const before = await app.snapshot();
    await app.armSuggestFault("suggest-invalid-json");

    await expect(app.suggestRelations()).resolves.toBeFalsy();
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.relationCount).toBe(before.relationCount);
    expect(after.pendingDirectProposal).toBeNull();
    expect(after.lastError).toContain("suggest-invalid-json");
    await expect(page.getByText("suggest-invalid-json", { exact: false })).toBeVisible();
  });
});
