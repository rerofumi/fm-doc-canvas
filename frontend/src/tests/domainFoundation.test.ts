import { resolveContext } from "../domain/contextResolver";
import { applyCommand, createHistory, createRelation } from "../domain/workspaceCommands";
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

run("context resolver excludes and does not send other canvas body", () => {
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

  r = applyCommand(state, { type: "navigateCanvas", canvasId: r.createdCanvasId! }, s);
  state = r.state;
  r = applyCommand(state, {
    type: "setSelection",
    state: { selectedNodeIds: [a], activeNodeId: a, revision: 1 },
  }, s);
  state = r.state;
  r = applyCommand(state, { type: "setContextExcluded", nodeId: a, excluded: true }, s);
  state = r.state;
  const env2 = resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "dialogue",
    operation: "read",
  });
  assert(!env2.bodyAllowlistNodeIds.includes(a), "excluded removed");
});

run("unknown version fails without mutating caller responsibility", () => {
  const s = services();
  const res = loadWorkspaceJSON(JSON.stringify({ version: "9.9", nodes: [] }), s);
  assert(!res.ok, "must fail");
});

console.log("domainFoundation tests passed");
