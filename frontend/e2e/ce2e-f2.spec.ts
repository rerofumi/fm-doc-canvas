import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("F2-01 Direct Action, post-apply diff, and Undo UI", async ({ page }) => {
  const app = await e2e(page);
  await app.newWorkspace();
  const sourceA = await app.addText("Alpha claim");
  const sourceB = await app.addText("Beta claim");
  await app.moveNode(sourceA!, 40, 80);
  await app.moveNode(sourceB!, 600, 80);
  await page.locator(".react-flow__controls-fitview").click();

  // Exercise the real React Flow multi-select path. Do not inject domain
  // selection through the E2E bridge: that previously masked a click handler
  // which collapsed Ctrl-click selection back to one node.
  const sourceANode = page.locator(`.react-flow__node[data-id="${sourceA}"]`);
  const sourceBNode = page.locator(`.react-flow__node[data-id="${sourceB}"]`);
  await sourceANode.click();
  await expect(sourceANode).toHaveClass(/selected/);
  await sourceBNode.click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await sourceBNode.click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  await sourceBNode.click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);

  await sourceBNode.click({ button: "right" });
  const compareItem = page.getByTestId("context-menu-transform-compare");
  await expect(compareItem).toBeVisible();
  await compareItem.click();

  const receipt = page.getByTestId("direct-action-receipt");
  await expect(receipt).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("direct-action-diff")).toBeVisible();
  await expect(page.getByTestId("direct-diff-output")).toContainText(/fixture-llm-response|result/i);
  await expect(page.getByTestId(`direct-diff-source-${sourceA}`)).toBeVisible();
  await expect(page.getByTestId(`direct-diff-source-${sourceB}`)).toBeVisible();

  const applied = await app.snapshot();
  expect(applied.nodeCount).toBe(3);
  expect(applied.relationCount).toBe(2);
  expect(applied.lastDirectReceipt.operation).toBe("compare");
  expect(applied.chat.sessions).toHaveLength(0);

  await page.getByTestId("direct-action-undo").click();
  const undone = await app.snapshot();
  expect(undone.nodeCount).toBe(2);
  expect(undone.relationCount).toBe(0);
  await expect(page.getByTestId("direct-action-receipt")).toHaveCount(0);
});

