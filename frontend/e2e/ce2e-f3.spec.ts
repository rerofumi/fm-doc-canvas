import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("F3 Web Context core", () => {
  test("F3-01 search emits packet without mutation", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const a = await app.addText("Selected note about alpha");
    await app.addText("Unselected other note");
    await app.selectNodes([a!]);
    await app.openChat();
    const before = await app.snapshot();
    const ok = await app.searchWeb("alpha topic", { entryRoute: "dialogue-agent" });
    expect(ok).toBeTruthy();
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.relationCount).toBe(before.relationCount);
    expect(after.activePacket?.status).toBe("complete");
    expect(after.activePacket?.sources.length).toBe(3);
    expect(new Set(after.activePacket.sources.map((s: any) => s.url)).size).toBe(3);
    expect(after.lastSearchRequest.query).toBe("alpha topic");
    expect(after.lastSearchRequest.hintNodeIds).toEqual([a]);
    expect(JSON.stringify(after.lastSearchRequest)).not.toContain("Unselected other note");
    await expect(page.getByRole("region", { name: "Projected Context" })).toBeVisible();
    const panel = page.getByRole("region", { name: "Projected Context" });
    await expect(panel).toHaveCSS("overflow-y", "auto");
    await expect(panel.getByRole("button", { name: "Promote selected context" })).toBeVisible();
    const firstSource = panel.getByRole("checkbox", { name: "Select source Alpha Paper" });
    const secondSource = panel.getByRole("checkbox", { name: "Select source Beta Note" });
    await firstSource.check();
    await expect(firstSource).toBeChecked();
    await expect(secondSource).not.toBeChecked();
    expect(after.chat.sessions[0].messages.some((m: any) => m.toolEvents?.some((e: any) => e.name === "web_search"))).toBeTruthy();
  });

  test("F3-02 promote relation and undo", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const desk = await app.addText("Desk material");
    await app.selectNodes([desk!]);
    await app.searchWeb("alpha topic", { entryRoute: "direct-action" });
    const snap = await app.snapshot();
    const claimId = snap.activePacket.claims[0].claimId;
    const sourceId = snap.activePacket.sources[0].sourceId;
    const relation = snap.activePacket.suggestedRelations[0];
    const before = await app.snapshot();
    const ok = await app.promotePacket({
      selectedClaimIds: [claimId],
      selectedSourceIds: [sourceId],
      acceptedRelations: relation ? [relation] : [],
    });
    expect(ok).toBeTruthy();
    const promoted = await app.snapshot();
    expect(promoted.nodeCount).toBe(before.nodeCount + 2);
    const webNodes = promoted.domainNodes.filter((n: any) => n.provenance?.origin === "web");
    expect(webNodes.length).toBe(2);
    expect(webNodes.some((n: any) => n.provenance?.url === "https://example.com/alpha")).toBeTruthy();
    expect(promoted.json).toContain("https://example.com/alpha");
    const deskAfter = promoted.domainNodes.find((n: any) => n.id === desk);
    expect(deskAfter.content).toBe("Desk material");
    await app.undo();
    const undone = await app.snapshot();
    expect(undone.nodeCount).toBe(before.nodeCount);
  });

  test("F3-02b a new packet starts with an empty UI selection", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const desk = await app.addText("Desk material");
    await app.selectNodes([desk!]);
    await app.searchWeb("first topic", { entryRoute: "direct-action" });

    let panel = page.getByRole("region", { name: "Projected Context" });
    await panel.getByRole("checkbox", { name: "Select source Alpha Paper" }).check();
    await expect(panel.getByText("1 / 5 selected")).toBeVisible();
    await panel.getByRole("button", { name: "Promote selected context" }).click();
    await expect(panel).toBeHidden();

    await app.searchWeb("second topic", { entryRoute: "direct-action" });
    panel = page.getByRole("region", { name: "Projected Context" });
    await expect(panel.getByText("0 / 5 selected")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Promote selected context" })).toBeDisabled();
    for (const checkbox of await panel.getByRole("checkbox").all()) {
      await expect(checkbox).not.toBeChecked();
    }
  });

  test("F3-03 candidate exclusion and persistence", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    const desk = await app.addText("Desk material");
    await app.selectNodes([desk!]);
    await app.searchWeb("alpha topic", { entryRoute: "direct-action" });
    const packet = (await app.snapshot()).activePacket;
    await app.promotePacket({
      selectedClaimIds: [packet.claims[0].claimId],
      selectedSourceIds: [],
      acceptedRelations: [],
    });
    const afterPromote = await app.snapshot();
    expect(afterPromote.json).not.toContain(packet.packetId);
    expect(afterPromote.context.bodyAllowlistNodeIds.every((id: string) => afterPromote.domainNodes.some((n: any) => n.id === id))).toBeTruthy();
    await app.save();
    await app.loadJSON(afterPromote.json);
    const loaded = await app.snapshot();
    expect(loaded.json).toContain("https://example.com");
    expect(loaded.json).not.toContain(packet.packetId);
    expect(loaded.domainNodes.some((n: any) => n.provenance?.url && n.provenance?.retrievedAt)).toBeTruthy();
    await app.newWorkspace();
    const fresh = await app.snapshot();
    expect(fresh.activePacket).toBeNull();
  });

  test("F3-04 direct action and stale", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.addText("Hint");
    const beforeChat = await app.snapshot();
    await app.searchWeb("alpha topic", { entryRoute: "direct-action" });
    const afterDirect = await app.snapshot();
    expect(afterDirect.chat.sessions.length).toBe(beforeChat.chat.sessions.length);
    expect(afterDirect.lastSearchReceipt.entryRoute).toBe("direct-action");
    expect(await app.searchWeb("   ", { entryRoute: "dialogue-agent" })).toBeFalsy();
    const afterBlank = await app.snapshot();
    expect(Object.values(afterBlank.asyncRuns || {}).some((run: any) => run.status === "active")).toBeFalsy();
    expect(String(afterBlank.lastError || "")).toContain("web-search-invalid-query");
    await app.newWorkspace();
    const stale = await app.promotePacket({
      selectedClaimIds: afterDirect.activePacket?.claims?.[0]?.claimId ? [afterDirect.activePacket.claims[0].claimId] : ["missing"],
      selectedSourceIds: [],
    });
    expect(stale).toBeFalsy();
    const afterStale = await app.snapshot();
    expect(afterStale.nodeCount).toBe(0);

    await app.newWorkspace();
    await app.addText("Hint");
    await app.openChat();
    await app.armDelayedSearchWeb();
    const pendingStop = app.searchWeb("late packet", { entryRoute: "dialogue-agent" });
    await expect.poll(async () => {
      const snap = await app.snapshot();
      return Object.values(snap.asyncRuns || {}).some((run: any) => run.status === "active");
    }).toBeTruthy();
    await app.stopActiveDialogue();
    await app.releaseDelayedSearchWeb();
    expect(await pendingStop).toBeFalsy();
    const afterStop = await app.snapshot();
    expect(afterStop.activePacket).toBeNull();
    expect(afterStop.nodeCount).toBe(1);
    expect(String(afterStop.lastError || "")).toMatch(/stale/i);

    await app.newWorkspace();
    const n1 = await app.addText("Nav A");
    const n2 = await app.addText("Nav B");
    await app.selectNodes([n1!, n2!]);
    const group = await app.createSubCanvas([n1!, n2!], "Child");
    await app.armDelayedSearchWeb();
    const pendingNav = app.searchWeb("nav stale", { entryRoute: "direct-action" });
    await expect(page.getByRole("status", { name: "Web search in progress" })).toBeVisible();
    await expect.poll(async () => Boolean((await app.snapshot()).lastSearchRequest)).toBeTruthy();
    await app.navigate(group.childCanvasId);
    await app.releaseDelayedSearchWeb();
    expect(await pendingNav).toBeFalsy();
    const afterNav = await app.snapshot();
    expect(afterNav.activePacket).toBeNull();
    expect(String(afterNav.lastError || "")).toMatch(/stale/i);
  });

  test("F3-05 errors and known URL", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.addText("Hint");
    const ok = await app.searchWeb("known only", {
      entryRoute: "direct-action",
      knownUrls: ["https://known.example/page"],
    });
    expect(ok).toBeTruthy();
    const snap = await app.snapshot();
    expect(snap.activePacket.sources.some((s: any) => s.url === "https://known.example/page")).toBeTruthy();
    const opened = await app.openPacketURL("https://known.example/page");
    expect(opened).toBeTruthy();
    expect((await app.snapshot()).lastOpenedURL).toBe("https://known.example/page");
    const invalid = await app.openPacketURL("http://insecure.example");
    expect(invalid).toBeFalsy();

    for (const code of ["web-search-unauthorized", "web-search-timeout", "web-search-empty"]) {
      await app.clearLastError();
      await app.dismissPacket();
      const before = await app.snapshot();
      await app.armSearchFault(code);
      await app.searchWeb(`fault ${code}`, { entryRoute: "direct-action" });
      const after = await app.snapshot();
      expect(after.nodeCount).toBe(before.nodeCount);
      expect(after.relationCount).toBe(before.relationCount);
      expect(String(after.lastError || after.activePacket?.error?.code || "")).toContain(code);
      await expect(page.getByRole("alert", { name: "Workspace error" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open Settings" })).toBeVisible();
      await app.armSearchFault("");
    }
  });
});
