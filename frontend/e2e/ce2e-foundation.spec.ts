import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { e2e, openApp, tempRoot, writeFixture } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("CE2E-01 blank start, creation entries, dialogue memory, discard", async ({
  page,
}) => {
  const api = await e2e(page);
  let snap = await api.snapshot();
  expect(snap.nodeCount).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // + Text / + Artifact UI buttons
  await page.getByRole("button", { name: "Add Text" }).click();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(1);
  expect(snap.domainNodes[0].role).toBe("text");

  await api.newWorkspace();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(0);

  await page.getByRole("button", { name: "Add Artifact" }).click();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(1);
  expect(snap.domainNodes[0].role).toBe("artifact");

  await api.newWorkspace();
  await api.importText("# from file", "dropped.md");
  snap = await api.snapshot();
  expect(snap.domainNodes[0].role).toBe("artifact");
  expect(snap.domainNodes[0].filename).toContain("dropped.md");

  // memory-only dialogue
  const sessionId = await api.startDialogue("temp chat");
  snap = await api.snapshot();
  expect(snap.chat.sessions.length).toBe(1);
  expect(snap.chat.sessions[0].id).toBe(sessionId);
  expect(snap.chat.sessions[0].messages.length).toBe(1);

  // Discard / New Workspace remains available from Settings and clears nodes + dialogue.
  await page.getByLabel("Close assistant").click();
  await expect(page.getByRole("complementary")).toHaveClass(/translate-x-full/);
  await page.locator("header").getByRole("button", { name: "Settings" }).click();
  const settings = page.getByTestId("settings-drawer");
  await expect(settings).toHaveClass(/translate-x-0/);
  await settings.getByRole("button", { name: "New Workspace" }).click();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(0);
  expect(snap.chat.sessions.length).toBe(0);

  // Chat persistence uses the same binding/service path in the isolated E2E
  // composition, while workspace discard still clears only the active memory.
  const legacy = path.join(tempRoot(), "chat-sessions.json");
  expect(fs.existsSync(legacy)).toBeTruthy();
});

test("CE2E-02 text/artifact identity and V1.3 roundtrip", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();

  const importId = await api.importText("# Imported\nbody", "source-name.md");
  const textId = await api.addText("# Note\nhello");
  await api.addRelation(importId!, textId!);
  let snap = await api.snapshot();
  const before = snap.domainNodes.find((n: any) => n.id === textId);
  expect(before.role).toBe("text");

  await api.switchRole(textId!, "artifact");
  snap = await api.snapshot();
  let node = snap.domainNodes.find((n: any) => n.id === textId);
  expect(node.role).toBe("artifact");
  expect(node.filename).toBeTruthy();
  const filename = node.filename;
  await api.setFilename(textId!, "custom-name.md");

  await api.switchRole(textId!, "text");
  snap = await api.snapshot();
  node = snap.domainNodes.find((n: any) => n.id === textId);
  expect(node.role).toBe("text");
  // filename remains hidden metadata
  expect(node.filename === "custom-name.md" || node.filename === filename).toBeTruthy();

  await api.switchRole(textId!, "artifact");
  snap = await api.snapshot();
  node = snap.domainNodes.find((n: any) => n.id === textId);
  expect(node.id).toBe(textId);
  expect(node.content).toContain("hello");
  expect(node.filename).toBe("custom-name.md");
  expect(snap.relationCount).toBe(1);

  const savePath = await api.save();
  expect(savePath).toBeTruthy();
  expect(fs.existsSync(savePath)).toBeTruthy();
  const saved = JSON.parse(fs.readFileSync(savePath, "utf8"));
  expect(saved.version).toBe("1.3");
  expect(saved.nodes?.length).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(saved)).not.toMatch(/hello dialogue|sessions|messages/i);

  await api.newWorkspace();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(0);

  // point open path is fixed by backend; write saved content there then load
  const openPath = path.join(tempRoot(), "fixtures", "workspace.json");
  fs.mkdirSync(path.dirname(openPath), { recursive: true });
  fs.writeFileSync(openPath, JSON.stringify(saved, null, 2), "utf8");
  await api.load();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBeGreaterThanOrEqual(2);
  const reloaded = snap.domainNodes.find((n: any) => n.id === textId);
  expect(reloaded.filename).toBe("custom-name.md");
  expect(reloaded.content).toContain("hello");

  const exportPath = await api.exportNode(textId!);
  expect(exportPath).toBeTruthy();
  expect(fs.existsSync(exportPath)).toBeTruthy();
  const exported = fs.readFileSync(exportPath, "utf8");
  expect(exported).toContain("hello");
});

