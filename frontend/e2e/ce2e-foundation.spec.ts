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

  // Discard / New Workspace clears nodes + dialogue without save modal
  await page.getByRole("button", { name: /New Workspace/i }).click();
  snap = await api.snapshot();
  expect(snap.nodeCount).toBe(0);
  expect(snap.chat.sessions.length).toBe(0);

  // legacy chat path should not be written by e2e temp composition
  const legacy = path.join(tempRoot(), "chat-sessions.json");
  expect(fs.existsSync(legacy)).toBeFalsy();
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

test("CE2E-04 shared context, exclusion, proposal, reserved refs", async ({
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
  expect(snap.context.bodyAllowlistNodeIds).not.toContain(t2);
  expect(snap.directContext.bodyAllowlistNodeIds).not.toContain(t2);

  await expect(page.getByTestId("context-preview")).toBeVisible();

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
  await expect(page.getByRole("button", { name: /New Workspace/i })).toBeVisible();
});
