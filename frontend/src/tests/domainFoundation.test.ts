import { resolveContext } from "../domain/contextResolver";
import {
  applyCommand,
  computeSubCanvasGroupPositions,
  createHistory,
  createRelation,
} from "../domain/workspaceCommands";
import {
  createEmptyWorkspace,
  DomainServices,
  isTextBearing,
} from "../domain/workspace";
import {
  loadWorkspaceJSON,
  serializeWorkspaceV1_3,
  workspaceToPrettyJSON,
} from "../domain/workspacePersistence";

function services(): DomainServices {
  const counts: Record<string, number> = {};
  return {
    ids: {
      next(kind: string) {
        counts[kind] = (counts[kind] ?? 0) + 1;
        return `${kind}-${counts[kind]}`;
      },
    },
    clock: {
      now: () => 1_700_000_000_000,
      nowISO: () => "2026-08-11T00:00:00.000Z",
    },
    faultState: { consumed: {} },
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`fail - ${name}`);
    throw e;
  }
}

run("blank workspace has no nodes", () => {
  const s = services();
  const ws = createEmptyWorkspace(s);
  assert(Object.keys(ws.document.nodes).length === 0, "expected empty nodes");
  assert(ws.runtime.currentCanvasId === ws.document.rootCanvasId, "current is root");
});

run("text/artifact role switch keeps identity and filename", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(
    state,
    { type: "createText", role: "text", input: { content: "# Hello\nbody", summary: "Hello" } },
    s,
    history,
  );
  assert(r.ok, r.error || "create");
  state = r.state;
  history = r.history!;
  const id = r.createdNodeId!;
  r = applyCommand(state, { type: "switchTextRole", nodeId: id, role: "artifact" }, s, history);
  assert(r.ok, r.error || "to artifact");
  state = r.state;
  history = r.history!;
  let node = state.document.nodes[id];
  assert(isTextBearing(node) && node.role === "artifact", "artifact role");
  assert(!!node.filename, "filename proposed");
  const filename = node.filename;
  r = applyCommand(state, { type: "switchTextRole", nodeId: id, role: "text" }, s, history);
  assert(r.ok, r.error || "to text");
  state = r.state;
  history = r.history!;
  node = state.document.nodes[id];
  assert(isTextBearing(node) && node.role === "text", "text role");
  assert(node.filename === filename, "filename retained hidden");
  r = applyCommand(state, { type: "switchTextRole", nodeId: id, role: "artifact" }, s, history);
  assert(r.ok && isTextBearing(r.state.document.nodes[id]) && r.state.document.nodes[id].filename === filename, "restore filename");
});

run("subcanvas move cycle guard and dissolve undo", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s, history);
  state = r.state; history = r.history!;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s, history);
  state = r.state; history = r.history!;
  const b = r.createdNodeId!;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "G" }, s, history);
  assert(r.ok, r.error || "group");
  state = r.state; history = r.history!;
  const folderId = r.createdNodeId!;
  const childCanvasId = r.createdCanvasId!;
  r = applyCommand(
    state,
    {
      type: "moveFolderSubtree",
      folderNodeId: folderId,
      destinationCanvasId: childCanvasId,
      position: { x: 0, y: 0 },
    },
    s,
    history,
  );
  assert(!r.ok, "cycle must fail");
  r = applyCommand(state, { type: "dissolveSubCanvas", canvasId: childCanvasId }, s, history);
  assert(r.ok, r.error || "dissolve");
  state = r.state; history = r.history!;
  assert(state.document.nodes[a].parentCanvasId === state.document.rootCanvasId, "a back to root");
  r = applyCommand(state, { type: "undo" }, s, history);
  assert(r.ok, r.error || "undo dissolve");
  state = r.state;
  assert(!!state.document.canvases[childCanvasId], "canvas restored");
});