test("F2-02 Transform Proposal preview Accept Modify Reject Stop stale and atomic fault", async ({ page }) => {
  const app = await e2e(page);
  await app.newWorkspace();
  const sourceA = await app.addText("Proposal Alpha");
  const sourceB = await app.addText("Proposal Beta");
  const before = await app.snapshot();

  // Reject path — unaccepted candidate must not enter document.
  await app.injectProposal({
    toolCallId: "f2-tf-reject",
    operation: "transform",
    proposed: "rejected derived",
    transform: {
      operation: "compare",
      sourceNodeIds: [sourceA, sourceB],
      sourceRevisions: {
        [sourceA!]: before.domainNodes.find((n: any) => n.id === sourceA).revision,
        [sourceB!]: before.domainNodes.find((n: any) => n.id === sourceB).revision,
      },
      content: "rejected derived",
      summary: "reject me",
      reason: "trial",
      sources: [
        { nodeId: sourceA, content: "Proposal Alpha", revision: 0 },
        { nodeId: sourceB, content: "Proposal Beta", revision: 0 },
      ],
      suggestedRelations: [],
    },
  });
  const rejectCard = page.getByTestId("tool-card-f2-tf-reject");
  await expect(rejectCard.getByTestId("transform-comparison")).toBeVisible();
  await expect(rejectCard.getByTestId(`source-preview-${sourceA}`)).toContainText("Proposal Alpha");
  await expect(rejectCard).toContainText("Proposal ID:");
  await expect(rejectCard).toContainText(/base revisions:/i);
  await rejectCard.getByTestId("tool-decision-reject").click();
  await expect(rejectCard).toContainText(/rejected/i);
  let snap = await app.snapshot();
  expect(snap.nodeCount).toBe(2);
  expect(snap.relationCount).toBe(0);

  // Accept path.
  snap = await app.snapshot();
  await app.injectProposal({
    toolCallId: "f2-tf-accept",
    operation: "transform",
    proposed: "accepted derived body",
    transform: {
      operation: "compare",
      sourceNodeIds: [sourceA, sourceB],
      sourceRevisions: {
        [sourceA!]: snap.domainNodes.find((n: any) => n.id === sourceA).revision,
        [sourceB!]: snap.domainNodes.find((n: any) => n.id === sourceB).revision,
      },
      content: "accepted derived body",
      summary: "accept me",
      reason: "shared axis",
      sources: [
        { nodeId: sourceA, content: "Proposal Alpha", revision: 0 },
        { nodeId: sourceB, content: "Proposal Beta", revision: 0 },
      ],
      suggestedRelations: [{ sourceNodeId: sourceA!, targetNodeId: sourceB!, kind: "supports", reason: "link" }],
    },
  });
  const acceptCard = page.getByTestId("tool-card-f2-tf-accept");
  await acceptCard.getByTestId("tool-decision-accept").click();
  await expect(acceptCard).toContainText(/applied/i);
  snap = await app.snapshot();
  expect(snap.nodeCount).toBe(3);
  expect(snap.domainNodes.some((n: any) => n.content === "accepted derived body")).toBeTruthy();

  // Modify path.
  const sources = snap.domainNodes.filter((n: any) => n.id === sourceA || n.id === sourceB);
  await app.injectProposal({
    toolCallId: "f2-tf-modify",
    operation: "transform",
    proposed: "original modify body",
    transform: {
      operation: "summarize",
      sourceNodeIds: [sourceA],
      sourceRevisions: { [sourceA!]: sources.find((n: any) => n.id === sourceA).revision },
      content: "original modify body",
      summary: "summarize",
      reason: "short",
      sources: [{ nodeId: sourceA, content: "Proposal Alpha", revision: sources.find((n: any) => n.id === sourceA).revision }],
      suggestedRelations: [],
    },
  });
  const modifyCard = page.getByTestId("tool-card-f2-tf-modify");
  await modifyCard.getByTestId("tool-decision-modify").click();
  await modifyCard.locator('textarea').fill("human modified derived");
  await modifyCard.locator('input').first().fill("human reason");
  await modifyCard.getByTestId("tool-decision-apply-modified").click();
  await expect(modifyCard).toContainText(/modified proposal was applied/i);
  snap = await app.snapshot();
  expect(snap.domainNodes.some((n: any) => n.content === "human modified derived")).toBeTruthy();

  // Stop control is available while Dialogue is open.
  await expect(page.getByTestId("assistant-stop-action")).toBeVisible();
  await page.getByTestId("assistant-stop-action").click();

  // Stale: New Workspace then apply old proposal correlation.
  const stalePayload = {
    toolCallId: "f2-tf-stale",
    operation: "transform",
    proposed: "should not apply",
    workspaceId: snap.workspaceId,
    canvasId: snap.currentCanvasId,
    runtimeGeneration: snap.runtimeGeneration,
    scopeEpoch: snap.scopeEpoch,
    transform: {
      operation: "summarize",
      sourceNodeIds: [sourceA],
      sourceRevisions: { [sourceA!]: 0 },
      content: "should not apply",
      summary: "stale",
      reason: "late",
      sources: [{ nodeId: sourceA, content: "x", revision: 0 }],
      suggestedRelations: [],
    },
  };
  await app.newWorkspace();
  const stale = await app.applyProposal(stalePayload);
  expect(["error", "conflict"]).toContain(stale.status);
  const afterStale = await app.snapshot();
  expect(afterStale.nodeCount).toBe(0);

  // Atomic fault injection: transform failure leaves full no-op.
  await app.newWorkspace();
  const a = await app.addText("fault-a");
  const b = await app.addText("fault-b");
  const preFault = await app.snapshot();
  await app.armTransformFault();
  await app.selectNodes([a!, b!]);
  // Force transform apply through proposal path under fault plan.
  const faulted = await app.applyProposal({
    toolCallId: "f2-tf-fault",
    operation: "transform",
    proposed: "fault body",
    transform: {
      operation: "compare",
      sourceNodeIds: [a, b],
      sourceRevisions: {
        [a!]: preFault.domainNodes.find((n: any) => n.id === a).revision,
        [b!]: preFault.domainNodes.find((n: any) => n.id === b).revision,
      },
      content: "fault body",
      summary: "fault",
      reason: "inject",
      suggestedRelations: [],
    },
  });
  expect(faulted.status).not.toBe("applied");
  const postFault = await app.snapshot();
  expect(postFault.nodeCount).toBe(preFault.nodeCount);
  expect(postFault.relationCount).toBe(preFault.relationCount);
  expect(postFault.commandSequence).toBe(preFault.commandSequence);
  expect(postFault.domainNodes.find((n: any) => n.id === a).content).toBe("fault-a");
  expect(String(postFault.lastError || faulted.error || "")).toMatch(/fault|apply-transform|error/i);
});

