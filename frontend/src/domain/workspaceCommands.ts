import { validateDocument, isDescendantCanvas, collectSubtreeFolderNodeIds } from "./invariants";
import {
  CommandResult,
  DomainServices,
  FolderNode,
  HistoryEntry,
  NodeId,
  RelationRecord,
  TextBearingNode,
  WorkspaceCommand,
  WorkspaceDocument,
  WorkspaceNode,
  WorkspaceRuntime,
  WorkspaceState,
  cloneWorkspaceState,
  createEmptyWorkspace,
  emptyContextSelection,
  emptySelection,
  getContentStats,
  isFolder,
  isTextBearing,
  nodesOnCanvas,
  sanitizeFilename,
  suggestFilenameFromText,
} from "./workspace";

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export function createHistory(): HistoryState {
  return { past: [], future: [] };
}

function fail(state: WorkspaceState, error: string): CommandResult {
  return { ok: false, state, error };
}

function bumpCommand(runtime: WorkspaceRuntime): void {
  runtime.commandSequence += 1;
}

function cancelActiveRuns(runtime: WorkspaceRuntime): string[] {
  const ids: string[] = [];
  for (const run of Object.values(runtime.asyncRuns)) {
    if (run.status === "active") {
      run.status = "cancelled";
      ids.push(run.runId);
    }
  }
  return ids;
}

function bumpScope(runtime: WorkspaceRuntime): string[] {
  runtime.scopeEpoch += 1;
  return cancelActiveRuns(runtime);
}

function nextOrder(document: WorkspaceDocument, canvasId: string): number {
  const nodes = nodesOnCanvas(document, canvasId);
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((n) => n.order)) + 1;
}

function randomPosition(): { x: number; y: number } {
  return { x: 120 + Math.random() * 280, y: 120 + Math.random() * 220 };
}

function snapshotRestoreCommand(
  before: WorkspaceState,
  bumpContentRevisions: NodeId[] = [],
): WorkspaceCommand {
  return {
    type: "restoreSnapshot",
    document: cloneWorkspaceState(before).document,
    runtimePatch: {
      currentCanvasId: before.runtime.currentCanvasId,
      selection: before.runtime.selection,
      contextSelection: before.runtime.contextSelection,
      focus: before.runtime.focus,
      navigationBackStack: before.runtime.navigationBackStack,
    },
    bumpContentRevisions,
  };
}

function applyRestore(
  state: WorkspaceState,
  cmd: Extract<WorkspaceCommand, { type: "restoreSnapshot" }>,
  services: DomainServices,
): CommandResult {
  if (
    services.faultPlan?.failOnceAt === "undo-before-commit" &&
    services.faultState &&
    !services.faultState.consumed["undo-before-commit"]
  ) {
    services.faultState.consumed["undo-before-commit"] = true;
    return fail(state, "E2E fault: undo-before-commit");
  }

  const next = cloneWorkspaceState(state);
  next.document = cloneWorkspaceState({ document: cmd.document, runtime: state.runtime }).document;
  if (cmd.runtimePatch) {
    next.runtime = { ...next.runtime, ...cmd.runtimePatch };
  }
  for (const id of cmd.bumpContentRevisions ?? []) {
    const node = next.document.nodes[id];
    if (node && isTextBearing(node)) {
      node.revision += 1;
    }
  }
  const err = validateDocument(next.document);
  if (err) return fail(state, err);
  bumpCommand(next.runtime);
  return { ok: true, state: next };
}

function makeTextNode(
  services: DomainServices,
  parentCanvasId: string,
  role: "text" | "artifact",
  input: {
    content?: string;
    summary?: string;
    filename?: string;
    language?: "markdown" | "text";
    position?: { x: number; y: number };
    originalPrompt?: string;
    width?: number;
    height?: number;
    order: number;
    provenance?: TextBearingNode["provenance"];
  },
): TextBearingNode {
  const content = input.content ?? "";
  const stats = getContentStats(content);
  const summary =
    input.summary ||
    content.split(/\r?\n/, 1)[0] ||
    (role === "artifact" ? "New Artifact" : "New Text");
  const node: TextBearingNode = {
    id: services.ids.next("node"),
    kind: "text",
    role,
    parentCanvasId,
    position: input.position ?? randomPosition(),
    order: input.order,
    width: input.width ?? (role === "artifact" ? 300 : 250),
    height: input.height ?? (role === "artifact" ? 220 : 150),
    revision: 0,
    content,
    summary,
    originalPrompt: input.originalPrompt,
    language: input.language ?? "markdown",
    charCount: stats.charCount,
    wordCount: stats.wordCount,
    provenance: input.provenance,
  };
  if (role === "artifact") {
    node.filename = sanitizeFilename(input.filename || "untitled.md");
    node.lastEditedAt = services.clock.now();
  }
  return node;
}