run("clear canvas is an atomic command with one undo snapshot", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(
    state,
    { type: "createText", role: "text", input: { content: "A" } },
    s,
    history,
  );
  assert(r.ok, r.error || "create A");
  state = r.state;
  history = r.history!;
  const a = r.createdNodeId!;
  r = applyCommand(
    state,
    { type: "createText", role: "text", input: { content: "B" } },
    s,
    history,
  );
  assert(r.ok, r.error || "create B");
  state = r.state;
  history = r.history!;
  const b = r.createdNodeId!;
  r = applyCommand(
    state,
    { type: "addRelation", relation: createRelation(s, a, b) },
    s,
    history,
  );
  assert(r.ok, r.error || "relation");
  state = r.state;
  history = r.history!;
  const scopeBeforeClear = state.runtime.scopeEpoch;
  r = applyCommand(state, { type: "startAsyncRun", kind: "direct", runId: "direct-clear" }, s, history);
  assert(r.ok, r.error || "start direct run");
  state = r.state;
  r = applyCommand(state, { type: "clearCanvas" }, s, history);
  assert(r.ok, r.error || "clear");
  state = r.state;
  history = r.history!;
  assert(Object.keys(state.document.nodes).length === 0, "clear nodes");
  assert(Object.keys(state.document.relations).length === 0, "clear relations");
  assert(state.runtime.scopeEpoch > scopeBeforeClear, "clear advances scope epoch");
  assert(state.runtime.asyncRuns["direct-clear"]?.status === "cancelled", "clear cancels active runs");
  assert(history.past.length === 4, "clear adds one history entry");
  r = applyCommand(state, { type: "undo" }, s, history);
  assert(r.ok, r.error || "undo clear");
  assert(Object.keys(r.state.document.nodes).length === 2, "undo restores nodes");
  assert(Object.keys(r.state.document.relations).length === 1, "undo restores relation");
});

run("clear canvas prunes removed descendants from navigation history", () => {
  const s = services();
  let state = createEmptyWorkspace(s);
  let history = createHistory();
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s, history);
  assert(r.ok, r.error || "create A"); state = r.state; history = r.history!;
  const nodeId = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s, history);
  assert(r.ok, r.error || "create B"); state = r.state; history = r.history!;
  const secondNodeId = r.createdNodeId!;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [nodeId, secondNodeId], label: "Child" }, s, history);
  assert(r.ok, r.error || "create child"); state = r.state; history = r.history!;
  const childCanvasId = r.createdCanvasId!;
  r = applyCommand(state, { type: "navigateCanvas", canvasId: childCanvasId }, s, history);
  assert(r.ok, r.error || "navigate child"); state = r.state;
  r = applyCommand(state, { type: "navigateParent" }, s, history);
  assert(r.ok, r.error || "navigate parent"); state = r.state;
  r = applyCommand(state, { type: "clearCanvas" }, s, history);
  assert(r.ok, r.error || "clear parent");
  assert(!r.state.document.canvases[childCanvasId], "child canvas removed");
  assert(r.state.runtime.navigationBackStack.every((entry) => Boolean(r.state.document.canvases[entry.canvasId])), "back stack contains live canvases only");
});

run("moving node positions advances scope and cancels active runs", () => {
  const s = services();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s);
  assert(r.ok, r.error || "create A"); state = r.state;
  const nodeId = r.createdNodeId!;
  r = applyCommand(state, { type: "startAsyncRun", kind: "direct", runId: "direct-layout" }, s);
  assert(r.ok, r.error || "start direct run"); state = r.state;
  const epoch = state.runtime.scopeEpoch;
  r = applyCommand(state, { type: "moveNodePositions", changes: [{ nodeId, position: { x: 500, y: 300 } }] }, s);
  assert(r.ok, r.error || "move position");
  assert(r.state.runtime.scopeEpoch > epoch, "position move advances scope epoch");
  assert(r.state.runtime.asyncRuns["direct-layout"]?.status === "cancelled", "position move cancels active runs");
});