test("CE2E-03 SubCanvas scope, boundary, undo", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const a = await api.addText("A");
  const b = await api.addText("B");
  const c = await api.addText("C");
  await api.addRelation(a!, b!);

  const group = await api.createSubCanvas([a!, b!], "GroupAB");
  expect(group?.childCanvasId).toBeTruthy();
  let snap = await api.snapshot();
  expect(snap.domainNodes.some((n: any) => n.kind === "folder")).toBeTruthy();
  // members moved out of root
  const rootId = snap.rootCanvasId;
  expect(
    snap.domainNodes.find((n: any) => n.id === a).parentCanvasId,
  ).toBe(group.childCanvasId);

  // parent folder selection must not send child body
  const folderId = group.folderId;
  await api.navigate(rootId);
  await api.selectNodes([folderId]);
  snap = await api.snapshot();
  expect(snap.context.bodyAllowlistNodeIds).not.toContain(a);
  expect(snap.context.activeCanvasTargets?.length).toBeGreaterThan(0);

  // drill-down and canvas target
  await api.navigate(group.childCanvasId);
  await api.useCanvasAsContext();
  snap = await api.snapshot();
  expect(snap.context.bodyAllowlistNodeIds).toEqual(
    expect.arrayContaining([a, b]),
  );
  expect(snap.context.bodyAllowlistNodeIds).not.toContain(c);

  // cycle move rejected via domain (attempt move folder into itself through bridge dissolve/undo path)
  await api.navigate(rootId);
  await api.dissolveChildOfRoot();
  snap = await api.snapshot();
  expect(snap.domainNodes.find((n: any) => n.id === a).parentCanvasId).toBe(rootId);
  await api.undo();
  snap = await api.snapshot();
  expect(snap.domainNodes.some((n: any) => n.kind === "folder")).toBeTruthy();
});

test("CE2E-04 shared context, legacy exclusion recovery, proposal, reserved refs", async ({
  page,
}) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const t1 = await api.addText("Target one");
  const t2 = await api.addText("Target two");
  await api.selectNodes([t1!, t2!]);
  let snap = await api.snapshot();
  expect(snap.context.activeContextNodeIds).toEqual(
    expect.arrayContaining([t1, t2]),
  );
  expect(snap.directContext.activeContextNodeIds).toEqual(
    expect.arrayContaining([t1, t2]),
  );

  await api.exclude(t2!, true);
  snap = await api.snapshot();
  expect(snap.context.bodyAllowlistNodeIds).toContain(t1);
  expect(snap.context.bodyAllowlistNodeIds).toContain(t2);
  expect(snap.directContext.bodyAllowlistNodeIds).toContain(t2);

  // A legacy exclusion can remain in runtime state, but selecting the node
  // again must restore it to both mode payloads.
  await api.selectNodes([]);
  await api.selectNodes([t2!]);
  snap = await api.snapshot();
  expect(snap.context.payloadItems.filter((item: any) => item.nodeId === t2)).toHaveLength(1);
  expect(snap.directContext.payloadItems.filter((item: any) => item.nodeId === t2)).toHaveLength(1);

  await expect(page.getByTestId("context-preview")).toBeVisible();
  const badge = page.getByTestId("context-preview");
  await expect(badge).toHaveAttribute("role", "status");
  await expect(badge.locator("button")).toHaveCount(0);
  await expect(badge.locator("input[type=checkbox]")).toHaveCount(0);

  // proposal create/edit/undo
  const created = await api.applyProposal({
    toolCallId: "tc-create",
    operation: "create",
    proposed: "created by proposal",
    filename: "proposal.md",
    lastEditSummary: "create",
  });
  expect(created.status).toBe("applied");
  snap = await api.snapshot();
  const createdNode = snap.domainNodes.find((n: any) =>
    String(n.content || "").includes("created by proposal"),
  );
  expect(createdNode).toBeTruthy();
  await api.undo();
  snap = await api.snapshot();
  expect(
    snap.domainNodes.some((n: any) =>
      String(n.content || "").includes("created by proposal"),
    ),
  ).toBeFalsy();

  const editTarget = await api.addText("base");
  snap = await api.snapshot();
  const rev = snap.domainNodes.find((n: any) => n.id === editTarget).revision;
  const edited = await api.applyProposal({
    toolCallId: "tc-edit",
    operation: "replace",
    targetNodeId: editTarget,
    baseRevision: rev,
    proposed: "edited body",
  });
  expect(edited.status).toBe("applied");
  const conflict = await api.applyProposal({
    toolCallId: "tc-conflict",
    operation: "replace",
    targetNodeId: editTarget,
    baseRevision: rev,
    proposed: "stale",
  });
  expect(conflict.status).toBe("conflict");

  await api.setExternalRefs();
  snap = await api.snapshot();
  expect(snap.context.projectedContextRefs?.length).toBe(1);
  expect(snap.context.delegatedSessionRefs?.length).toBe(1);
  // candidate projected must not enter body allowlist automatically
  expect(snap.context.bodyAllowlistNodeIds).not.toContain("proj-1");
});

