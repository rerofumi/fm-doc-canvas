import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useChatStore } from "../store/useChatStore";
import { loadWorkspaceJSON, workspaceToPrettyJSON } from "../domain/workspacePersistence";
import {
  createFixedClock,
  createSeededIds,
  RuntimeEnvironment,
} from "./runtimeEnvironment";

declare global {
  interface Window {
    __E2E__?: Record<string, unknown>;
  }
}

function makeServices(env: RuntimeEnvironment) {
  return {
    ids: env.ids,
    clock: env.clock,
    faultPlan: env.faultPlan,
    faultState: env.faultState,
  };
}

export function installE2EBridge(env: RuntimeEnvironment) {
  if (env.mode !== "e2e") return;
  const services = () => makeServices(env);

  window.__E2E__ = {
    mode: "e2e",
    async snapshot() {
      const app = useAppStore.getState();
      const chat = useChatStore.getState();
      return {
        workspaceId: app.workspace.document.workspaceId,
        rootCanvasId: app.workspace.document.rootCanvasId,
        currentCanvasId: app.workspace.runtime.currentCanvasId,
        nodeCount: Object.keys(app.workspace.document.nodes).length,
        relationCount: Object.keys(app.workspace.document.relations).length,
        nodes: app.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          selected: !!n.selected,
          data: n.data,
          position: n.position,
        })),
        edges: app.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
        domainNodes: Object.values(app.workspace.document.nodes).map((n) => ({
          id: n.id,
          kind: n.kind,
          role: "role" in n ? n.role : undefined,
          parentCanvasId: n.parentCanvasId,
          filename: "filename" in n ? n.filename : undefined,
          content: "content" in n ? n.content : undefined,
          revision: n.revision,
          label: "label" in n ? n.label : undefined,
          childCanvasId: "childCanvasId" in n ? n.childCanvasId : undefined,
        })),
        canvases: Object.values(app.workspace.document.canvases),
        breadcrumb: app.getBreadcrumb(),
        lastError: app.lastError,
        chat: {
          sessions: chat.sessions,
          activeSessionId: chat.activeSessionId,
          isLoaded: chat.isLoaded,
          isOpen: chat.isOpen,
        },
        context: app.resolveSharedContext("dialogue", "read"),
        directContext: app.resolveSharedContext("direct", "generate-text"),
historyLength: app.history.past.length,
        commandSequence: app.workspace.runtime.commandSequence,
        scopeEpoch: app.workspace.runtime.scopeEpoch,
        runtimeGeneration: app.workspace.runtime.runtimeGeneration,
        asyncRuns: app.workspace.runtime.asyncRuns,
        boundaryAggregates: app.boundaryAggregates,
        lastDirectReceipt: app.lastDirectReceipt,
        json: workspaceToPrettyJSON(app.workspace, services().clock.nowISO()),
      };
    },
    async addText(content = "hello text") {
      useAppStore.getState().dispatch({
        type: "createText",
        role: "text",
        input: { content, summary: content.split("\n")[0] || "text" },
      });
      return useAppStore.getState().nodes.at(-1)?.id ?? null;
    },
    async addArtifact(content = "# artifact body", filename = "note.md") {
      useAppStore.getState().dispatch({
        type: "createText",
        role: "artifact",
        input: { content, filename, summary: "artifact" },
      });
      return useAppStore.getState().nodes.at(-1)?.id ?? null;
    },
    async importText(content: string, filename: string) {
      useAppStore.getState().dispatch({
        type: "importTextFile",
        result: { content, filename },
      });
      return useAppStore.getState().nodes.at(-1)?.id ?? null;
    },
    async switchRole(nodeId: string, role: "text" | "artifact") {
      useAppStore.getState().switchTextRole(nodeId, role);
    },
    async setFilename(nodeId: string, filename: string) {
      useAppStore.getState().updateArtifactFilename(nodeId, filename);
    },
    async selectNodes(nodeIds: string[]) {
      useAppStore.getState().dispatch({
        type: "setSelection",
        state: {
          selectedNodeIds: nodeIds,
          activeNodeId: nodeIds[0],
          revision: useAppStore.getState().workspace.runtime.selection.revision + 1,
        },
      });
    },
    async editText(nodeId: string, content: string) {
      useAppStore.getState().updateNodeContent(nodeId, content);
    },
    async moveNode(nodeId: string, x: number, y: number) {
      useAppStore.getState().dispatch({
        type: "moveNodePositions",
        changes: [{ nodeId, position: { x, y } }],
      });
    },
    async openContextMenu(target: { type: "node" | "edge"; id: string; x?: number; y?: number }) {
      const opener = (window as any).__E2E_OPEN_CONTEXT_MENU__;
      if (typeof opener !== "function") throw new Error("context menu opener not registered");
      opener(target);
    },
    async directTransform(operation: "summarize" | "compare" | "counterpoint") {
      return useAppStore.getState().runDirectTransform(operation);
    },
    async createSubCanvas(nodeIds: string[], label?: string) {
      useAppStore.getState().createSubCanvas(nodeIds, label);
      const folder = Object.values(useAppStore.getState().workspace.document.nodes).find(
        (n) => n.kind === "folder",
      );
      return folder
        ? { folderId: folder.id, childCanvasId: (folder as any).childCanvasId }
        : null;
    },
    async dissolveChildOfRoot() {
      const app = useAppStore.getState();
      const child = Object.values(app.workspace.document.canvases).find(
        (c) => c.parentCanvasId === app.workspace.document.rootCanvasId,
      );
      if (!child) throw new Error("no child canvas");
      if (app.workspace.runtime.currentCanvasId === child.id) {
        app.navigateCanvas(app.workspace.document.rootCanvasId);
      }
      useAppStore.getState().dispatch({ type: "dissolveSubCanvas", canvasId: child.id });
    },
    async navigate(canvasId: string) {
      useAppStore.getState().navigateCanvas(canvasId);
    },
    async navigateBack() {
      useAppStore.getState().navigateBack();
    },
    async useCanvasAsContext() {
      useAppStore.getState().useCanvasAsContext();
    },
    async exclude(nodeId: string, excluded = true) {
      useAppStore.getState().setContextExcluded(nodeId, excluded);
    },
    async newWorkspace() {
      useAppStore.getState().newWorkspace();
      useChatStore.setState({
        sessions: [],
        activeSessionId: null,
        activeRuns: {},
        isLoaded: true,
        loadError: null,
        canvasId: useAppStore.getState().workspace.document.workspaceId,
      });
    },
    async undo() {
      return useAppStore.getState().undo();
    },
    async save() {
      return useAppStore.getState().saveCanvas();
    },
    async load() {
      await useAppStore.getState().loadCanvas();
    },
    async exportNode(nodeId: string) {
      return useAppStore.getState().exportNode(nodeId);
    },
    async openChat() {
      useChatStore.getState().setOpen(true);
      useChatStore.setState({
        isLoaded: true,
        canvasId: useAppStore.getState().workspace.document.workspaceId,
      });
    },
    async startDialogue(text = "hello dialogue") {
      useChatStore.getState().setOpen(true);
      useChatStore.setState({
        isLoaded: true,
        canvasId: useAppStore.getState().workspace.document.workspaceId,
      });
      const session = useChatStore.getState().createSession();
      useChatStore.getState().appendMessage(session.id, {
        id: `m-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: Date.now(),
      });
      return session.id;
    },
    async setExternalRefs() {
      useAppStore.getState().dispatch({
        type: "setExternalContextRefs",
        delegatedSessions: [
          {
            kind: "delegated-session",
            sessionId: "del-1",
            executor: "fixture",
            sourceRevision: "1",
            permissions: {
              readableNodeIds: [],
              workspaceWrite: "none",
              externalNetwork: "none",
            },
            limits: { maxRounds: 1, maxRetries: 0, maxDurationMs: 1000 },
            status: "proposed",
            provenance: { origin: "user" },
          },
        ],
        projectedContexts: [
          {
            kind: "projected-context",
            packetId: "proj-1",
            items: [
              {
                itemId: "i1",
                summary: "projected item",
                sourceRefs: ["url:example"],
                inference: true,
              },
            ],
            provenance: { origin: "user" },
            status: "candidate",
          },
        ],
      });
    },
    async applyProposal(payload: any) {
      return useAppStore.getState().applyToolProposal(payload);
    },
    async injectProposal(payload: any) {
      const app = useAppStore.getState();
      const chat = useChatStore.getState();
      chat.setOpen(true);
      useChatStore.setState({
        isLoaded: true,
        canvasId: app.workspace.document.workspaceId,
      });
      const session = chat.createSession();
      const runId = payload.runId || `e2e-run-${Date.now()}`;
      const assistantMessageId = `e2e-assistant-${Date.now()}`;
      app.dispatch({ type: "startAsyncRun", kind: "dialogue", runId });
      const run = useAppStore.getState().workspace.runtime.asyncRuns[runId];
      chat.appendMessage(session.id, {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        runId,
        status: "complete",
      });
      chat.beginRun(session.id, runId, assistantMessageId);
      chat.upsertToolEvent(session.id, runId, {
        toolCallId: payload.toolCallId,
        name: "apply_canvas_change",
        status: "proposed",
        proposal: {
          ...payload,
          workspaceId: app.workspace.document.workspaceId,
          canvasId: app.workspace.runtime.currentCanvasId,
          runtimeGeneration: app.workspace.runtime.runtimeGeneration,
          scopeEpoch: app.workspace.runtime.scopeEpoch,
          runEpoch: run?.epoch,
        },
      });
      return { sessionId: session.id, runId };
    },
    async armUndoFault() {
      env.faultPlan = { failOnceAt: "undo-before-commit" };
      env.faultState = { consumed: {} };
      const { configureAppRuntime } = await import("../store/useAppStore");
      const GeneratedBackend = await import("../../wailsjs/go/main/App");
      configureAppRuntime({ ...env, backend: GeneratedBackend as any });
    },
    async armTransformFault() {
      env.faultPlan = { failOnceAt: "apply-transform-before-commit" };
      env.faultState = { consumed: {} };
      const { configureAppRuntime } = await import("../store/useAppStore");
      const GeneratedBackend = await import("../../wailsjs/go/main/App");
      configureAppRuntime({ ...env, backend: GeneratedBackend as any });
    },
    async armDelayedDirectTransform() {
      const { configureAppRuntime } = await import("../store/useAppStore");
      const GeneratedBackend = await import("../../wailsjs/go/main/App");
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      (window as any).__E2E__.__releaseDirectHold = () => release();
      const original = (GeneratedBackend as any).DirectTransform.bind(GeneratedBackend);
      configureAppRuntime({
        ...env,
        backend: {
          ...(GeneratedBackend as any),
          DirectTransform: async (req: unknown) => {
            await gate;
            return original(req);
          },
        } as any,
      });
      return true;
    },
    async releaseDelayedDirectTransform() {
      const release = (window as any).__E2E__?.__releaseDirectHold;
      if (typeof release === "function") release();
    },
    async clearLastError() {
      useAppStore.setState({ lastError: null, lastDirectReceipt: null });
    },
    async loadJSON(json: string) {
      const loaded = loadWorkspaceJSON(json, services());
      if (!loaded.ok) throw new Error(loaded.error);
      useAppStore.getState().dispatch({
        type: "replaceWorkspaceAfterValidatedLoad",
        load: loaded.load,
      });
    },
    async addRelation(sourceId: string, targetId: string, kind: "context" | "source" | "derived" | "supports" | "opposes" | "similar" = "context", reason?: string) {
      const app = useAppStore.getState();
      const id = services().ids.next("relation");
      app.dispatch({
        type: "addRelation",
        relation: {
          id,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          kind,
          status: "accepted",
          reason,
        },
      });
      return id;
    },
  };
}

export function useE2EBridge() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { GetRuntimeEnvironment } = await import("../../wailsjs/go/main/App");
        const raw: any = await GetRuntimeEnvironment();
        if (cancelled) return;
        if (raw?.mode === "e2e") {
          const env: RuntimeEnvironment = {
            mode: "e2e",
            ids: createSeededIds(String(raw.seed || "e2e")),
            clock: createFixedClock(
              typeof raw.epochMs === "number"
                ? raw.epochMs
                : Date.parse("2026-08-11T00:00:00.000Z"),
            ),
            backend: {} as any,
            faultPlan: raw.faultPlan,
            faultState: { consumed: {} },
          };
const { configureAppRuntime } = await import("../store/useAppStore");
          // Keep generated Wails backend bindings; only override ids/clock/fault.
          const GeneratedBackend = await import("../../wailsjs/go/main/App");
          const envWithBackend = {
            ...env,
            backend: GeneratedBackend as any,
          };
          configureAppRuntime(envWithBackend);
          installE2EBridge(envWithBackend);
          useChatStore.setState({
            isLoaded: true,
            loadError: null,
            canvasId: useAppStore.getState().workspace.document.workspaceId,
            sessions: [],
            activeSessionId: null,
            activeRuns: {},
          });
        }
      } catch {
        // production / missing binding
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}