run("parent navigation follows canvas hierarchy without undoing edits", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s, history);
  state = r.state; history = r.history!;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s, history);
  state = r.state; history = r.history!;
  const b = r.createdNodeId!;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "Child" }, s, history);
  state = r.state; history = r.history!;
  const childCanvasId = r.createdCanvasId!;
  r = applyCommand(state, { type: "navigateCanvas", canvasId: childCanvasId }, s, history);
  state = r.state;
  r = applyCommand(state, {
    type: "editTextContent",
    nodeId: a,
    content: "edited in child",
    baseRevision: state.document.nodes[a].revision,
  }, s, history);
  assert(r.ok, r.error || "edit child node");
  state = r.state; history = r.history!;
  const historyLength = history.past.length;
  r = applyCommand(state, { type: "navigateParent" }, s, history);
  assert(r.ok, r.error || "navigate parent");
  assert(r.state.runtime.currentCanvasId === r.state.document.rootCanvasId, "parent is root");
  assert(isTextBearing(r.state.document.nodes[a]) && r.state.document.nodes[a].content === "edited in child", "edit retained");
  assert(r.history?.past.length === historyLength, "parent navigation does not consume edit history");
});

run("relation reverse preserves renderable handle roles", () => {
  const s = services();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s);
  state = r.state;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s);
  state = r.state;
  const b = r.createdNodeId!;
  const relation = createRelation(s, a, b);
  relation.presentation = { sourceHandle: "right-source", targetHandle: "left-target" };
  r = applyCommand(state, { type: "addRelation", relation }, s);
  state = r.state;
  r = applyCommand(state, { type: "reverseRelation", id: relation.id }, s);
  assert(r.ok, r.error || "reverse relation");
  const reversed = r.state.document.relations[relation.id];
  assert(reversed.sourceNodeId === b && reversed.targetNodeId === a, "endpoints reversed");
  assert(reversed.presentation?.sourceHandle === "right-source", "source handle role retained");
  assert(reversed.presentation?.targetHandle === "left-target", "target handle role retained");
});

run("SubCanvas rename trims and synchronizes folder plus breadcrumb data", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s, history);
  state = r.state; history = r.history!;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s, history);
  state = r.state; history = r.history!;
  const b = r.createdNodeId!;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "Old" }, s, history);
  state = r.state; history = r.history!;
  const child = r.createdCanvasId!;
  const invalid = applyCommand(state, { type: "renameSubCanvas", canvasId: child, label: "   " }, s, history);
  assert(!invalid.ok, "blank rename rejected");
  r = applyCommand(state, { type: "renameSubCanvas", canvasId: child, label: "  New Name  " }, s, history);
  assert(r.ok, r.error || "rename");
  assert(r.state.document.canvases[child].name === "New Name", "canvas name trimmed");
  const folder = r.state.document.nodes[r.state.document.canvases[child].folderNodeId!];
  assert(folder?.kind === "folder" && folder.label === "New Name", "folder label synchronized");
});