test("F2-03 Relation create edit reverse remove and AI proposal reject via UI", async ({ page }) => {
  const app = await e2e(page);
  await app.newWorkspace();
  const sourceA = await app.addText("Supports claim with a deliberately long node label that must stay inside the relation editor dialog");
  const sourceB = await app.addText("Conclusion with another deliberately long node label for native select sizing regression coverage");
  await app.moveNode(sourceA!, 80, 80);
  await app.moveNode(sourceB!, 600, 80);
  await page.locator(".react-flow__controls-fitview").click();

  const sourceANode = page.locator(`.react-flow__node[data-id="${sourceA}"]`);
  const sourceBNode = page.locator(`.react-flow__node[data-id="${sourceB}"]`);
  await sourceANode.click();
  await expect(sourceANode).toHaveClass(/selected/);
  await sourceBNode.click({ modifiers: ["Control"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);

  // Open the real node context menu after real UI multi-selection.
  await sourceBNode.click({ button: "right" });
  await expect(page.getByRole("menu", { name: /Node options/i })).toBeVisible();
  await page.getByTestId("context-menu-add-relation").click();
  const relationDialog = page.getByTestId("relation-editor-dialog");
  await expect(relationDialog).toBeVisible();
  const dialogBox = await relationDialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  for (const fieldName of [
    "Relation source node",
    "Relation target node",
    "Relation kind",
    "Relation direction",
    "Relation reason",
  ]) {
    const fieldBox = await relationDialog.getByTestId(fieldName === "Relation source node" ? "relation-source" : fieldName === "Relation target node" ? "relation-target" : fieldName === "Relation kind" ? "relation-kind" : fieldName === "Relation direction" ? "relation-direction" : "relation-reason").boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
    expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
  }
  await relationDialog.getByTestId("relation-kind").selectOption("opposes");
  await relationDialog.getByTestId("relation-reason").fill("counter evidence");
  await relationDialog.getByTestId("relation-save").click();

  let snap = await app.snapshot();
  expect(snap.relationCount).toBe(1);
  expect(snap.json).toContain("counter evidence");
  expect(snap.json).toContain("opposes");
  const relationId = snap.edges[0]?.id;
  expect(relationId).toBeTruthy();

  // Edit via edge context menu form.
  await app.openContextMenu({ type: "edge", id: relationId! });
  await page.getByTestId("context-menu-edit-relation").click();
  const editDialog = page.getByTestId("relation-editor-dialog");
  await expect(editDialog).toBeVisible();
  const editDialogBox = await editDialog.boundingBox();
  expect(editDialogBox).not.toBeNull();
  for (const fieldName of ["Relation source node", "Relation target node"]) {
    const fieldBox = await editDialog.getByTestId(fieldName === "Relation source node" ? "relation-source" : "relation-target").boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.x).toBeGreaterThanOrEqual(editDialogBox!.x);
    expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(
      editDialogBox!.x + editDialogBox!.width,
    );
  }
  await editDialog.getByTestId("relation-kind").selectOption("supports");
  await editDialog.getByTestId("relation-reason").fill("supporting evidence");
  await editDialog.getByTestId("relation-save").click();
  snap = await app.snapshot();
  expect(snap.json).toContain("supporting evidence");
  expect(snap.json).toContain("supports");

  // Reverse direction from menu.
  await app.openContextMenu({ type: "edge", id: relationId! });
  await page.getByTestId("context-menu-reverse-relation").click();
  snap = await app.snapshot();
  expect(snap.edges[0].source).toBe(sourceB);
  expect(snap.edges[0].target).toBe(sourceA);
  await expect(page.getByTestId(`rf__edge-${relationId}`)).toBeVisible();

  // AI Relation Proposal reject — must not enter document/persistence/context.
  await app.injectProposal({
    toolCallId: "f2-rel-reject",
    operation: "relation",
    proposed: "supports A→B",
    relation: {
      sourceNodeId: sourceA,
      targetNodeId: sourceB,
      kind: "similar",
      reason: "unaccepted candidate",
    },
  });
  const relCard = page.getByTestId("tool-card-f2-rel-reject");
  await expect(relCard.getByTestId("relation-proposal")).toBeVisible();
  await relCard.getByTestId("tool-decision-reject").click();
  await expect(relCard).toContainText(/rejected/i);
  snap = await app.snapshot();
  expect(snap.relationCount).toBe(1);
  expect(snap.context.relationHints.some((hint: any) => hint.reason === "unaccepted candidate")).toBeFalsy();

  // Remove relation.
  await app.openContextMenu({ type: "edge", id: relationId! });
  await page.getByTestId("context-menu-delete").click();
  snap = await app.snapshot();
  expect(snap.relationCount).toBe(0);
});

test("F2-04 accepted-only Context, delayed Direct no-op, Save/Load", async ({ page }) => {
  const app = await e2e(page);
  await app.newWorkspace();
  const sourceA = await app.addText("Context source");
  const sourceB = await app.addText("Context target");
  await app.addRelation(sourceA!, sourceB!, "supports", "accepted link");
  let snap = await app.snapshot();
  expect(snap.context.relationHints.some((hint: any) => hint.kind === "supports" && hint.reason === "accepted link")).toBeTruthy();
  expect(snap.context.spatialHints.some((hint: any) => hint.nodeId === sourceB)).toBeTruthy();

  // Unaccepted relation proposal must not enter context.
  await app.injectProposal({
    toolCallId: "f2-ctx-unaccepted",
    operation: "relation",
    proposed: "ghost",
    relation: { sourceNodeId: sourceA, targetNodeId: sourceB, kind: "opposes", reason: "ghost link" },
  });
  // Leave it proposed without accepting.
  snap = await app.snapshot();
  expect(snap.context.relationHints.some((hint: any) => hint.reason === "ghost link")).toBeFalsy();

  // Delayed Direct after source edit → conflict/no-op.
  await app.clearLastError();
  await app.selectNodes([sourceA!, sourceB!]);
  const preEditHold = await app.snapshot();
  await app.armDelayedDirectTransform();
  const pending = app.directTransform("compare");
  await app.editText(sourceA!, "Context source edited");
  await app.releaseDelayedDirectTransform();
  const lateEditResult = await pending;
  expect(lateEditResult).toBeFalsy();
  const afterLate = await app.snapshot();
  expect(afterLate.nodeCount).toBe(preEditHold.nodeCount);
  expect(afterLate.relationCount).toBe(preEditHold.relationCount);
  expect(afterLate.domainNodes.find((n: any) => n.id === sourceA).content).toBe("Context source edited");
  expect(String(afterLate.lastError || "")).toMatch(/conflict|revision/i);

  // Delayed Direct after New Workspace → cancelled/no-op.
  await app.newWorkspace();
  const a2 = await app.addText("A2");
  const b2 = await app.addText("B2");
  await app.selectNodes([a2!, b2!]);
  const preHold = await app.snapshot();
  await app.armDelayedDirectTransform();
  const pendingNew = app.directTransform("compare");
  await app.newWorkspace();
  await app.releaseDelayedDirectTransform();
  const lateNew = await pendingNew;
  expect(lateNew).toBeFalsy();
  const afterNew = await app.snapshot();
  expect(afterNew.nodeCount).toBe(0);
  expect(afterNew.relationCount).toBe(0);
  expect(String(afterNew.lastError || "")).toMatch(/cancelled|stale|workspace/i);

  // Delayed Direct after navigation → stale/no-op.
  await app.newWorkspace();
  const n1 = await app.addText("Nav A");
  const n2 = await app.addText("Nav B");
  await app.selectNodes([n1!, n2!]);
  const group = await app.createSubCanvas([n1!, n2!], "Child");
  await app.navigate(group.childCanvasId);
  // create nodes in child for a pending transform, then navigate away
  const c1 = await app.addText("Child A");
  const c2 = await app.addText("Child B");
  await app.selectNodes([c1!, c2!]);
  const preNav = await app.snapshot();
  await app.armDelayedDirectTransform();
  const pendingNav = app.directTransform("compare");
  await app.navigate(preNav.rootCanvasId);
  await app.releaseDelayedDirectTransform();
  const lateNav = await pendingNav;
  expect(lateNav).toBeFalsy();
  const afterNav = await app.snapshot();
  expect(afterNav.currentCanvasId).toBe(preNav.rootCanvasId);
  expect(String(afterNav.lastError || "")).toMatch(/stale|scope|canvas/i);

  // Save/Load accepted state.
  await app.newWorkspace();
  const s1 = await app.addText("Persist A");
  const s2 = await app.addText("Persist B");
  await app.addRelation(s1!, s2!, "supports", "persist link");
  const saved = await app.snapshot();
  await app.save();
  await app.loadJSON(saved.json);
  const loaded = await app.snapshot();
  expect(loaded.relationCount).toBe(1);
  expect(loaded.json).toContain("persist link");
  void preHold;
});

test("F2-05 Dialogue Proposal vs Direct Action separation and comparison display", async ({ page }) => {
  const app = await e2e(page);
  await app.newWorkspace();
  const sourceA = await app.addText("Separate Alpha");
  const sourceB = await app.addText("Separate Beta");

  // Dialogue Transform Proposal creates comparison UI and does not auto-apply.
  const snap0 = await app.snapshot();
  await app.injectProposal({
    toolCallId: "f2-sep-transform",
    operation: "transform",
    proposed: "dialogue derived",
    transform: {
      operation: "compare",
      sourceNodeIds: [sourceA, sourceB],
      sourceRevisions: {
        [sourceA!]: snap0.domainNodes.find((n: any) => n.id === sourceA).revision,
        [sourceB!]: snap0.domainNodes.find((n: any) => n.id === sourceB).revision,
      },
      content: "dialogue derived",
      summary: "dialogue compare",
      reason: "pre-apply",
      sources: [
        { nodeId: sourceA, content: "Separate Alpha", revision: 0 },
        { nodeId: sourceB, content: "Separate Beta", revision: 0 },
      ],
      suggestedRelations: [],
    },
  });
  const card = page.getByTestId("tool-card-f2-sep-transform");
  await expect(card.getByTestId("transform-comparison")).toBeVisible();
  await expect(card).toContainText("Source → Output comparison");
  let snap = await app.snapshot();
  expect(snap.nodeCount).toBe(2);
  expect(snap.chat.sessions.length).toBeGreaterThan(0);

  // Direct Action does not append Dialogue history and shows post-apply diff.
  const sessionsBefore = snap.chat.sessions.length;
  await app.selectNodes([sourceA!, sourceB!]);
  expect(await app.directTransform("compare")).toBeTruthy();
  snap = await app.snapshot();
  expect(snap.chat.sessions.length).toBe(sessionsBefore);
  await expect(page.getByTestId("direct-action-receipt")).toBeVisible();
  await expect(page.getByTestId("direct-action-diff")).toBeVisible();
  await expect(page.getByTestId("direct-diff-output")).toBeVisible();
  expect(snap.lastDirectReceipt.diff.sources.length).toBe(2);
  expect(snap.nodeCount).toBe(3);
});
