import { expect, Page, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type E2EBridge = {
  mode: string;
  snapshot: () => Promise<any>;
  addText: (content?: string) => Promise<string | null>;
  addArtifact: (content?: string, filename?: string) => Promise<string | null>;
  importText: (content: string, filename: string) => Promise<string | null>;
  switchRole: (nodeId: string, role: "text" | "artifact") => Promise<void>;
  setFilename: (nodeId: string, filename: string) => Promise<void>;
  selectNodes: (nodeIds: string[]) => Promise<void>;
  editText: (nodeId: string, content: string) => Promise<void>;
  moveNode: (nodeId: string, x: number, y: number) => Promise<void>;
  openContextMenu: (target: { type: "node" | "edge"; id: string; x?: number; y?: number }) => Promise<void>;
  directTransform: (operation: "summarize" | "compare" | "counterpoint") => Promise<boolean>;
  createSubCanvas: (nodeIds: string[], label?: string) => Promise<any>;
  dissolveChildOfRoot: () => Promise<void>;
  navigate: (canvasId: string) => Promise<void>;
  navigateBack: () => Promise<void>;
  useCanvasAsContext: () => Promise<void>;
  exclude: (nodeId: string, excluded?: boolean) => Promise<void>;
  newWorkspace: () => Promise<void>;
  undo: () => Promise<boolean | void>;
  save: () => Promise<string>;
  load: () => Promise<void>;
  exportNode: (nodeId: string) => Promise<string>;
  openChat: () => Promise<void>;
  startDialogue: (text?: string) => Promise<string>;
  setExternalRefs: () => Promise<void>;
  applyProposal: (payload: any) => Promise<any>;
  injectProposal: (payload: any) => Promise<{ sessionId: string; runId: string }>;
  armUndoFault: () => Promise<void>;
  armTransformFault: () => Promise<void>;
  armDelayedDirectTransform: () => Promise<void>;
  releaseDelayedDirectTransform: () => Promise<void>;
  clearLastError: () => Promise<void>;
  loadJSON: (json: string) => Promise<void>;
  addRelation: (sourceId: string, targetId: string, kind?: "context" | "source" | "derived" | "supports" | "opposes" | "similar", reason?: string) => Promise<string>;
};

export async function installNetworkGuard(page: Page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("http://localhost") ||
      url.startsWith("ws://127.0.0.1") ||
      url.startsWith("ws://localhost") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    ) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
}

export async function openApp(page: Page) {
  const baseURL = process.env.FM_E2E_BASE_URL;
  test.skip(!baseURL, "FM_E2E_BASE_URL required");
  await installNetworkGuard(page);
  await page.goto(baseURL!, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const w = window as any;
    return typeof w.go?.main?.App?.Greet === "function";
  }, undefined, { timeout: 60_000 });
  await page.waitForFunction(() => !!(window as any).__E2E__?.snapshot, undefined, {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Add Text" })).toBeVisible({
    timeout: 20_000,
  });
}