run("parent lift preserves relations, placement, and removes stale runtime targets", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A", position: { x: 20, y: 30 } } }, s, history);
  state = r.state; history = r.history!;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B", position: { x: 100, y: 80 } } }, s, history);
  state = r.state; history = r.history!;
  const b = r.createdNodeId!;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "Child" }, s, history);
  state = r.state; history = r.history!;
  const child = r.createdCanvasId!;
  const folder = r.createdNodeId!;
  r = applyCommand(state, { type: "navigateCanvas", canvasId: child }, s, history);
  state = r.state;
  const relation = createRelation(s, a, b, "supports");
  r = applyCommand(state, { type: "addRelation", relation }, s, history);
  state = r.state; history = r.history!;
  r = applyCommand(state, { type: "setSelection", state: { selectedNodeIds: [a, b], activeNodeId: a, revision: 1 } }, s, history);
  state = r.state; history = r.history!;
  r = applyCommand(state, { type: "setFocus", focus: { id: "f", canvasId: child, target: { kind: "nodes", nodeIds: [a] }, source: "selection" } }, s, history);
  state = r.state; history = r.history!;
  const parent = state.document.canvases[child].parentCanvasId!;
  r = applyCommand(state, {
    type: "moveNodes",
    nodeIds: [a, b],
    destinationCanvasId: parent,
    positions: { a: { x: 100, y: 100 }, b: { x: 180, y: 150 } },
  }, s, history);
  assert(r.ok, r.error || "move to parent");
  assert(r.state.document.nodes[a].parentCanvasId === parent, "a parent lifted");
  assert(r.state.document.relations[relation.id], "member relation preserved");
  assert(!r.state.runtime.selection.selectedNodeIds.includes(a), "selection pruned");
  assert(r.state.runtime.focus === null, "focus pruned");
  assert(r.state.document.nodes[folder].kind === "folder", "folder remains as canvas anchor");
});

run("dissolve removes only FolderNode relations and undo restores one snapshot", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  const create = (content: string) => {
    const r = applyCommand(state, { type: "createText", role: "text", input: { content } }, s, history);
    state = r.state; history = r.history!; return r.createdNodeId!;
  };
  const a = create("A"); const b = create("B"); const outside = create("Outside");
  let r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "Dissolve" }, s, history);
  state = r.state; history = r.history!;
  const child = r.createdCanvasId!; const folder = r.createdNodeId!;
  const memberRelation = createRelation(s, a, b, "similar");
  const folderRelation = createRelation(s, folder, outside, "context");
  r = applyCommand(state, { type: "addRelation", relation: folderRelation }, s, history);
  assert(r.ok, r.error || "relations"); state = r.state; history = r.history!;
  r = applyCommand(state, { type: "navigateCanvas", canvasId: child }, s, history);
  assert(r.ok, r.error || "navigate child"); state = r.state;
  r = applyCommand(state, { type: "addRelation", relation: memberRelation }, s, history);
  assert(r.ok, r.error || "member relation"); state = r.state; history = r.history!;
  const beforeHistory = history.past.length;
  r = applyCommand(state, { type: "dissolveSubCanvas", canvasId: child }, s, history);
  assert(r.ok, r.error || "dissolve with folder relation");
  assert(!r.state.document.canvases[child], "child removed");
  assert(!r.state.document.nodes[folder], "folder removed");
  assert(r.state.document.relations[memberRelation.id], "member relation retained");
  assert(!r.state.document.relations[folderRelation.id], "folder relation removed");
  assert(r.history?.past.length === beforeHistory + 1, "single history snapshot");
  const undone = applyCommand(r.state, { type: "undo" }, s, r.history);
  assert(undone.ok, undone.error || "undo dissolve");
  assert(undone.state.document.canvases[child] && undone.state.document.nodes[folder], "undo restores hierarchy");
  assert(undone.state.document.relations[folderRelation.id], "undo restores folder relation");
});