function transformPosition(state: WorkspaceState, sourceNodeIds: string[]): { x: number; y: number } {
  const sources = sourceNodeIds
    .map((id) => state.document.nodes[id])
    .filter((node): node is WorkspaceNode => Boolean(node));
  if (sources.length === 0) return randomPosition();
  return {
    x: Math.max(...sources.map((node) => node.position.x)) + 40,
    y: Math.max(...sources.map((node) => node.position.y)) + 40,
  };
}

export function applyCommand(
  state: WorkspaceState,
  command: WorkspaceCommand,
  services: DomainServices,
  history?: HistoryState,
): CommandResult & { history?: HistoryState } {
  if (command.type === "undo") {
    if (!history || history.past.length === 0) return { ...fail(state, "nothing to undo"), history };
    const entry = history.past[history.past.length - 1];
    const result = applyCommand(state, entry.undo, services);
    if (!result.ok) return { ...result, history };
    return {
      ...result,
      history: {
        past: history.past.slice(0, -1),
        future: [entry, ...history.future],
      },
    };
  }
  if (command.type === "redo") {
    if (!history || history.future.length === 0) return { ...fail(state, "nothing to redo"), history };
    const entry = history.future[0];
    const result = applyCommand(state, entry.redo, services);
    if (!result.ok) return { ...result, history };
    return {
      ...result,
      history: {
        past: [...history.past, entry],
        future: history.future.slice(1),
      },
    };
  }
  if (command.type === "restoreSnapshot") {
    return applyRestore(state, command, services);
  }

  const before = cloneWorkspaceState(state);
  const next = cloneWorkspaceState(state);
  let historyEntry: HistoryEntry | undefined;
  let createdNodeId: string | undefined;
  let createdCanvasId: string | undefined;
  let cancelledRunIds: string[] = [];
  let isMutation = false;

  switch (command.type) {
    case "newWorkspace":
    case "discardWorkspace": {
      const empty = createEmptyWorkspace(services);
      return {
        ok: true,
        state: empty,
        cancelledRunIds: cancelActiveRuns(state.runtime),
        history: history ? createHistory() : undefined,
      };
    }
    case "replaceWorkspaceAfterValidatedLoad": {
      const err = validateDocument(command.load.document);
      if (err) return fail(state, err);
      const runtimeGeneration = services.ids.next("generation");
      return {
        ok: true,
        state: {
          document: cloneWorkspaceState({
            document: command.load.document,
            runtime: state.runtime,
          }).document,
          runtime: {
            currentCanvasId: command.load.restoredCurrentCanvasId,
            runtimeGeneration,
            commandSequence: 0,
            scopeEpoch: 0,
            selection: emptySelection(),
            contextSelection: emptyContextSelection(),
            focus: null,
            navigationBackStack: [],
            runEpochCounter: 0,
            asyncRuns: {},
          },
        },
        cancelledRunIds: cancelActiveRuns(state.runtime),
        history: history ? createHistory() : undefined,
      };
    }
    case "createText": {
      isMutation = true;
      const node = makeTextNode(services, next.runtime.currentCanvasId, command.role, {
        ...command.input,
        order: nextOrder(next.document, next.runtime.currentCanvasId),
      });
      next.document.nodes[node.id] = node;
      next.runtime.selection = {
        selectedNodeIds: [node.id],
        activeNodeId: node.id,
        revision: next.runtime.selection.revision + 1,
      };
      createdNodeId = node.id;
      historyEntry = {
        label: "createText",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "importTextFile": {
      isMutation = true;
      const node = makeTextNode(services, next.runtime.currentCanvasId, "artifact", {
        content: command.result.content,
        filename: command.result.filename,
        position: command.result.position,
        order: nextOrder(next.document, next.runtime.currentCanvasId),
        provenance: { origin: "file-import", createdAt: services.clock.nowISO() },
      });
      next.document.nodes[node.id] = node;
      createdNodeId = node.id;
      historyEntry = {
        label: "importTextFile",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "createImageRef": {
      isMutation = true;
      const id = services.ids.next("node");
      const node: WorkspaceNode = {
        id,
        kind: "image",
        parentCanvasId: next.runtime.currentCanvasId,
        position: command.input.position ?? randomPosition(),
        order: nextOrder(next.document, next.runtime.currentCanvasId),
        width: command.input.width ?? 300,
        height: command.input.height ?? 200,
        revision: 0,
        src: command.input.src,
        alt: command.input.alt,
        prompt: command.input.prompt,
        provider: command.input.provider,
        model: command.input.model,
        provenance: command.input.provenance,
      };
      next.document.nodes[id] = node;
      createdNodeId = id;
      historyEntry = {
        label: "createImageRef",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "applyTransform": {
      isMutation = true;
      const input = command.input;
      if (!input.content.trim()) return fail(state, "empty-transform-output");
      const sourceIds = [...new Set(input.sourceNodeIds)];
      const minimum = input.operation === "compare" ? 2 : 1;
      if (sourceIds.length < minimum) return fail(state, "invalid-source-arity");
      const sourceNodes: TextBearingNode[] = [];
      for (const id of sourceIds) {
        const node = next.document.nodes[id];
        if (!node || !isTextBearing(node)) return fail(state, "source must be text-bearing");
        if (node.parentCanvasId !== next.runtime.currentCanvasId) return fail(state, "source-out-of-scope");
        if (node.revision !== input.sourceRevisions[id]) return fail(state, "source-revision-conflict");
        sourceNodes.push(node);
      }
      if (
        services.faultPlan?.failOnceAt === "apply-transform-before-commit" &&
        services.faultState &&
        !services.faultState.consumed["apply-transform-before-commit"]
      ) {
        services.faultState.consumed["apply-transform-before-commit"] = true;
        return fail(state, "E2E fault: apply-transform-before-commit");
      }
      const output = makeTextNode(services, next.runtime.currentCanvasId, "text", {
        content: input.content,
        summary: input.summary,
        position: input.position ?? transformPosition(next, sourceIds),
        order: nextOrder(next.document, next.runtime.currentCanvasId),
        provenance: {
          origin: input.provenance?.origin ?? "llm",
          sourceNodeIds: sourceIds,
          sourceRevisions: input.sourceRevisions,
          operation: input.operation,
          provider: input.provenance?.provider,
          model: input.provenance?.model,
          createdAt: input.provenance?.createdAt ?? services.clock.nowISO(),
        },
      });
      next.document.nodes[output.id] = output;
      const relationIds: string[] = [];
      const addAtomicRelation = (sourceNodeId: string, targetNodeId: string, kind: RelationRecord["kind"], reason?: string) => {
        if (sourceNodeId === targetNodeId) throw new Error("self-relation");
        if (!next.document.nodes[sourceNodeId] || !next.document.nodes[targetNodeId]) throw new Error("relation-endpoint-missing");
        const relation = createRelation(services, sourceNodeId, targetNodeId, kind);
        relation.reason = reason;
        relation.provenance = output.provenance;
        next.document.relations[relation.id] = relation;
        relationIds.push(relation.id);
      };
      try {
        for (const source of sourceNodes) addAtomicRelation(source.id, output.id, "derived", input.reason);
        for (const suggestion of input.suggestedRelations ?? []) {
          const target = suggestion.targetNodeId ?? output.id;
          if (suggestion.kind === "derived") continue;
          // Reject suggested Relation targets outside Current Canvas scope (except the new output).
          if (target !== output.id) {
            const targetNode = next.document.nodes[target];
            if (!targetNode || targetNode.parentCanvasId !== next.runtime.currentCanvasId) {
              throw new Error("relation-endpoint-out-of-scope");
            }
          }
          const sourceNode = next.document.nodes[suggestion.sourceNodeId];
          if (!sourceNode || sourceNode.parentCanvasId !== next.runtime.currentCanvasId) {
            throw new Error("relation-endpoint-out-of-scope");
          }
          addAtomicRelation(suggestion.sourceNodeId, target, suggestion.kind, suggestion.reason);
        }
      } catch (error) {
        return fail(state, error instanceof Error ? error.message : "relation apply failed");
      }
      next.runtime.selection = {
        selectedNodeIds: [output.id],
        activeNodeId: output.id,
        revision: next.runtime.selection.revision + 1,
      };
      createdNodeId = output.id;
      historyEntry = {
        label: `applyTransform:${input.operation}`,
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      return {
        ok: true,
        state: next,
        historyEntry,
        createdNodeId,
        createdRelationIds: relationIds,
        cancelledRunIds,
        history: history ? { past: [...history.past, historyEntry], future: [] } : undefined,
      };
    }
    case "editTextContent": {
      isMutation = true;
      const node = next.document.nodes[command.nodeId];
      if (!node || !isTextBearing(node)) return fail(state, "text node not found");
      if (node.revision !== command.baseRevision) {
        return fail(state, "content revision conflict");
      }
      const stats = getContentStats(command.content);
      node.content = command.content;
      node.charCount = stats.charCount;
      node.wordCount = stats.wordCount;
      node.revision += 1;
      node.lastEditedAt = services.clock.now();
      historyEntry = {
        label: "editTextContent",
        undo: snapshotRestoreCommand(before, [command.nodeId]),
        redo: command,
      };
      break;
    }
    case "editTextMetadata": {
      isMutation = true;
      const node = next.document.nodes[command.nodeId];
      if (!node || !isTextBearing(node)) return fail(state, "text node not found");
      if (command.patch.summary !== undefined) node.summary = command.patch.summary;
      if (command.patch.filename !== undefined) {
        node.filename = sanitizeFilename(command.patch.filename);
      }
      if (command.patch.language !== undefined) node.language = command.patch.language;
      if (command.patch.lastEditSummary !== undefined) {
        node.lastEditSummary = command.patch.lastEditSummary;
      }
      if (command.patch.originalPrompt !== undefined) {
        node.originalPrompt = command.patch.originalPrompt;
      }
      historyEntry = {
        label: "editTextMetadata",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "switchTextRole": {
      isMutation = true;
      const node = next.document.nodes[command.nodeId];
      if (!node || !isTextBearing(node)) return fail(state, "text node not found");
      if (node.role === command.role) break;
      if (command.role === "artifact") {
        node.role = "artifact";
        if (!node.filename) {
          node.filename = suggestFilenameFromText(node.content, node.summary);
        }
      } else {
        node.role = "text";
        // keep filename hidden
      }
      historyEntry = {
        label: "switchTextRole",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "createSubCanvas": {
      isMutation = true;
      const ids = [...new Set(command.nodeIds)];
      if (ids.length < 2) return fail(state, "createSubCanvas requires 2+ nodes");
      for (const id of ids) {
        const n = next.document.nodes[id];
        if (!n || n.parentCanvasId !== next.runtime.currentCanvasId) {
          return fail(state, "all nodes must belong to current canvas");
        }
      }
      // cycle guard if folders included
      for (const id of ids) {
        const n = next.document.nodes[id];
        if (isFolder(n)) {
          // grouping folder into new child is ok; moving into self handled at move
        }
      }
      const childCanvasId = services.ids.next("canvas");
      const folderId = services.ids.next("node");
      const first = next.document.nodes[ids[0]];
      const label =
        command.label ||
        (isTextBearing(first) ? first.summary : isFolder(first) ? first.label : "Group") ||
        "Group";
      const folder: FolderNode = {
        id: folderId,
        kind: "folder",
        parentCanvasId: next.runtime.currentCanvasId,
        childCanvasId,
        label,
        position: first.position,
        order: nextOrder(next.document, next.runtime.currentCanvasId),
        width: 220,
        height: 120,
        revision: 0,
      };
      next.document.canvases[childCanvasId] = {
        id: childCanvasId,
        parentCanvasId: next.runtime.currentCanvasId,
        folderNodeId: folderId,
        name: label,
      };
      next.document.nodes[folderId] = folder;
      for (const id of ids) {
        const n = next.document.nodes[id];
        n.parentCanvasId = childCanvasId;
        if (isFolder(n)) {
          const child = next.document.canvases[n.childCanvasId];
          child.parentCanvasId = childCanvasId;
        }
      }
      createdNodeId = folderId;
      createdCanvasId = childCanvasId;
      historyEntry = {
        label: "createSubCanvas",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "dissolveSubCanvas": {
      isMutation = true;
      const canvas = next.document.canvases[command.canvasId];
      if (!canvas || !canvas.folderNodeId || !canvas.parentCanvasId) {
        return fail(state, "cannot dissolve root or missing canvas");
      }
      const folder = next.document.nodes[canvas.folderNodeId];
      if (!folder || !isFolder(folder)) return fail(state, "folder missing");
      // reject if folder is relation endpoint
      for (const rel of Object.values(next.document.relations)) {
        if (rel.sourceNodeId === folder.id || rel.targetNodeId === folder.id) {
          return fail(state, "cannot dissolve folder with relations; remove relations first");
        }
      }
      const parentId = canvas.parentCanvasId;
      const members = nodesOnCanvas(next.document, command.canvasId);
      for (const member of members) {
        member.parentCanvasId = parentId;
        if (isFolder(member)) {
          next.document.canvases[member.childCanvasId].parentCanvasId = parentId;
        }
      }
      delete next.document.nodes[folder.id];
      delete next.document.canvases[command.canvasId];
      if (next.runtime.currentCanvasId === command.canvasId) {
        next.runtime.currentCanvasId = parentId;
        cancelledRunIds = bumpScope(next.runtime);
        next.runtime.selection = emptySelection();
        next.runtime.contextSelection = emptyContextSelection();
      }
      historyEntry = {
        label: "dissolveSubCanvas",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "moveFolderSubtree": {
      isMutation = true;
      const folder = next.document.nodes[command.folderNodeId];
      if (!folder || !isFolder(folder)) return fail(state, "folder not found");
      const dest = command.destinationCanvasId;
      if (!next.document.canvases[dest]) return fail(state, "destination missing");
      if (dest === folder.childCanvasId || isDescendantCanvas(next.document, folder.childCanvasId, dest)) {
        return fail(state, "cannot move folder subtree into itself or descendant");
      }
      folder.parentCanvasId = dest;
      folder.position = command.position;
      next.document.canvases[folder.childCanvasId].parentCanvasId = dest;
      historyEntry = {
        label: "moveFolderSubtree",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "renameSubCanvas": {
      isMutation = true;
      const canvas = next.document.canvases[command.canvasId];
      if (!canvas) return fail(state, "canvas not found");
      canvas.name = command.label;
      if (canvas.folderNodeId) {
        const folder = next.document.nodes[canvas.folderNodeId];
        if (folder && isFolder(folder)) folder.label = command.label;
      }
      historyEntry = {
        label: "renameSubCanvas",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "moveNodes": {
      isMutation = true;
      const dest = command.destinationCanvasId;
      if (!next.document.canvases[dest]) return fail(state, "destination missing");
      for (const id of command.nodeIds) {
        const node = next.document.nodes[id];
        if (!node) return fail(state, `node ${id} missing`);
        if (isFolder(node)) {
          if (dest === node.childCanvasId || isDescendantCanvas(next.document, node.childCanvasId, dest)) {
            return fail(state, "cannot move folder subtree into itself or descendant");
          }
        }
      }
      for (const id of command.nodeIds) {
        const node = next.document.nodes[id];
        node.parentCanvasId = dest;
        if (command.positions?.[id]) node.position = command.positions[id];
        if (isFolder(node)) {
          next.document.canvases[node.childCanvasId].parentCanvasId = dest;
        }
      }
      historyEntry = {
        label: "moveNodes",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "moveNodePositions": {
      isMutation = true;
      for (const change of command.changes) {
        const node = next.document.nodes[change.nodeId];
        if (!node) return fail(state, `node ${change.nodeId} missing`);
        node.position = change.position;
      }
      historyEntry = {
        label: "moveNodePositions",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "resizeNode": {
      isMutation = true;
      const node = next.document.nodes[command.nodeId];
      if (!node) return fail(state, "node missing");
      node.width = command.width;
      node.height = command.height;
      historyEntry = {
        label: "resizeNode",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "deleteNodes": {
      isMutation = true;
      for (const id of command.nodeIds) {
        const node = next.document.nodes[id];
        if (!node) continue;
        if (isFolder(node)) {
          return fail(state, "use dissolveSubCanvas for folder nodes");
        }
      }
      for (const id of command.nodeIds) {
        delete next.document.nodes[id];
      }
      for (const [rid, rel] of Object.entries(next.document.relations)) {
        if (command.nodeIds.includes(rel.sourceNodeId) || command.nodeIds.includes(rel.targetNodeId)) {
          delete next.document.relations[rid];
        }
      }
      next.runtime.selection = {
        selectedNodeIds: next.runtime.selection.selectedNodeIds.filter((id) => !command.nodeIds.includes(id)),
        activeNodeId: command.nodeIds.includes(next.runtime.selection.activeNodeId ?? "")
          ? undefined
          : next.runtime.selection.activeNodeId,
        revision: next.runtime.selection.revision + 1,
      };
      historyEntry = {
        label: "deleteNodes",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "addRelation": {
      isMutation = true;
      const rel = command.relation;
      if (!next.document.nodes[rel.sourceNodeId] || !next.document.nodes[rel.targetNodeId]) {
        return fail(state, "relation endpoints missing");
      }
      if (rel.sourceNodeId === rel.targetNodeId) return fail(state, "self-relation");
      if (rel.kind === "context" && rel.sourceNodeId === rel.targetNodeId) return fail(state, "self-relation");
      if (next.document.relations[rel.id]) return fail(state, "duplicate relation id");
      next.document.relations[rel.id] = { ...rel, status: "accepted" };
      historyEntry = {
        label: "addRelation",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "updateRelation": {
      isMutation = true;
      const relation = next.document.relations[command.id];
      if (!relation) return fail(state, "relation missing");
      const nextRelation = { ...relation, ...command.patch, status: "accepted" as const };
      if (nextRelation.sourceNodeId === nextRelation.targetNodeId) return fail(state, "self-relation");
      next.document.relations[command.id] = nextRelation;
      historyEntry = {
        label: "updateRelation",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "reverseRelation": {
      isMutation = true;
      const relation = next.document.relations[command.id];
      if (!relation) return fail(state, "relation missing");
      next.document.relations[command.id] = {
        ...relation,
        sourceNodeId: relation.targetNodeId,
        targetNodeId: relation.sourceNodeId,
        // Handle IDs describe the source/target role on either node, not the
        // identity of the old endpoint. Swapping them assigns a target handle
        // to the new source (and vice versa), so React Flow cannot render the
        // otherwise valid relation.
        presentation: relation.presentation,
      };
      historyEntry = { label: "reverseRelation", undo: snapshotRestoreCommand(before), redo: command };
      break;
    }
    case "removeRelation": {
      isMutation = true;
      if (!next.document.relations[command.id]) return fail(state, "relation missing");
      delete next.document.relations[command.id];
      historyEntry = {
        label: "removeRelation",
        undo: snapshotRestoreCommand(before),
        redo: command,
      };
      break;
    }
    case "setSelection": {
      const currentId = next.runtime.currentCanvasId;
      const selected = command.state.selectedNodeIds.filter((id) => {
        const n = next.document.nodes[id];
        return n && n.parentCanvasId === currentId;
      });
      const active =
        command.state.activeNodeId && selected.includes(command.state.activeNodeId)
          ? command.state.activeNodeId
          : selected[0];
      next.runtime.selection = {
        selectedNodeIds: selected,
        activeNodeId: active,
        revision: next.runtime.selection.revision + 1,
      };
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setFocus": {
      next.runtime.focus = command.focus;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "addContextTarget": {
      next.runtime.contextSelection.addedContextTargets = [
        ...next.runtime.contextSelection.addedContextTargets,
        command.target,
      ];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "removeContextTarget": {
      next.runtime.contextSelection.addedContextTargets =
        next.runtime.contextSelection.addedContextTargets.filter(
          (t) => JSON.stringify(t) !== JSON.stringify(command.target),
        );
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setContextExcluded": {
      const set = new Set(next.runtime.contextSelection.excludedNodeIds);
      if (command.excluded) set.add(command.nodeId);
      else set.delete(command.nodeId);
      next.runtime.contextSelection.excludedNodeIds = [...set];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setMutationTarget": {
      next.runtime.contextSelection.explicitMutationTarget = command.target;
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setRelationTargets": {
      next.runtime.contextSelection.explicitRelationTargetNodeIds = [...command.nodeIds];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setRemoteRelationIncluded": {
      const set = new Set(next.runtime.contextSelection.includedRemoteRelationIds);
      if (command.included) set.add(command.relationId);
      else set.delete(command.relationId);
      next.runtime.contextSelection.includedRemoteRelationIds = [...set];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setCandidateSeeds": {
      next.runtime.contextSelection.candidateSeedNodeIds = [...command.nodeIds];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "setExternalContextRefs": {
      next.runtime.contextSelection.delegatedSessions = [...command.delegatedSessions];
      next.runtime.contextSelection.projectedContexts = [...command.projectedContexts];
      next.runtime.contextSelection.revision += 1;
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "navigateCanvas": {
      if (!next.document.canvases[command.canvasId]) return fail(state, "canvas missing");
      next.runtime.navigationBackStack = [
        ...next.runtime.navigationBackStack,
        {
          canvasId: next.runtime.currentCanvasId,
          viewport: command.viewport,
        },
      ];
      next.runtime.currentCanvasId = command.canvasId;
      next.runtime.selection = emptySelection();
      next.runtime.contextSelection = emptyContextSelection();
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "navigateParent": {
      const current = next.document.canvases[next.runtime.currentCanvasId];
      if (!current) return fail(state, "current canvas missing");
      if (!current.parentCanvasId) break;
      next.runtime.currentCanvasId = current.parentCanvasId;
      next.runtime.selection = emptySelection();
      next.runtime.contextSelection = emptyContextSelection();
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "navigateBack": {
      const stack = next.runtime.navigationBackStack;
      if (stack.length === 0) return fail(state, "navigation stack empty");
      const entry = stack[stack.length - 1];
      next.runtime.navigationBackStack = stack.slice(0, -1);
      next.runtime.currentCanvasId = entry.canvasId;
      next.runtime.selection = emptySelection();
      next.runtime.contextSelection = emptyContextSelection();
      cancelledRunIds = bumpScope(next.runtime);
      break;
    }
    case "startAsyncRun": {
      next.runtime.runEpochCounter += 1;
      next.runtime.asyncRuns[command.runId] = {
        runId: command.runId,
        epoch: next.runtime.runEpochCounter,
        kind: command.kind,
        status: "active",
      };
      break;
    }
    case "cancelAsyncRun": {
      const run = next.runtime.asyncRuns[command.runId];
      if (run && run.status === "active") {
        run.status = "cancelled";
        cancelledRunIds = [command.runId];
      }
      break;
    }
    case "completeAsyncRun": {
      const run = next.runtime.asyncRuns[command.runId];
      if (run && run.status === "active") run.status = "completed";
      break;
    }
    default:
      return fail(state, `unknown command ${(command as WorkspaceCommand).type}`);
  }

  const err = validateDocument(next.document);
  if (err) return fail(state, err);

  if (isMutation) {
    bumpCommand(next.runtime);
    // cancel runs whose membership may have changed
    const extra = cancelActiveRuns(next.runtime);
    cancelledRunIds = [...new Set([...cancelledRunIds, ...extra])];
  }

  let nextHistory = history;
  if (history && historyEntry) {
    nextHistory = {
      past: [...history.past, historyEntry],
      future: [],
    };
  }

  return {
    ok: true,
    state: next,
    historyEntry,
    cancelledRunIds,
    createdNodeId,
    createdCanvasId,
    history: nextHistory,
  };
}

export function createRelation(
  services: DomainServices,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  kind: RelationRecord["kind"] = "context",
  presentation?: RelationRecord["presentation"],
  reason?: string,
): RelationRecord {
  return {
    id: services.ids.next("relation"),
    sourceNodeId,
    targetNodeId,
    kind,
    status: "accepted",
    reason,
    presentation,
  };
}

// silence unused import when tree helpers used only by tests
void collectSubtreeFolderNodeIds;