export async function e2e(page: Page): Promise<E2EBridge> {
  return page.evaluateHandle(() => (window as any).__E2E__).then(async (h) => {
    return {
      mode: await page.evaluate(() => (window as any).__E2E__.mode),
      snapshot: () => page.evaluate(() => (window as any).__E2E__.snapshot()),
      addText: (content?: string) =>
        page.evaluate((c) => (window as any).__E2E__.addText(c), content),
      addArtifact: (content?: string, filename?: string) =>
        page.evaluate(
          ({ c, f }) => (window as any).__E2E__.addArtifact(c, f),
          { c: content, f: filename },
        ),
      importText: (content: string, filename: string) =>
        page.evaluate(
          ({ c, f }) => (window as any).__E2E__.importText(c, f),
          { c: content, f: filename },
        ),
      switchRole: (nodeId: string, role: "text" | "artifact") =>
        page.evaluate(
          ({ id, r }) => (window as any).__E2E__.switchRole(id, r),
          { id: nodeId, r: role },
        ),
      setFilename: (nodeId: string, filename: string) =>
        page.evaluate(
          ({ id, f }) => (window as any).__E2E__.setFilename(id, f),
          { id: nodeId, f: filename },
        ),
      selectNodes: (nodeIds: string[]) =>
        page.evaluate((ids) => (window as any).__E2E__.selectNodes(ids), nodeIds),
      editText: (nodeId: string, content: string) =>
        page.evaluate(
          ({ id, c }) => (window as any).__E2E__.editText(id, c),
          { id: nodeId, c: content },
        ),
      moveNode: (nodeId: string, x: number, y: number) =>
        page.evaluate(
          ({ id, x: px, y: py }) => (window as any).__E2E__.moveNode(id, px, py),
          { id: nodeId, x, y },
        ),
      openContextMenu: (target) =>
        page.evaluate((t) => (window as any).__E2E__.openContextMenu(t), target),
      directTransform: (operation) =>
        page.evaluate((value) => (window as any).__E2E__.directTransform(value), operation),
      createSubCanvas: (nodeIds: string[], label?: string) =>
        page.evaluate(
          ({ ids, l }) => (window as any).__E2E__.createSubCanvas(ids, l),
          { ids: nodeIds, l: label },
        ),
      dissolveChildOfRoot: () =>
        page.evaluate(() => (window as any).__E2E__.dissolveChildOfRoot()),
      navigate: (canvasId: string) =>
        page.evaluate((id) => (window as any).__E2E__.navigate(id), canvasId),
      navigateBack: () => page.evaluate(() => (window as any).__E2E__.navigateBack()),
      useCanvasAsContext: () =>
        page.evaluate(() => (window as any).__E2E__.useCanvasAsContext()),
      exclude: (nodeId: string, excluded = true) =>
        page.evaluate(
          ({ id, ex }) => (window as any).__E2E__.exclude(id, ex),
          { id: nodeId, ex: excluded },
        ),
      newWorkspace: () => page.evaluate(() => (window as any).__E2E__.newWorkspace()),
      undo: () => page.evaluate(() => (window as any).__E2E__.undo()),
      save: () => page.evaluate(() => (window as any).__E2E__.save()),
      load: () => page.evaluate(() => (window as any).__E2E__.load()),
      exportNode: (nodeId: string) =>
        page.evaluate((id) => (window as any).__E2E__.exportNode(id), nodeId),
      openChat: () => page.evaluate(() => (window as any).__E2E__.openChat()),
      startDialogue: (text?: string) =>
        page.evaluate((t) => (window as any).__E2E__.startDialogue(t), text),
      setExternalRefs: () =>
        page.evaluate(() => (window as any).__E2E__.setExternalRefs()),
      applyProposal: (payload: any) =>
        page.evaluate((p) => (window as any).__E2E__.applyProposal(p), payload),
      injectProposal: (payload: any) =>
        page.evaluate((p) => (window as any).__E2E__.injectProposal(p), payload),
      armUndoFault: () => page.evaluate(() => (window as any).__E2E__.armUndoFault()),
      armTransformFault: () => page.evaluate(() => (window as any).__E2E__.armTransformFault()),
      armDelayedDirectTransform: () =>
        page.evaluate(() => (window as any).__E2E__.armDelayedDirectTransform()),
      releaseDelayedDirectTransform: () =>
        page.evaluate(() => (window as any).__E2E__.releaseDelayedDirectTransform()),
      clearLastError: () => page.evaluate(() => (window as any).__E2E__.clearLastError()),
      loadJSON: (json: string) =>
        page.evaluate((j) => (window as any).__E2E__.loadJSON(j), json),
      addRelation: (sourceId: string, targetId: string, kind?: string, reason?: string) =>
        page.evaluate(
          ({ s, t, k, r }) => (window as any).__E2E__.addRelation(s, t, k, r),
          { s: sourceId, t: targetId, k: kind, r: reason },
        ),
    } satisfies E2EBridge;
  });
}

export function tempRoot() {
  const root = process.env.FM_E2E_TEMP_ROOT;
  if (!root) throw new Error("FM_E2E_TEMP_ROOT missing");
  return root;
}

export function readJSON(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeFixture(name: string, content: string) {
  const p = path.join(tempRoot(), "fixtures", name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return p;
}