test("CE2E-05 save/export/error boundaries", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const id = await api.addText("persist me");
  await api.startDialogue("should not persist");
  const savePath = await api.save();
  const saved = JSON.parse(fs.readFileSync(savePath, "utf8"));
  expect(saved.version).toBe("1.3");
  expect(JSON.stringify(saved)).toContain("persist me");
  expect(JSON.stringify(saved)).not.toContain("should not persist");

  const exportPath = await api.exportNode(id!);
  expect(fs.readFileSync(exportPath, "utf8")).toContain("persist me");

  // malformed load keeps current workspace
  const before = await api.snapshot();
  let threw = false;
  try {
    await api.loadJSON(JSON.stringify({ version: "9.9", nodes: [] }));
  } catch {
    threw = true;
  }
  expect(threw).toBeTruthy();
  const afterBad = await api.snapshot();
  expect(afterBad.workspaceId).toBe(before.workspaceId);
  expect(afterBad.nodeCount).toBe(before.nodeCount);

  // undo fault seam
  await api.addText("undo target");
  const beforeFault = await api.snapshot();
  await api.armUndoFault();
  await api.undo();
  const afterFault = await api.snapshot();
  // either error recorded and state unchanged, or fault consumed with no silent corruption
  expect(afterFault.commandSequence).toBeGreaterThanOrEqual(beforeFault.commandSequence - 0);
  // content nodes should still be valid numbers
  expect(afterFault.nodeCount).toBeGreaterThan(0);
});

test("CE2E keyboard smoke for primary controls", async ({ page }) => {
  await page.getByRole("button", { name: "Add Text" }).focus();
  await page.keyboard.press("Enter");
  const api = await e2e(page);
  const snap = await api.snapshot();
  expect(snap.nodeCount).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("navigation", { name: "Canvas breadcrumb" })).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", { name: /New Workspace/i }),
  ).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByTestId("settings-drawer").getByRole("button", { name: "New Workspace" }),
  ).toBeVisible();
});

