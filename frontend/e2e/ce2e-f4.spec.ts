import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("F4 Multimodal Transform core", () => {
  test("F4-01 dialogue generate_image is proposal, then variant", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("A rocket design note");
    await app.selectNodes([text!]);
    const before = await app.snapshot();

    // Inject an image-variant proposal (as the agent would after generate_image).
    await app.injectProposal({
      toolCallId: "f4-img-1",
      operation: "image-variant",
      proposed: "generated/fixture.png",
      imageVariant: {
        proposalId: "f4-img-1",
        toolCallId: "f4-img-1",
        src: "generated/fixture.png",
        prompt: "a rocket",
        provider: "fixture",
        sourceNodeIds: [text!],
        sourceRevisions: {
          [text!]: before.domainNodes.find((n: any) => n.id === text).revision,
        },
      },
    });

    // Tool card shows the image-variant preview.
    const card = page.getByTestId("tool-card-f4-img-1");
    await expect(card.getByTestId("image-variant-proposal")).toBeVisible();
    await expect(card).toContainText("a rocket");
    await expect(card).toContainText("generated/fixture.png");

    // Before accept: document unchanged (proposal only).
    let snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount);
    expect(snap.relationCount).toBe(before.relationCount);

    // Accept -> Image Node + derived relation + origin=image provenance.
    await card.getByRole("button", { name: "Accept proposal" }).click();
    snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount + 1);
    expect(snap.relationCount).toBe(before.relationCount + 1);
    const imageNode = snap.domainNodes.find((n: any) => n.kind === "image" && n.src === "generated/fixture.png");
    expect(imageNode).toBeTruthy();
    expect(imageNode.provenance?.origin).toBe("image");
    expect(imageNode.provenance?.prompt).toBe("a rocket");
    expect(imageNode.provenance?.sourceNodeIds).toContain(text);
    // Source text unchanged.
    const source = snap.domainNodes.find((n: any) => n.id === text);
    expect(source.content).toBe("A rocket design note");

    // One undo removes the variant node + relation.
    await app.undo();
    snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount);
    expect(snap.relationCount).toBe(before.relationCount);
  });

  test("F4-02 promptbar direct action stays direct", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Direct source");
    await app.selectNodes([text!]);
    const beforeChat = await app.snapshot();

    // Direct image generation via the browser Go bridge (no dialogue session).
    const src = await page.evaluate(async () => {
      const w = window as any;
      return w.go.main.App.GenerateImage("a direct rocket", "context", []);
    });
    expect(src).toBe("generated/fixture.png");

    // Dialogue session count must be unchanged (Direct Action does not append).
    const after = await app.snapshot();
    expect(after.chat.sessions.length).toBe(beforeChat.chat.sessions.length);
  });

  test("F4-03 vision allowlist and intent/result", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Vision source");
    await app.selectNodes([text!]);
    const snap = await app.snapshot();
    // Dialogue context: selected text is sent; no image selected so no binary.
    expect(snap.context.payloadItems.some((p: any) => p.kind === "text")).toBeTruthy();
    expect(snap.context.payloadItems.some((p: any) => p.kind === "image-binary")).toBeFalsy();
  });

  test("F4-04 stale proposal is a no-op", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Stale source");
    await app.selectNodes([text!]);
    const before = await app.snapshot();

    // New workspace invalidates the runtime generation -> stale.
    await app.newWorkspace();
    const stale = await app.applyProposal({
      toolCallId: "f4-stale-1",
      operation: "image-variant",
      proposed: "generated/fixture.png",
      imageVariant: {
        proposalId: "f4-stale-1",
        toolCallId: "f4-stale-1",
        src: "generated/fixture.png",
        prompt: "stale",
        sourceNodeIds: [text!],
        sourceRevisions: { [text!]: 0 },
      },
    });
    expect(stale.status).not.toBe("applied");
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(0);
  });

  test("F4-05 errors leave document unchanged", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Error source");
    await app.selectNodes([text!]);
    const before = await app.snapshot();

    // Invalid image-variant (empty prompt) must fail without mutation.
    const bad = await app.applyProposal({
      toolCallId: "f4-err-1",
      operation: "image-variant",
      proposed: "generated/fixture.png",
      imageVariant: {
        proposalId: "f4-err-1",
        toolCallId: "f4-err-1",
        src: "generated/fixture.png",
        prompt: "  ",
        sourceNodeIds: [text!],
        sourceRevisions: { [text!]: 0 },
      },
    });
    expect(bad.status).not.toBe("applied");
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.relationCount).toBe(before.relationCount);
  });
});
