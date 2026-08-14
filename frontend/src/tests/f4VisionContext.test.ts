import { applyCommand, createHistory } from "../domain/workspaceCommands";
import { resolveContext, VISION_CAP } from "../domain/contextResolver";
import {
  createEmptyWorkspace,
  DomainServices,
  WorkspaceState,
} from "../domain/workspace";

const services = (): DomainServices => {
  const counts: Record<string, number> = {};
  return {
    ids: { next: (kind) => `${kind}-${(counts[kind] = (counts[kind] ?? 0) + 1)}` },
    clock: { now: () => 1700000000000, nowISO: () => "2026-08-12T00:00:00.000Z" },
  };
};

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function makeState(): { state: WorkspaceState; textId: string; imageIds: string[] } {
  const s = services();
  let state = createEmptyWorkspace(s);
  let history = createHistory();

  let r = applyCommand(state, { type: "createText", role: "text", input: { content: "Alpha", summary: "A" } }, s, history);
  assert(r.ok, r.error || "create text");
  state = r.state;
  history = r.history!;
  const textId = r.createdNodeId!;

  const imageIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    r = applyCommand(
      state,
      { type: "createImageRef", input: { src: `generated/img${i}.png`, alt: `img${i}`, prompt: `p${i}` } },
      s,
      history,
    );
    assert(r.ok, r.error || `create image ${i}`);
    state = r.state;
    history = r.history!;
    imageIds.push(r.createdNodeId!);
  }
  return { state, textId, imageIds };
}

function select(state: WorkspaceState, ids: string[]): WorkspaceState {
  return applyCommand(
    state,
    { type: "setSelection", state: { selectedNodeIds: ids, activeNodeId: ids[0], revision: 1 } },
    services(),
  ).state;
}

function dialogueRead(state: WorkspaceState) {
  return resolveContext({
    document: state.document,
    runtime: state.runtime,
    mode: "dialogue",
    operation: "read",
  });
}

// REQ-07: explicitly selected images become image-binary (destination llm) up to cap.
export function f4VisionAllowlistSelectedImages() {
  const { state, imageIds } = makeState();
  const sel = select(state, [imageIds[0], imageIds[1]]);
  const env = dialogueRead(sel);
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  const metas = env.payloadItems.filter((p) => p.kind === "image-metadata");
  if (binaries.length !== 2) throw new Error(`expected 2 image-binary, got ${binaries.length}`);
  if (binaries.some((p) => p.destination !== "llm")) throw new Error("dialogue image-binary must target llm");
  if (metas.length !== 0) throw new Error(`expected 0 metadata, got ${metas.length}`);
  console.log("ok - dialogue selected images become image-binary");
}

// REQ-07: 4th+ selected image degrades to metadata with vision-cap warning.
export function f4VisionCapDegrades() {
  const { state, imageIds } = makeState();
  const sel = select(state, imageIds.slice(0, 4));
  const env = dialogueRead(sel);
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  const metas = env.payloadItems.filter((p) => p.kind === "image-metadata");
  if (binaries.length !== VISION_CAP) throw new Error(`expected ${VISION_CAP} image-binary, got ${binaries.length}`);
  if (metas.length !== 1) throw new Error(`expected 1 metadata, got ${metas.length}`);
  const capWarn = env.warnings.find((w) => w.kind === "vision-cap");
  if (!capWarn) throw new Error("expected vision-cap warning");
  console.log("ok - vision cap degrades 4th image to metadata with warning");
}

// REQ-07: excluded images are not sent at all (neither binary nor metadata).
export function f4VisionExcludedNotSent() {
  const { state, imageIds } = makeState();
  let sel = select(state, [imageIds[0], imageIds[1]]);
  sel = applyCommand(
    sel,
    { type: "setContextExcluded", nodeId: imageIds[1], excluded: true },
    services(),
  ).state;
  const env = dialogueRead(sel);
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  const metas = env.payloadItems.filter((p) => p.kind === "image-metadata");
  if (binaries.length !== 1) throw new Error(`expected 1 image-binary, got ${binaries.length}`);
  if (binaries[0].nodeId !== imageIds[0]) throw new Error("excluded image must not be sent");
  if (metas.length !== 0) throw new Error("excluded image must not be metadata either");
  console.log("ok - excluded image is not sent");
}

// REQ-07: context-relation images (not explicitly selected) stay metadata-only.
export function f4VisionRelationImageStaysMetadata() {
  const { state, textId, imageIds } = makeState();
  const sel = select(state, [textId]);
  // Add a context relation from image -> text so the image is pulled in via BFS.
  const withRel = applyCommand(
    sel,
    {
      type: "addRelation",
      relation: {
        id: "rel-1",
        sourceNodeId: imageIds[0],
        targetNodeId: textId,
        kind: "context",
        status: "accepted",
      },
    },
    services(),
  ).state;
  const env = dialogueRead(withRel);
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  const metas = env.payloadItems.filter((p) => p.kind === "image-metadata");
  if (binaries.length !== 0) throw new Error("relation-pulled image must not be binary");
  if (metas.length !== 1) throw new Error("relation-pulled image should be metadata");
  console.log("ok - relation-pulled image stays metadata-only");
}

// REQ-01: direct generate-text keeps explicit image-binary (unchanged behavior).
export function f4DirectGenerateTextKeepsBinary() {
  const { state, imageIds } = makeState();
  const sel = select(state, [imageIds[0]]);
  const env = resolveContext({
    document: sel.document,
    runtime: sel.runtime,
    mode: "direct",
    operation: "generate-text",
  });
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  if (binaries.length !== 1) throw new Error(`expected 1 image-binary, got ${binaries.length}`);
  console.log("ok - direct generate-text keeps explicit image-binary");
}

// REQ-01: direct generate-image routes selected images to image-provider.
export function f4DirectGenerateImageRoutesToProvider() {
  const { state, imageIds } = makeState();
  const sel = select(state, [imageIds[0]]);
  const env = resolveContext({
    document: sel.document,
    runtime: sel.runtime,
    mode: "direct",
    operation: "generate-image",
  });
  const binaries = env.payloadItems.filter((p) => p.kind === "image-binary");
  if (binaries.length !== 1) throw new Error(`expected 1 image-binary, got ${binaries.length}`);
  if (binaries[0].destination !== "image-provider") throw new Error("direct generate-image must target image-provider");
  console.log("ok - direct generate-image routes to image-provider");
}

export function runF4VisionTests() {
  f4VisionAllowlistSelectedImages();
  f4VisionCapDegrades();
  f4VisionExcludedNotSent();
  f4VisionRelationImageStaysMetadata();
  f4DirectGenerateTextKeepsBinary();
  f4DirectGenerateImageRoutesToProvider();
  console.log("F4 vision context tests passed");
}
