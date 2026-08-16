import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

function fixture(kind: string, targets: string[] = [], extra: Record<string, string> = {}): string {
  return JSON.stringify({
    actions: [{ kind, targetNodeIds: targets, title: `F6 ${kind}`, reason: "fixture reason", expectedResult: "fixture result", ...extra }],
  });
}

async function openProposal(page: import("@playwright/test").Page, app: Awaited<ReturnType<typeof e2e>>, raw: string): Promise<void> {
  await app.setNextActionsFixture(raw);
  await app.openChat();
  await page.getByRole("button", { name: "次の一手を提案" }).click();
  await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
}

test.describe("F6 Collaboration Orchestration core", () => {
  test("F6-01 manual proposal inspect, edit, reject, re-suggest", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Option A");
    const b = await app.addText("Option B");
    await app.selectNodes([a!, b!]);
    await openProposal(page, app, fixture("compare", [a!, b!]));
    await expect(page.getByText("比較者", { exact: false })).toBeVisible();
    await expect(page.getByText("fixture reason", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "F6 compareを拒否" }).click();
    expect((await app.orchestrationSnapshot()).proposal).toBeNull();
    await page.getByRole("button", { name: "次の一手を提案" }).click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
    await page.getByRole("button", { name: "次の一手の提案を閉じる" }).click();
  });

  test("F6-01 long proposal remains vertically scrollable", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 480 });
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Long proposal A");
    const b = await app.addText("Long proposal B");
    await app.selectNodes([a!, b!]);
    const longText = "長文の提案内容です。".repeat(40);
    await openProposal(page, app, JSON.stringify({
      actions: [
        { kind: "compare", targetNodeIds: [a!, b!], title: "長文比較", reason: longText, expectedResult: longText },
        { kind: "counterpoint", targetNodeIds: [a!], title: "長文反証", reason: longText, expectedResult: longText },
        { kind: "web_search", targetNodeIds: [], title: "長文調査", reason: longText, expectedResult: longText, query: "長文提案の調査" },
      ],
    }));

    const panel = page.locator('section[aria-label="Next action proposals"]');
    await expect(panel).toBeVisible();
    const dimensions = await panel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(dimensions.overflowY).toBe("auto");
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
    await panel.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByLabel("Chat message input")).toBeVisible();
  });

  test("F6-02 exact-target transform, single dispatch, stale no-op", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Transform A");
    const b = await app.addText("Transform B");
    const c = await app.addText("Other");
    await app.selectNodes([a!, b!]);
    await openProposal(page, app, fixture("compare", [a!, b!]));
    const proposal = await app.orchestrationSnapshot();
    expect(proposal.proposal.actions[0].targetNodeIds).toEqual([a, b]);
    await app.editText(a!, "changed before dispatch");
    expect(await app.dispatchNextAction(proposal.proposal.actions[0].id, { targetNodeIds: [a!, b!] })).toBeFalsy();
    expect((await app.orchestrationSnapshot()).status).toBe("stale");
    await app.setNextActionsFixture(fixture("compare", [a!, b!]));
    await page.getByRole("button", { name: "次の一手を再提案" }).click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
    await app.armDelayedDirectTransform();
    await page.getByRole("button", { name: "F6 compareを実行" }).click();
    await expect(page.getByRole("status").filter({ hasText: "実行しています" })).toBeVisible();
    await expect(page.getByRole("button", { name: "次の一手を再提案" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "次の一手の提案を閉じる" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "F6 compareを拒否" })).toBeDisabled();
    await expect(page.locator('input[type="checkbox"]').first()).toBeDisabled();
    await app.releaseDelayedDirectTransform();
    await expect(page.getByRole("status").filter({ hasText: "実行しました" })).toBeVisible();
    const after = await app.snapshot();
    expect(after.lastDirectReceipt.operation).toBe("compare");
    expect(after.domainNodes.some((node: { id: string }) => node.id === c)).toBeTruthy();
    const afterDispatch = await app.snapshot();
    await app.undo();
    expect((await app.snapshot()).nodeCount).toBe(afterDispatch.nodeCount - 1);
    await app.dismissNextActions();
    await app.setNextActionsFixture(fixture("compare", [a!, b!]));
    await app.nextActions();
    const concurrentAction = (await app.orchestrationSnapshot()).proposal.actions[0];
    const concurrent = await Promise.all([
      app.dispatchNextAction(concurrentAction.id, { targetNodeIds: [a!, b!] }),
      app.dispatchNextAction(concurrentAction.id, { targetNodeIds: [a!, b!] }),
    ]);
    expect(concurrent.filter(Boolean)).toHaveLength(1);
    await app.newWorkspace();
    expect(await app.dispatchNextAction(proposal.proposal.actions[0].id)).toBeFalsy();
  });

  test("F6-03 edited web query returns Context Packet without document mutation", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const node = await app.addText("Research claim");
    await app.selectNodes([node!]);
    const before = await app.snapshot();
    const callCountBefore = await app.nextActionsCallCount();
    await openProposal(page, app, fixture("web_search", [], { query: "initial query" }));
    expect(await app.nextActionsCallCount()).toBe(callCountBefore + 1);
    const query = page.getByRole("textbox", { name: /検索 query/ });
    await query.fill("edited query");
    await page.getByRole("button", { name: "F6 web_searchを実行" }).click();
    await expect(page.getByRole("region", { name: "Projected Context" })).toBeVisible();
    const after = await app.snapshot();
    expect(after.nodeCount).toBe(before.nodeCount);
    expect(after.lastSearchReceipt?.packet.query).toBe("edited query");
  });

  test("F6-04 structure dispatch keeps proposal separate from Accept", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const a = await app.addText("Structure A");
    const b = await app.addText("Structure B");
    await app.selectNodes([a!, b!]);
    await openProposal(page, app, fixture("suggest_relations", [a!, b!]));
    await page.getByRole("button", { name: "F6 suggest_relationsを実行" }).click();
    await expect.poll(async () => (await app.snapshot()).pendingDirectProposal?.operation.relations).toBeTruthy();
    const snapshot = await app.snapshot();
    expect(snapshot.relationCount).toBe(0);
    expect(snapshot.pendingDirectProposal?.operation.relations).toBeTruthy();
    await expect(page.getByRole("button", { name: "実行結果を閉じる" })).toBeVisible();
    await app.newWorkspace();
    const clusterA = await app.addText("Cluster A");
    const clusterB = await app.addText("Cluster B");
    await app.selectNodes([clusterA!, clusterB!]);
    await openProposal(page, app, fixture("suggest_clusters", [clusterA!, clusterB!]));
    await page.getByRole("button", { name: "F6 suggest_clustersを実行" }).click();
    await expect.poll(async () => (await app.snapshot()).lastSuggestReceipt?.status).toBe("done");
    const clusterSnapshot = await app.snapshot();
    expect(clusterSnapshot.lastSuggestReceipt?.operation).toBe("clusters");
    expect(clusterSnapshot.pendingDirectProposal).toBeTruthy();
  });

  test("F6-05 clarify, cancel/late result, invalid error, lifecycle and accessibility", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const context = await app.addText("Clarify context");
    await app.selectNodes([context!]);
    const question = "今回の判断で最も重視したい軸は何ですか？";
    await openProposal(page, app, fixture("clarify", [], { question }));
    const initial = await app.snapshot();
    expect(initial.chat.sessions[0]?.messages ?? []).toHaveLength(0);
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "F6 clarifyを実行" }).click();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Dialogue messages"]').getByText(question, { exact: true })).toHaveCount(1);
    await expect(page.getByLabel("Chat message input")).toBeVisible();

    const lateNode = await app.addText("Late context");
    await app.selectNodes([lateNode!]);
    await app.setNextActionsFixture(fixture("clarify", [], { question: "遅延した質問" }));
    await app.armDelayedNextActions();
    const pending = app.nextActions();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await app.cancelNextActions();
    await expect(page.getByRole("status").filter({ hasText: "キャンセル" })).toBeVisible();
    await app.releaseDelayedNextActions();
    await expect(pending).resolves.toBeFalsy();
    expect((await app.orchestrationSnapshot()).proposal).toBeNull();

    const child = await app.createSubCanvas([context!, lateNode!], "Lifecycle child");
    await app.setNextActionsFixture(fixture("clarify", [], { question: "navigation stale" }));
    await app.nextActions();
    await app.navigate(child.childCanvasId);
    expect((await app.orchestrationSnapshot()).proposal).toBeNull();
    await app.newWorkspace();
    expect((await app.orchestrationSnapshot()).status).toBe("idle");
    const persisted = (await app.snapshot()).json;
    expect(persisted).not.toContain("orchestration");
    await app.loadJSON(persisted);
    expect((await app.orchestrationSnapshot()).proposal).toBeNull();
    const invalidNode = await app.addText("Invalid response context");
    await app.selectNodes([invalidNode!]);

    await app.armNextActionsFault("invalid-json");
    await app.nextActions();
    expect((await app.orchestrationSnapshot()).status).toBe("error");
    await expect(page.locator('section[aria-label="Next action proposals"] div[role="alert"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "次の一手を再提案" })).toBeVisible();
  });

  test("F6-06 real-canvas bounded fallback repeats safely across scopes", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const markdown = (topic: string, urlA: string, urlB: string) =>
      `# ${topic}\n\nこれは長文の日本語 Markdown fixture です。背景、前提、反証可能性、意思決定の観点を bounded excerpt の範囲を超えて記録します。\n\n## 論点\n- 既存の仮説と観測事実を分離する。\n- 複数の出典を照合し、未確認の推論を断定しない。\n- 次の検証手順と停止条件を明示する。\n\n参考 URL: ${urlA}\n補助 URL: ${urlB}\n\n結論は固定せず、更新可能な根拠として扱います。`;
    const nodes = await Promise.all([
      app.addText(markdown("案A", "https://example.com/a", "https://example.org/a")),
      app.addText(markdown("案B", "https://example.com/b", "https://example.org/b")),
      app.addText(markdown("案C", "https://example.com/c", "https://example.org/c")),
      app.addText(markdown("案D", "https://example.com/d", "https://example.org/d")),
      app.addText(markdown("案E", "https://example.com/e", "https://example.org/e")),
      app.addText(markdown("案F", "https://example.com/f", "https://example.org/f")),
      app.addText(markdown("案G", "https://example.com/g", "https://example.org/g")),
      app.addText(markdown("案H", "https://example.com/h", "https://example.org/h")),
      app.addText(markdown("案I", "https://example.com/i", "https://example.org/i")),
    ]);
    const [a, b, c] = nodes as [string, string, string];
    await app.addRelation(a, b, "supports", "accepted provenance: primary query https://example.com/a");
    await app.addRelation(b, c, "similar", "accepted provenance: secondary query https://example.org/b");
    await app.startDialogue("比較 query: 日本語の根拠を再確認 https://example.net/query-a と https://example.net/query-b");
    await app.selectNodes([]);
    await app.setNextActionsFixture(fixture("web_search", [], { query: "日本語の本文" }));
    await page.getByRole("button", { name: "次の一手を提案" }).click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
    const fallback = await app.orchestrationSnapshot();
    expect(fallback.request?.selectedNodeIds ?? []).toEqual([]);
    expect(fallback.request?.nodeHints.length ?? 0).toBeGreaterThanOrEqual(9);
    expect((fallback.request?.nodeHints ?? []).map((hint: any) => hint.excerpt).join(" ")).toContain("https://example.com/a");
    expect((fallback.request?.nodeHints ?? []).map((hint: any) => hint.excerpt).join(" ")).toContain("https://example.org/i");
    expect((fallback.request?.nodeHints ?? []).every((hint: any) => !Object.prototype.hasOwnProperty.call(hint, "content"))).toBeTruthy();
    expect(fallback.request?.dialogueHistory?.some((turn) => turn.content.includes("query"))).toBeTruthy();
    expect(fallback.request?.relationHints.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(fallback.request?.relationHints.some((hint) => hint.provenance?.query?.includes("primary query"))).toBeTruthy();

    // Re-propose repeatedly in the same workspace/scope while changing only
    // the explicit selection. Each fixture is valid for its current scope.
    await page.getByRole("button", { name: "次の一手を再提案" }).last().click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();

    await app.selectNodes([a]);
    await app.setNextActionsFixture(fixture("counterpoint", [a]));
    await page.getByRole("button", { name: "次の一手を再提案" }).last().click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
    expect((await app.orchestrationSnapshot()).proposal?.actions[0].targetNodeIds).toEqual([a]);

    await app.selectNodes([a, b]);
    await app.setNextActionsFixture(fixture("compare", [a, b]));
    await page.getByRole("button", { name: "次の一手を再提案" }).last().click();
    await expect(page.getByRole("region", { name: "Next action proposals" }).last()).toBeVisible();
    expect((await app.orchestrationSnapshot()).proposal?.actions[0].targetNodeIds).toEqual([a, b]);

    await app.armNextActionsFault("invalid-json");
    await page.getByRole("button", { name: "次の一手を再提案" }).last().click();
    const recovery = page.locator('section[aria-label="Next action proposals"] div[role="alert"]');
    await expect(recovery).toContainText("再提案、対象を変更、または通常Chatで相談できます。");
    await expect(page.getByTestId("global-error-banner")).toHaveCount(0);
    await expect(recovery).not.toContainText(/Undo|New Workspace|relation|transform/i);

    await app.armNextActionsFault("provider-error");
    await page.getByRole("button", { name: "次の一手を再提案" }).last().click();
    await expect(recovery).toContainText("再提案、対象を変更、または通常Chatで相談できます。");
    await expect(page.getByTestId("global-error-banner")).toHaveCount(0);
    await expect(recovery).not.toContainText(/Undo|New Workspace|relation|transform/i);
  });

  test("F6-07 Chat node opinion preserves tool correlation through continuation", async ({ page }) => {
    await openApp(page);
    const app = await e2e(page);
    await app.newWorkspace();
    const node = await app.addText("Node opinion target");
    await app.selectNodes([node!]);
    await app.openChat();
    const input = page.getByLabel("Chat message input");
    await input.fill("fixture:read_canvas_node このNodeについて意見をください");
    await input.press("Enter");
    await expect(page.locator('[aria-label="Dialogue messages"]')).toContainText("fixture read_canvas_node continuation completed");

    const snapshot = await app.snapshot();
    const assistant = snapshot.chat.sessions.flatMap((session: any) => session.messages)
      .find((message: any) => message.role === "assistant" && message.content.includes("fixture read_canvas_node"));
    expect(assistant?.toolEvents?.map((event: any) => event.name)).toEqual(["read_canvas_node"]);
    expect(assistant?.toolEvents?.[0]?.status).toBe("done");
    const observations = await app.getLLMFixtureObservations();
    const requests = observations.agentRequests.slice(-2);
    expect(requests).toHaveLength(2);
    expect(requests[1].roles).toEqual(["system", "user", "assistant", "tool"]);
    expect(requests[1].assistantToolCallIds).toEqual(["fixture-read-canvas-node"]);
    expect(requests[1].assistantToolCallNames).toEqual(["read_canvas_node"]);
    expect(requests[1].toolResultIds).toEqual(["fixture-read-canvas-node"]);
    expect(requests[1].toolResultNames).toEqual(["read_canvas_node"]);
    expect(requests[1].toolResultContents[0]).toContain(node!);
    expect(requests[1].thoughtSignatures).toEqual(["fixture-thought-signature"]);
  });
});