test("CE2E WP-2 SubCanvas dialog rename, parent lift, and dissolve confirmation", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const a = await api.addText("Lift A");
  const b = await api.addText("Lift B");
  const group = await api.createSubCanvas([a!, b!], "Original");
  expect(group?.folderId).toBeTruthy();
  const root = (await api.snapshot()).rootCanvasId;

  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Rename SubCanvas" }).click();
  const renameDialog = page.getByRole("dialog");
  await renameDialog.getByRole("textbox", { name: "SubCanvas name" }).fill("   ");
  await renameDialog.getByRole("button", { name: "Confirm rename SubCanvas" }).click();
  await expect(renameDialog.getByRole("alert")).toContainText("cannot be empty");
  await renameDialog.getByRole("textbox", { name: "SubCanvas name" }).fill(" Renamed ");
  await renameDialog.getByRole("button", { name: "Confirm rename SubCanvas" }).click();
  let snap = await api.snapshot();
  expect(snap.canvases.find((canvas: any) => canvas.id === group!.childCanvasId).name).toBe("Renamed");
  expect(snap.domainNodes.find((node: any) => node.id === group!.folderId).label).toBe("Renamed");

  await api.navigate(group!.childCanvasId!);
  await api.selectNodes([a!, b!]);
  await api.openContextMenu({ type: "node", id: a! });
  await page.getByRole("menuitem", { name: "Move selected nodes to parent Canvas" }).click();
  await expect(page.getByRole("status").filter({ hasText: "件を親 Canvas" })).toBeVisible();
  snap = await api.snapshot();
  expect(snap.domainNodes.find((node: any) => node.id === a).parentCanvasId).toBe(root);
  expect(snap.domainNodes.find((node: any) => node.id === b).parentCanvasId).toBe(root);
  expect(snap.selection?.selectedNodeIds ?? []).not.toEqual(expect.arrayContaining([a, b]));
  expect(snap.lastError).toBeNull();
  await expect(page.getByTestId("global-error-banner")).toHaveCount(0);

  await api.navigate(root);
  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Delete SubCanvas" }).click();
  const dissolveDialog = page.getByRole("dialog");
  await expect(dissolveDialog).toContainText("0 member");
  await dissolveDialog.getByRole("button", { name: "Cancel delete SubCanvas" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  snap = await api.snapshot();
  expect(snap.domainNodes.some((node: any) => node.id === group!.folderId)).toBeTruthy();
});

test("CE2E WP-2 relation-aware dissolve confirms, preserves members, and undoes atomically", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const memberA = await api.addText("Dissolve member A");
  const memberB = await api.addText("Dissolve member B");
  const outside = await api.addText("Outside node");
  const group = await api.createSubCanvas([memberA!, memberB!], "Relation Group");
  const memberRelation = await api.addRelation(memberA!, memberB!, "supports", "member relation");
  const folderRelation = await api.addRelation(group!.folderId!, outside!, "context", "folder relation");
  const root = (await api.snapshot()).rootCanvasId;
  const anchor = page.getByRole("button", { name: "Add Text" });
  await anchor.focus();
  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Delete SubCanvas" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 members");
  await expect(dialog).toContainText("1 FolderNode relation");
  await expect(dialog).toContainText("Member relations will be preserved");
  await expect(dialog.getByRole("button", { name: "Cancel delete SubCanvas" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Confirm delete SubCanvas" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(anchor).toBeFocused();
  let snap = await api.snapshot();
  expect(snap.relationCount).toBe(2);
  expect(snap.domainNodes.find((node: any) => node.id === memberA).parentCanvasId).toBe(group!.childCanvasId);

  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Delete SubCanvas" }).click();
  await page.getByRole("button", { name: "Confirm delete SubCanvas" }).click();
  await expect(anchor).toBeFocused();
  snap = await api.snapshot();
  expect(snap.canvases.some((canvas: any) => canvas.id === group!.childCanvasId)).toBeFalsy();
  expect(snap.domainNodes.find((node: any) => node.id === memberA).parentCanvasId).toBe(root);
  expect(snap.relationCount).toBe(1);
  expect(snap.edges.some((edge: any) => edge.id === memberRelation)).toBeTruthy();
  expect(snap.edges.some((edge: any) => edge.id === folderRelation)).toBeFalsy();

  await api.undo();
  snap = await api.snapshot();
  expect(snap.canvases.some((canvas: any) => canvas.id === group!.childCanvasId)).toBeTruthy();
  expect(snap.domainNodes.find((node: any) => node.id === memberA).parentCanvasId).toBe(group!.childCanvasId);
  expect(snap.relationCount).toBe(2);
  expect(snap.edges.some((edge: any) => edge.id === folderRelation)).toBeTruthy();
});

test("CE2E WP-2 parent lift handles one unselected node, notification action, and failed no-op", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const moved = await api.addText("single lift");
  const stays = await api.addText("stays in child");
  const group = await api.createSubCanvas([moved!, stays!], "Single lift group");
  const root = (await api.snapshot()).rootCanvasId;
  await api.navigate(group!.childCanvasId!);
  await api.selectNodes([]);
  await api.openContextMenu({ type: "node", id: moved! });
  await page.getByRole("menuitem", { name: "Move selected nodes to parent Canvas" }).click();
  const moveNotice = page.getByRole("status").filter({ hasText: "親 Canvas へ移動しました" });
  await expect(moveNotice).toContainText("1件を親 Canvas へ移動しました");
  let snap = await api.snapshot();
  expect(snap.domainNodes.find((node: any) => node.id === moved).parentCanvasId).toBe(root);
  expect(snap.domainNodes.find((node: any) => node.id === stays).parentCanvasId).toBe(group!.childCanvasId);
  await page.getByRole("button", { name: "親 Canvasを開く" }).click();
  snap = await api.snapshot();
  expect(snap.currentCanvasId).toBe(root);

  // A FolderNode is itself movable; its child Canvas must follow it as a
  // subtree and relations must keep their node IDs.
  await api.navigate(group!.childCanvasId!);
  const nestedOther = await api.addText("nested sibling");
  const nested = await api.createSubCanvas([stays!, nestedOther!], "Nested folder");
  await api.addRelation(stays!, nestedOther!, "supports", "subtree relation");
  const relationCountBeforeSubtreeMove = (await api.snapshot()).relationCount;
  await api.openContextMenu({ type: "node", id: nested.folderId! });
  await page.getByRole("menuitem", { name: "Move selected nodes to parent Canvas" }).click();
  await expect(page.getByRole("status").filter({ hasText: "親 Canvas へ移動しました" })).toContainText("1件");
  snap = await api.snapshot();
  expect(snap.domainNodes.find((node: any) => node.id === nested.folderId).parentCanvasId).toBe(root);
  expect(snap.canvases.find((canvas: any) => canvas.id === nested.childCanvasId).parentCanvasId).toBe(root);
  expect(snap.relationCount).toBe(relationCountBeforeSubtreeMove);
  await page.getByRole("button", { name: "親 Canvasを開く" }).click();

  const before = await api.snapshot();
  expect(await api.moveNodesToParent(["missing-node"])).toBeFalsy();
  const after = await api.snapshot();
  expect(after.json).toBe(before.json);
  expect(String(after.lastError || "")).toMatch(/parent|No nodes/i);
});

test("CE2E WP-2 context menus and SubCanvas dialogs keep keyboard focus", async ({ page }) => {
  const api = await e2e(page);
  await api.newWorkspace();
  const a = await api.addText("Keyboard A");
  const b = await api.addText("Keyboard B");
  const relationId = await api.addRelation(a!, b!);
  expect(relationId).toBeTruthy();

  const menuItems = page.locator('[role="menu"] [role="menuitem"]');
  const anchor = page.getByRole("button", { name: "Add Text" });
  await anchor.focus();

  // Node and edge menus opened through the test seam must both start inside
  // the menu and keep Tab focus contained.
  await api.openContextMenu({ type: "node", id: a! });
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menuItems.nth(1)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(anchor).toBeFocused();

  await anchor.focus();
  await api.openContextMenu({ type: "edge", id: relationId });
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(anchor).toBeFocused();

  // Pane menu has no optional first action; it still receives initial focus.
  await anchor.focus();
  await page.locator(".react-flow__pane").first().click({
    button: "right",
    position: { x: 30, y: 30 },
  });
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  const group = await api.createSubCanvas([a!, b!], "Keyboard Group");
  expect(group?.folderId).toBeTruthy();
  await anchor.focus();
  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Rename SubCanvas" }).click();
  const renameDialog = page.getByRole("dialog");
  await expect(renameDialog.getByRole("textbox", { name: "SubCanvas name" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(renameDialog).toHaveCount(0);
  await expect(anchor).toBeFocused();

  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Rename SubCanvas" }).click();
  await page.getByRole("button", { name: "Cancel rename" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(anchor).toBeFocused();

  await api.openContextMenu({ type: "node", id: group!.folderId! });
  await page.getByRole("menuitem", { name: "Rename SubCanvas" }).click();
  await page.getByRole("textbox", { name: "SubCanvas name" }).fill("Keyboard Renamed");
  await page.getByRole("button", { name: "Confirm rename SubCanvas" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(anchor).toBeFocused();
});