run("dissolve undo restores the complete runtime freshness snapshot", () => {
  const s = services();
  let history = createHistory();
  let state = createEmptyWorkspace(s);
  const add = (content: string) => {
    const result = applyCommand(
      state,
      { type: "createText", role: "text", input: { content } },
      s,
      history,
    );
    assert(result.ok, result.error || "create");
    state = result.state;
    history = result.history!;
    return result.createdNodeId!;
  };
  const a = add("A");
  const b = add("B");
  let result = applyCommand(
    state,
    { type: "createSubCanvas", nodeIds: [a, b], label: "Runtime" },
    s,
    history,
  );
  assert(result.ok, result.error || "group");
  state = result.state;
  history = result.history!;
  const child = result.createdCanvasId!;
  result = applyCommand(state, { type: "navigateCanvas", canvasId: child }, s, history);
  assert(result.ok, result.error || "navigate");
  state = result.state;
  // Seed every runtime area that dissolve touches, including active run
  // freshness state.  The command cancels it; Undo must not restore it active.
  result = applyCommand(
    state,
    { type: "startAsyncRun", kind: "direct", runId: "run-runtime" },
    s,
    history,
  );
  assert(result.ok, result.error || "start run");
  state = result.state;
  result = applyCommand(
    state,
    {
      type: "setFocus",
      focus: {
        id: "focus-runtime",
        canvasId: child,
        target: { kind: "nodes", nodeIds: [a] },
        source: "selection",
      },
    },
    s,
    history,
  );
  assert(result.ok, result.error || "focus");
  state = result.state;
  const beforeRuntime = structuredClone(state.runtime);
  const beforeDocument = structuredClone(state.document);
  result = applyCommand(
    state,
    { type: "dissolveSubCanvas", canvasId: child },
    s,
    history,
  );
  assert(result.ok, result.error || "dissolve");
  assert(result.state.runtime.asyncRuns["run-runtime"].status === "cancelled", "dissolve cancels active run");
  const undone = applyCommand(result.state, { type: "undo" }, s, result.history);
  assert(undone.ok, undone.error || "undo");
  assert(JSON.stringify(undone.state.document) === JSON.stringify(beforeDocument), "document restored exactly");
  assert(undone.state.runtime.currentCanvasId === beforeRuntime.currentCanvasId, "current canvas restored");
  assert(JSON.stringify(undone.state.runtime.selection) === JSON.stringify(beforeRuntime.selection), "selection restored");
  assert(JSON.stringify(undone.state.runtime.contextSelection) === JSON.stringify(beforeRuntime.contextSelection), "context restored");
  assert(JSON.stringify(undone.state.runtime.focus) === JSON.stringify(beforeRuntime.focus), "focus restored");
  assert(undone.state.runtime.runtimeGeneration === state.runtime.runtimeGeneration, "generation remains current");
  assert(undone.state.runtime.scopeEpoch > state.runtime.scopeEpoch, "undo advances freshness scope");
  assert(undone.state.runtime.asyncRuns["run-runtime"].status === "cancelled", "undo keeps run cancelled");
});

run("SubCanvas placement helper is deterministic and bounded", () => {
  const members = [
    { id: "a", position: { x: 20, y: 30 }, width: 100, height: 80 },
    { id: "b", position: { x: 140, y: 90 }, width: 100, height: 80 },
  ];
  const existing = [{ id: "x", position: { x: 30, y: 40 }, width: 2000, height: 2000 }];
  const first = computeSubCanvasGroupPositions(members, existing, { x: 0, y: 0 });
  const second = computeSubCanvasGroupPositions(members, existing, { x: 0, y: 0 });
  assert(JSON.stringify(first) === JSON.stringify(second), "same input gives same positions");
  assert(first.a.x === 32 + 48 * 20 && first.a.y === 32 + 48 * 20, "collision offset capped at 20 attempts");
  assert(first.b.x - first.a.x === 120 && first.b.y - first.a.y === 60, "relative offsets retained");
});

run("SubCanvas placement treats the FolderNode anchor as a collision box", () => {
  const members = [{ id: "member", position: { x: 0, y: 0 }, width: 100, height: 80 }];
  const anchor = { id: "folder", position: { x: 0, y: 0 }, width: 1000, height: 1000 };
  const placed = computeSubCanvasGroupPositions(members, [anchor], { x: 0, y: 0 });
  assert(placed.member.x === 32 + 48 * 20, "anchor collision is included");
});

