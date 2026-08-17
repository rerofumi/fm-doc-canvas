import { expect, test } from "@playwright/test";
import { e2e, openApp } from "./helpers";

test.describe("WP-2/WP-3 chat history and Text Node", () => {
  test("fixture observes prior turn and explicit conversation Text Node creation", async ({ page }) => {
    await openApp(page);
    const api = await e2e(page);
    await api.newWorkspace();
    await api.openChat();

    const input = page.getByLabel("Chat message input");
    const send = page.getByRole("button", { name: "送信" });
    await input.fill("fixture:history-first FIRST-TURN-UNIQUE");
    await send.click();
    await expect.poll(async () => (await api.getLLMFixtureObservations()).agentRequests.length).toBeGreaterThan(0);
    await expect(page.getByLabel("Dialogue messages")).toContainText(
      "I recorded FIRST-TURN-UNIQUE from this turn.",
    );

    await input.fill("fixture:history-second");
    await send.click();
    await expect.poll(async () => (await api.getLLMFixtureObservations()).agentRequests.length).toBeGreaterThan(1);
    await expect(page.getByLabel("Dialogue messages")).toContainText(
      "I remember FIRST-TURN-UNIQUE from the earlier turn.",
    );
    const observations = await api.getLLMFixtureObservations();
    const second = observations.agentRequests.at(-1);
    expect(second.roles).toEqual(["system", "user", "assistant", "user"]);
    expect(second.contents.some((content: string) => content.includes("FIRST-TURN-UNIQUE"))).toBeTruthy();

    const textCreationPrompt = "さっきの情報をまとめてText NodeとしてCanvasに貼って";
    await input.fill(textCreationPrompt);
    await send.click();
    await expect(page.getByLabel("Accept proposal")).toBeVisible();
    const textObservations = await api.getLLMFixtureObservations();
    const textRequest = textObservations.agentRequests.at(-1);
    expect(textRequest.contents.at(-1)).toContain(textCreationPrompt);
    await page.getByLabel("Accept proposal").click();
    await expect.poll(async () => (await api.snapshot()).domainNodes.length).toBe(1);
    const created = (await api.snapshot()).domainNodes[0];
    expect(created.kind).toBe("text");
    expect(created.content).toContain("FIRST-TURN-UNIQUE");

    await api.undo();
    expect((await api.snapshot()).domainNodes).toHaveLength(0);
  });

  test("natural Japanese Artifact creation uses the current prompt and undo", async ({ page }) => {
    await openApp(page);
    const api = await e2e(page);
    await api.newWorkspace();
    await api.openChat();

    const input = page.getByLabel("Chat message input");
    const send = page.getByRole("button", { name: "送信" });
    const artifactCreationPrompt = "ここまでをArtifactとしてCanvasに貼って";
    await input.fill(artifactCreationPrompt);
    await send.click();
    await expect(page.getByLabel("Accept proposal")).toBeVisible();
    const observations = await api.getLLMFixtureObservations();
    const request = observations.agentRequests.at(-1);
    expect(request.contents.at(-1)).toContain(artifactCreationPrompt);
    await page.getByLabel("Accept proposal").click();
    await expect.poll(async () => (await api.snapshot()).domainNodes.length).toBe(1);
    const artifact = (await api.snapshot()).domainNodes[0];
    expect(artifact.kind).toBe("text");
    expect(artifact.role).toBe("artifact");

    await api.undo();
    expect((await api.snapshot()).domainNodes).toHaveLength(0);
  });

  test("Japanese Artifact write prompt creates the requested role and can be undone", async ({ page }) => {
    await openApp(page);
    const api = await e2e(page);
    await api.newWorkspace();
    await api.openChat();

    const input = page.getByLabel("Chat message input");
    const send = page.getByRole("button", { name: "送信" });
    const artifactCreationPrompt = "この浅漬けのまとめを Artifact Node として canvas に書き込んでください";
    await input.fill(artifactCreationPrompt);
    await send.click();
    await expect(page.getByLabel("Accept proposal")).toBeVisible();

    const observations = await api.getLLMFixtureObservations();
    const request = observations.agentRequests.at(-1);
    const currentPrompt = request.contents.at(-1).split("User request:\n").at(-1);
    expect(currentPrompt).toBe(artifactCreationPrompt);

    await page.getByLabel("Accept proposal").click();
    await expect.poll(async () => (await api.snapshot()).domainNodes.length).toBe(1);
    const artifact = (await api.snapshot()).domainNodes[0];
    expect(artifact.kind).toBe("text");
    expect(artifact.role).toBe("artifact");

    await api.undo();
    expect((await api.snapshot()).domainNodes).toHaveLength(0);
  });
});
