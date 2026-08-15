import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("F4 Multimodal Transform core", () => {
  test("F4-01 dialogue generate_image is proposal, then variant", async ({
    page,
  }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("A rocket design note");
    await app.selectNodes([text!]);
    const before = await app.snapshot();

    // Exercise the real ChatDrawer -> SendChat -> FixtureLLM -> generate_image path.
    await app.openChat();
    await page
      .getByLabel("Dialogue image provider")
      .selectOption("openai");
    const dialogueInput = page.getByPlaceholder(/メッセージを入力/);
    await dialogueInput.fill("fixture:generate_image a rocket");
    await dialogueInput.press("Enter");

    // Tool card shows the image-variant preview with metadata and actions.
    const card = page.getByRole("group", { name: "Proposal proposed" });
    await expect(card.getByTestId("image-variant-proposal")).toBeVisible();
    await expect(
      card.getByRole("img", { name: "Generated proposal: a rocket" }),
    ).toBeVisible();
    await expect(card).toContainText("a rocket");
    await expect(card).toContainText("generated/fixture.png");
    await expect(card).toContainText("provider: openai");
    const imageCall = await app.getImageFixtureObservations();
    expect(imageCall.provider).toBe("openai");

    // Before accept: document unchanged (proposal only, no mutation).
    let snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount);
    expect(snap.relationCount).toBe(before.relationCount);

    // Accept -> Image Node + derived relation + origin=image provenance.
    await card.getByRole("button", { name: "Accept proposal" }).click();
    snap = await app.snapshot();
    expect(snap.nodeCount).toBe(before.nodeCount + 1);
    expect(snap.relationCount).toBe(before.relationCount + 1);
    const imageNode = snap.domainNodes.find(
      (n: any) => n.kind === "image" && n.src === "generated/fixture.png",
    );
    expect(imageNode).toBeTruthy();
    expect(imageNode.provenance?.origin).toBe("image");
    expect(imageNode.provenance?.operation).toBe("generate-image");
    expect(imageNode.provenance?.prompt).toBe("a rocket");
    expect(imageNode.provenance?.sourceNodeIds).toContain(text);

    // Derived relation connected between text source and image node.
    const derivedRel = Object.values(
      snap.json ? JSON.parse(snap.json).relations : {},
    ).find(
      (r: any) =>
        r.sourceNodeId === text &&
        r.targetNodeId === imageNode.id &&
        r.kind === "derived",
    );
    expect(derivedRel).toBeTruthy();

    // Source text unchanged.
    const source = snap.domainNodes.find((n: any) => n.id === text);
    expect(source.content).toBe("A rocket design note");

    // One undo removes the variant node + relation atomically.
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

    // Direct image generation through the actual PromptBar controls.
    await page.getByRole("button", { name: "Image" }).click();
    await page
      .getByTitle("Image generation provider for this request")
      .selectOption("openrouter");
    await page.getByLabel("Prompt").fill("a direct rocket");
    await page.getByRole("button", { name: "Generate Image" }).click();
    await expect(page.getByTestId("direct-action-receipt")).toBeVisible();

    // Image Node placed with origin=image provenance and derived relation.
    let snap = await app.snapshot();
    expect(snap.nodeCount).toBe(beforeChat.nodeCount + 1);
    expect(snap.relationCount).toBe(beforeChat.relationCount + 1);
    const imageNode = snap.domainNodes.find((n: any) => n.kind === "image");
    expect(imageNode).toBeTruthy();
    expect(imageNode.provenance?.origin).toBe("image");
    expect(imageNode.provenance?.operation).toBe("generate-image");
    expect(imageNode.provenance?.prompt).toBe("a direct rocket");
    expect(imageNode.provenance?.sourceNodeIds).toContain(text);

    // Dialogue session count must be unchanged (Direct Action does not append Dialogue history).
    expect(snap.chat.sessions.length).toBe(beforeChat.chat.sessions.length);

    // Direct Action receipt is visible on UI with Undo button.
    await expect(page.getByTestId("direct-action-receipt")).toBeVisible();
    await expect(page.getByTestId("direct-action-receipt")).toContainText(
      "generate-image applied",
    );

    // Click Undo on Direct Action receipt removes the Image Node and relation.
    await page.getByTestId("direct-action-undo").click();
    snap = await app.snapshot();
    expect(snap.nodeCount).toBe(beforeChat.nodeCount);
    expect(snap.relationCount).toBe(beforeChat.relationCount);
  });

  test("F4-03 vision allowlist and intent/result", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const img1 = await app.addImage("generated/img1.png", "image one");
    const img2 = await app.addImage("generated/img2.png", "image two");
    const text = await app.addText("Vision prompt note");

    // Select all 3 nodes, exclude img2 from context.
    await app.selectNodes([img1!, img2!, text!]);
    await app.exclude(img2!, true);

    const snap = await app.snapshot();
    const payload = snap.context.payloadItems;
    // img1 is non-excluded -> image-binary to LLM.
    expect(
      payload.some(
        (p: any) =>
          p.kind === "image-binary" &&
          p.nodeId === img1 &&
          p.destination === "llm",
      ),
    ).toBeTruthy();
    // img2 is excluded -> not sent at all.
    expect(payload.some((p: any) => p.nodeId === img2)).toBeFalsy();
    // text is sent as text.
    expect(
      payload.some((p: any) => p.kind === "text" && p.nodeId === text),
    ).toBeTruthy();

    // Vision Cap test: selecting 4 non-excluded images sends exactly 3 binary and 1 metadata with warning.
    const img3 = await app.addImage("generated/img3.png", "image three");
    const img4 = await app.addImage("generated/img4.png", "image four");
    await app.selectNodes([img1!, img3!, img4!, text!]);
    const capSnap = await app.snapshot();
    const capBinaries = capSnap.context.payloadItems.filter(
      (p: any) => p.kind === "image-binary",
    );
    expect(capBinaries.length).toBe(3);
    const capMetas = capSnap.context.payloadItems.filter(
      (p: any) => p.kind === "image-metadata",
    );
    expect(capMetas.length).toBe(0); // 3 images total selected + 1 text

    // Add a 4th image to exceed the cap
    const img5 = await app.addImage("generated/img5.png", "image five");
    await app.selectNodes([img1!, img3!, img4!, img5!]);
    const overCapSnap = await app.snapshot();
    const overBinaries = overCapSnap.context.payloadItems.filter(
      (p: any) => p.kind === "image-binary",
    );
    const overMetas = overCapSnap.context.payloadItems.filter(
      (p: any) => p.kind === "image-metadata",
    );
    expect(overBinaries.length).toBe(3);
    expect(overMetas.length).toBe(1);
    expect(
      overCapSnap.context.warnings.some((w: any) => w.kind === "vision-cap"),
    ).toBeTruthy();

    // Exercise the real Dialogue path and verify the actual multimodal payload.
    const beforeImageCalls = await app.getImageFixtureObservations();
    await app.openChat();
    const dialogueInput = page.getByPlaceholder(/メッセージを入力/);
    await dialogueInput.fill("Compare the selected images against their intent");
    await dialogueInput.press("Enter");
    await expect(
      page.getByText(
        "fixture vision: the generated result differs from the stated intent",
      ),
    ).toBeVisible();

    const llmObservation = await app.getLLMFixtureObservations();
    expect(llmObservation.userText).toContain("Compare the selected images");
    expect(llmObservation.imageCount).toBe(3);
    expect(llmObservation.imageURLs).toHaveLength(3);
    for (const imageURL of llmObservation.imageURLs) {
      expect(imageURL).toMatch(/^data:image\/png;base64,/);
    }

    // Vision analysis must not silently trigger image generation.
    const afterImageCalls = await app.getImageFixtureObservations();
    expect(afterImageCalls.callCount).toBe(beforeImageCalls.callCount);
  });

  test("F4-04 stale proposal is a no-op", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Stale source");
    await app.selectNodes([text!]);

    // 1. Delayed direct image arrival after New Workspace is a no-op.
    await app.armDelayedDirectImage();
    const pendingDirect = app.directImage("delayed rocket");
    await app.newWorkspace();
    await app.releaseDelayedDirectImage();
    const directResult = await pendingDirect;
    expect(directResult).toBeFalsy();
    let snap = await app.snapshot();
    expect(snap.nodeCount).toBe(0);

    // 2. Delayed direct image arrival after Canvas Navigation is a no-op.
    const rootText = await app.addText("Root navigation source");
    const rootText2 = await app.addText("Second root navigation source");
    const sub = await app.createSubCanvas(
      [rootText!, rootText2!],
      "Child Canvas",
    );
    expect(sub).toBeTruthy();
    await app.navigate(sub.childCanvasId);
    const childText = await app.addText("Child note");
    await app.selectNodes([childText!]);
    await app.armDelayedDirectImage();
    const pendingNav = app.directImage("nav delayed rocket");
    await app.navigate(snap.rootCanvasId);
    await app.releaseDelayedDirectImage();
    const navResult = await pendingNav;
    expect(navResult).toBeFalsy();

    // 3. Late proposal on discarded/reset workspace returns not applied.
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

    // 4. Stop an actual Dialogue image tool run while the provider is delayed.
    await app.newWorkspace();
    const stopSource = await app.addText("Stop source");
    await app.selectNodes([stopSource!]);
    const beforeStop = await app.snapshot();
    await app.armDelayedImageGeneration();
    await app.openChat();
    const dialogueInput = page.getByPlaceholder(/メッセージを入力/);
    await dialogueInput.fill("fixture:generate_image a rocket");
    await dialogueInput.press("Enter");
    await expect(page.getByText("generate_image").first()).toBeVisible();
    await expect(page.getByLabel("Stop dialogue run")).toBeVisible();
    await page.getByLabel("Stop dialogue run").click();
    await app.releaseDelayedImageGeneration();
    await expect(page.getByText("キャンセルしました。")).toBeVisible();

    const afterStop = await app.snapshot();
    expect(afterStop.nodeCount).toBe(beforeStop.nodeCount);
    expect(afterStop.relationCount).toBe(beforeStop.relationCount);
  });

  test("F4-05 errors leave document unchanged", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const text = await app.addText("Error source");
    await app.selectNodes([text!]);
    const before = await app.snapshot();

    // 1. Invalid image-variant (empty prompt) fails without mutation.
    const badPrompt = await app.applyProposal({
      toolCallId: "f4-err-1",
      operation: "image-variant",
      proposed: "generated/fixture.png",
      imageVariant: {
        proposalId: "f4-err-1",
        toolCallId: "f4-err-1",
        src: "generated/fixture.png",
        prompt: "   ",
        sourceNodeIds: [text!],
        sourceRevisions: { [text!]: 0 },
      },
    });
    expect(badPrompt.status).not.toBe("applied");
    let after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.relationCount).toBe(before.relationCount);

    // 2. Invalid source (out-of-scope missing ID) fails without mutation.
    const badSource = await app.applyProposal({
      toolCallId: "f4-err-2",
      operation: "image-variant",
      proposed: "generated/fixture.png",
      imageVariant: {
        proposalId: "f4-err-2",
        toolCallId: "f4-err-2",
        src: "generated/fixture.png",
        prompt: "rocket",
        sourceNodeIds: ["missing-node-id"],
        sourceRevisions: { "missing-node-id": 0 },
      },
    });
    expect(badSource.status).not.toBe("applied");
    after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.relationCount).toBe(before.relationCount);

    // 3. Provider authentication/timeout errors preserve the document.
    for (const errorCode of ["image-unauthorized", "image-timeout"]) {
      await app.armImageFault(errorCode);
      let rejected = false;
      try {
        await app.directImage(`fault check: ${errorCode}`);
      } catch (error) {
        rejected = true;
        expect(String(error)).toContain(errorCode);
      }
      expect(rejected).toBeTruthy();
      after = await app.snapshot();
      expect(after.nodeCount).toBe(before.nodeCount);
      expect(after.relationCount).toBe(before.relationCount);
    }

    // 4. The actual PromptBar Text direct action still works (F1-F3 regression).
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Prompt").fill("PromptBar text regression check");
    await page.getByRole("button", { name: "Generate Text" }).click();
    await expect
      .poll(async () => (await app.snapshot()).nodeCount)
      .toBe(before.nodeCount + 1);
    after = await app.snapshot();
    expect(
      after.domainNodes.some(
        (node: any) =>
          node.kind === "text" && node.content === "fixture-llm-response",
      ),
    ).toBeTruthy();
  });
});