run("V1.2 migration and V1.3 roundtrip", () => {
  const s = services();
  const legacy = {
    version: "1.2",
    metadata: { canvasId: "c-legacy", lastOpened: "2026-01-01T00:00:00.000Z" },
    nodes: [
      {
        id: "n1",
        type: "customNode",
        position: { x: 1, y: 2 },
        data: { content: "hi", summary: "hi", revision: 3 },
      },
      {
        id: "n2",
        type: "artifactNode",
        position: { x: 3, y: 4 },
        data: { content: "art", summary: "art", filename: "a.md", revision: 1, language: "markdown", charCount: 3, wordCount: 1 },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", sourceHandle: "right-source", targetHandle: "left-target" }],
  };
  const loaded = loadWorkspaceJSON(JSON.stringify(legacy), s);
  assert(loaded.ok, loaded.ok ? "" : loaded.error);
  assert(loaded.load.document.workspaceId === "c-legacy", "workspace id from canvasId");
  assert(isTextBearing(loaded.load.document.nodes.n1) && loaded.load.document.nodes.n1.role === "text", "text role");
  assert(isTextBearing(loaded.load.document.nodes.n2) && loaded.load.document.nodes.n2.role === "artifact", "artifact role");
  assert(loaded.load.document.relations.e1.kind === "context", "edge to relation");

  let state = createEmptyWorkspace(s);
  const replaced = applyCommand(state, {
    type: "replaceWorkspaceAfterValidatedLoad",
    load: loaded.load,
  }, s);
  assert(replaced.ok, replaced.error || "replace");
  state = replaced.state;
  const json = workspaceToPrettyJSON(state, s.clock.nowISO());
  const again = loadWorkspaceJSON(json, s);
  assert(again.ok, again.ok ? "" : again.error);
  assert(again.load.document.nodes.n1 && again.load.document.nodes.n2, "roundtrip nodes");
  const v13 = serializeWorkspaceV1_3(state, s.clock.nowISO());
  assert(v13.version === "1.3", "version 1.3");
});

run("context resolver ignores stale exclusions and does not send other canvas body", () => {
  const s = services();
  let state = createEmptyWorkspace(s);
  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "A" } }, s);
  state = r.state;
  const a = r.createdNodeId!;
  r = applyCommand(state, { type: "createText", role: "text", input: { content: "B" } }, s);
  state = r.state;
  const b = r.createdNodeId!;
  const rel = createRelation(s, a, b);
  r = applyCommand(state, { type: "addRelation", relation: rel }, s);
  state = r.state;
  r = applyCommand(state, { type: "createSubCanvas", nodeIds: [a, b], label: "G" }, s);
  state = r.state;
  const childCanvasId = r.createdCanvasId!;
  // stay on root: folder only
  r = applyCommand(state, {
    type: "setSelection",
    state: { selectedNodeIds: [r.createdNodeId!], activeNodeId: r.createdNodeId!, revision: 1 },
  }, s);
  state = r.state;
  const env = resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "dialogue",
    operation: "read",
  });
  assert(!env.bodyAllowlistNodeIds.includes(a), "child body not via folder");
  assert(env.activeCanvasTargets.some((t) => t.expansion === "metadata-only"), "folder -> metadata");

  r = applyCommand(state, { type: "navigateCanvas", canvasId: childCanvasId }, s);
  state = r.state;
  r = applyCommand(state, {
    type: "setSelection",
    state: { selectedNodeIds: [a], activeNodeId: a, revision: 1 },
  }, s);
  state = r.state;
  r = applyCommand(state, { type: "setContextExcluded", nodeId: a, excluded: true }, s);
  state = r.state;
  // Legacy exclusion state is retained for schema compatibility, but a node
  // selected again must always be restored to the shared context payload.
  const env2 = resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "dialogue",
    operation: "read",
  });
  assert(env2.bodyAllowlistNodeIds.includes(a), "stale exclusion removed re-selected node");
  assert(env2.excludedNodeIds.length === 0, "stale exclusion leaked into envelope");
});

run("unknown version fails without mutating caller responsibility", () => {
  const s = services();
  const res = loadWorkspaceJSON(JSON.stringify({ version: "9.9", nodes: [] }), s);
  assert(!res.ok, "must fail");
});

console.log("domainFoundation tests passed");
