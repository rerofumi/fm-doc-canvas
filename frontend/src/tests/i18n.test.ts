import i18next from "i18next";
import { en } from "../i18n/resources/en";
import { ja } from "../i18n/resources/ja";
import {
  normalizeLocalePreference,
  readLocalePreference,
  resolveEffectiveLocale,
  resolveSystemLocale,
  writeLocalePreference,
} from "../i18n/localePreference";
import { resources } from "../i18n/i18n";
import {
  formatDate,
  formatCount,
  formatNumber,
  presentAction,
  presentActionLevel,
  presentControl,
  presentDocumentEffect,
  presentRelationDirection,
  presentRelationKind,
  presentResultSurface,
  presentRole,
  presentRoute,
  presentStatus,
  presentUiMessage,
  presentDirectOperation,
  presentNextActionKind,
  type UiMessageDescriptor,
} from "../i18n";
import { initI18n } from "../i18n/i18n";

const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  },
  ok(value: unknown, message?: string): void {
    if (!value) throw new Error(message ?? "Expected a truthy value");
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
};

const flatten = (value: Record<string, unknown>, prefix = ""): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[path] = child;
    else Object.assign(result, flatten(child as Record<string, unknown>, path));
  }
  return result;
};

const jaKeys = flatten(ja);
const enKeys = flatten(en);
assert.deepEqual(Object.keys(enKeys).sort(), Object.keys(jaKeys).sort(), "catalog key sets must match");
for (const [key, value] of Object.entries(jaKeys)) {
  assert.ok(value.trim(), `ja value must not be empty: ${key}`);
  assert.ok(enKeys[key]?.trim(), `en value must not be empty: ${key}`);
}

assert.equal(resolveSystemLocale(["fr-FR", "ja-JP"], "en-US"), "ja");
assert.equal(resolveSystemLocale(["fr-FR", "en-GB"], "ja-JP"), "en");
assert.equal(resolveSystemLocale(["fr-FR"], "de-DE"), "en");
assert.equal(resolveSystemLocale(["EN_us"], undefined), "en");
assert.equal(resolveEffectiveLocale("ja", ["en"], "en"), "ja");
assert.equal(resolveEffectiveLocale("system", ["ja-JP"], "en-US"), "ja");
assert.equal(resolveEffectiveLocale("invalid", ["ja-JP"], "en-US"), "ja");
assert.equal(normalizeLocalePreference("invalid"), "system");
assert.equal(normalizeLocalePreference(null), "system");

const storage = new Map<string, string>();
const storageAdapter = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
};
assert.equal(readLocalePreference(storageAdapter), "system");
assert.equal(writeLocalePreference("ja", storageAdapter), true);
assert.equal(readLocalePreference(storageAdapter), "ja");
assert.equal(writeLocalePreference("en", { setItem: () => { throw new Error("blocked"); } }), false);
assert.equal(readLocalePreference({ getItem: () => { throw new Error("blocked"); } }), "system");

const runI18nRuntimeTest = async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: "ja",
    fallbackLng: "en",
    supportedLngs: ["ja", "en"],
    resources,
    defaultNS: "translation",
    returnNull: false,
    returnEmptyString: false,
    enableSelector: true,
    parseMissingKeyHandler: () => "",
    interpolation: { escapeValue: false },
  });
  const pluralSurfaceRenderers = [
    {
      key: "layout.upBoundaryRelations",
      render: (count: number) => instance.t(($) => $.layout.upBoundaryRelations, { count }),
      ja: (count: number) => `上位境界 Relation ${formatCount(count, "ja-JP")} 件`,
      en: (count: number) => `${formatCount(count, "en-US")} up-boundary ${count === 1 ? "relation" : "relations"}`,
    },
    {
      key: "editor.chars",
      render: (count: number) => instance.t(($) => $.editor.chars, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 文字`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "char" : "chars"}`,
    },
    {
      key: "editor.characters",
      render: (count: number) => instance.t(($) => $.editor.characters, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 文字`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "character" : "characters"}`,
    },
    {
      key: "editor.words",
      render: (count: number) => instance.t(($) => $.editor.words, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 語`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "word" : "words"}`,
    },
    {
      key: "canvas.chars",
      render: (count: number) => instance.t(($) => $.canvas.chars, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 文字`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "char" : "chars"}`,
    },
    {
      key: "canvas.words",
      render: (count: number) => instance.t(($) => $.canvas.words, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 語`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "word" : "words"}`,
    },
    {
      key: "canvas.relations",
      render: (count: number) => instance.t(($) => $.canvas.relations, { count }),
      ja: (count: number) => `${formatCount(count, "ja-JP")} 件の Relation`,
      en: (count: number) => `${formatCount(count, "en-US")} ${count === 1 ? "relation" : "relations"}`,
    },
  ] as const;
  const assertPluralSurfaces = async (locale: "ja" | "en") => {
    await instance.changeLanguage(locale);
    for (const surface of pluralSurfaceRenderers) {
      for (const count of [0, 1, 2, 1000]) {
        const expected = surface[locale](count);
        assert.equal(surface.render(count), expected, `${locale} ${surface.key} count=${count}`);
      }
    }
  };
  await assertPluralSurfaces("ja");
  await assertPluralSurfaces("en");

  const countCases = [0, 1, 2, 1000] as const;
  const assertCountSurface = async (
    locale: "ja" | "en",
    key: string,
    render: (count: number) => string,
    expected: (count: number) => string,
  ) => {
    await instance.changeLanguage(locale);
    for (const count of countCases) {
      assert.equal(render(count), expected(count), `${locale} ${key} count=${count}`);
    }
  };
  const number = (count: number, locale: "ja" | "en") => formatCount(count, locale === "ja" ? "ja-JP" : "en-US");
  for (const locale of ["ja", "en"] as const) {
    const sourceWord = locale === "ja" ? (count: number) => `ソース ${number(count, locale)} 件` : (count: number) => `${number(count, locale)} ${count === 1 ? "source" : "sources"}`;
    const claimWord = locale === "ja" ? (count: number) => `主張 ${number(count, locale)} 件` : (count: number) => `${number(count, locale)} ${count === 1 ? "claim" : "claims"}`;
    const textWord = locale === "ja" ? (count: number) => `テキスト ${number(count, locale)} 件` : (count: number) => `${number(count, locale)} ${count === 1 ? "text" : "texts"}`;
    const imageWord = locale === "ja" ? (count: number) => `画像 ${number(count, locale)} 件` : (count: number) => `${number(count, locale)} ${count === 1 ? "image" : "images"}`;
    const summaryTextWord = locale === "ja" ? (count: number) => `Text ${number(count, locale)} 件` : textWord;
    const summaryImageWord = locale === "ja" ? (count: number) => `Image ${number(count, locale)} 件` : imageWord;
    await assertCountSurface(locale, "assistant.tool.packetCounts.sources", (count) => instance.t(($) => $.assistant.tool.packetCounts.sources, { count }), sourceWord);
    await assertCountSurface(locale, "assistant.tool.packetCounts.claims", (count) => instance.t(($) => $.assistant.tool.packetCounts.claims, { count }), claimWord);
    await assertCountSurface(locale, "assistant.tool.packetCounts", (count) => `${instance.t(($) => $.assistant.tool.packetCounts.sources, { count })}${instance.t(($) => $.assistant.tool.packetCounts.separator)}${instance.t(($) => $.assistant.tool.packetCounts.claims, { count })}`, (count) => `${sourceWord(count)} · ${claimWord(count)}`);
    await assertCountSurface(locale, "context.payloadAria.text", (count) => instance.t(($) => $.context.payloadAria.text, { count }), textWord);
    await assertCountSurface(locale, "context.payloadAria.image", (count) => instance.t(($) => $.context.payloadAria.image, { count }), imageWord);
    await assertCountSurface(locale, "context.payloadAria", (count) => `${instance.t(($) => $.context.payloadAria.prefix)} ${instance.t(($) => $.context.payloadAria.text, { count })}${instance.t(($) => $.context.payloadAria.separator)}${instance.t(($) => $.context.payloadAria.image, { count })}`, (count) => locale === "ja" ? `Context payload: ${textWord(count)}、${imageWord(count)}` : `Context payload: ${textWord(count)}, ${imageWord(count)}`);
    await assertCountSurface(locale, "context.payloadSummary.text", (count) => instance.t(($) => $.context.payloadSummary.text, { count }), summaryTextWord);
    await assertCountSurface(locale, "context.payloadSummary.image", (count) => instance.t(($) => $.context.payloadSummary.image, { count }), summaryImageWord);
    await assertCountSurface(locale, "context.payloadSummary", (count) => `${instance.t(($) => $.context.payloadSummary.text, { count })}${instance.t(($) => $.context.payloadSummary.separator)}${instance.t(($) => $.context.payloadSummary.image, { count })}`, (count) => `${summaryTextWord(count)}${locale === "ja" ? "・" : " · "}${summaryImageWord(count)}`);
    const selectedExpected = locale === "ja"
      ? (count: number) => `${number(count, locale)} / ${number(5, locale)} 件を選択`
      : (count: number) => `${number(count, locale)} / ${number(5, locale)} ${count === 1 ? "item" : "items"} selected`;
    await assertCountSurface(locale, "context.selected", (count) => instance.t(($) => $.context.selected, { count, max: 5 }), selectedExpected);
    const candidateExpected = locale === "ja"
      ? (count: number) => `候補 ${number(count, locale)} 件`
      : (count: number) => `${number(count, locale)} ${count === 1 ? "candidate" : "candidates"}`;
    await assertCountSurface(locale, "proposal.candidateCount", (count) => instance.t(($) => $.proposal.candidateCount, { count }), candidateExpected);
    const acceptExpected = locale === "ja"
      ? (count: number) => `選択した ${number(count, locale)} 件を承認`
      : (count: number) => `Accept ${number(count, locale)} selected ${count === 1 ? "item" : "items"}`;
    await assertCountSurface(locale, "proposal.acceptSelected", (count) => instance.t(($) => $.proposal.acceptSelected, { count }), acceptExpected);
  }
  await instance.changeLanguage("ja");

  // Selector API is the canonical typed access path for bundled catalog keys.
  assert.equal(instance.t(($) => $.settings.language.label), "言語");
  await instance.changeLanguage("en");
  assert.equal(instance.t(($) => $.settings.language.label), "Language");
  assert.equal(instance.t(($) => $.settings.language.ja), "日本語");
  assert.equal(instance.t(($) => $.settings.language.system), "System");

  // Missing keys are a testable runtime safety contract: they do not render a
  // semantic key-looking fallback into production UI.
  // @ts-expect-error Unknown selector key must be rejected by the catalog type.
  const missing = instance.t(($) => $.settings.language.missing);
  assert.equal(missing, "", "missing catalog keys must not be rendered");
  // @ts-expect-error Unknown string key must be rejected by selector-mode typing.
  const unknown = instance.t("settings.language.unknown");
  assert.equal(unknown, "", "unknown catalog keys must not be rendered");

  // The expected selector access is available at compile time; an invalid
  // selector must keep the @ts-expect-error above meaningful (TS2578 otherwise).
  instance.t(($) => $.settings.language.en);

  await initI18n("ja");
  assert.equal(presentUiMessage({ code: "messages.defaultChatTitle" }), "新しい会話");
  const descriptors: UiMessageDescriptor[] = [
    { code: "messages.defaultChatTitle" },
    { code: "canvas.saveFailed" }, { code: "canvas.loadFailed" },
    { code: "canvas.importFailed" }, { code: "canvas.exportFailed" },
    { code: "image.loadFailed" }, { code: "editor.summaryFailed" },
    { code: "tool.imagePreviewFailed" }, { code: "context.packetFailed" },
    { code: "chat.loadFailed" }, { code: "chat.saveFailed" },
    { code: "chat.contextWarning" }, { code: "chat.responseFailed" },
    { code: "chat.cancelled" }, { code: "operation.failed" },
    { code: "operation.commandFailed" }, { code: "operation.directTransformFailed" },
    { code: "operation.directActionFailed" }, { code: "operation.searchFailed" },
    { code: "operation.searchInvalidQuery" }, { code: "operation.proposalStale" },
    { code: "operation.proposalConflict" }, { code: "operation.selectionRequiresTwo" },
    { code: "operation.subcanvasEmptyName" }, { code: "operation.subcanvasNoParent" },
    { code: "operation.subcanvasNoNodes" }, { code: "operation.subcanvasParentMissing" },
    { code: "operation.folderDeleteDisabled" }, { code: "operation.clusterNotFound" },
    { code: "operation.clusterTooSmall" }, { code: "operation.invalidInput" },
    { code: "subcanvas.moveSuccess", values: { count: 0 } },
    { code: "subcanvas.moveSuccess", values: { count: 1 } },
    { code: "subcanvas.moveSuccess", values: { count: 2 } },
    { code: "nextAction.failed" }, { code: "nextAction.invalid" },
  ];
  const assertPresentationText = (value: string, label: string) => {
    assert.ok(value.trim(), `${label} must not be empty`);
    assert.ok(!value.includes("messages."), `${label} must not render a key: ${value}`);
  };
  descriptors.forEach((descriptor, index) => assertPresentationText(presentUiMessage(descriptor), `ja descriptor ${index}`));
  const jaMove = [0, 1, 2].map((count) => presentUiMessage({ code: "subcanvas.moveSuccess", values: { count } }));
  jaMove.forEach((text, index) => assert.ok(text.includes(String(index)), `ja plural ${index} must include its count`));
  const actionKinds = ["clarify", "compare", "counterpoint", "web_search", "suggest_relations", "suggest_clusters"] as const;
  actionKinds.forEach((kind) => assertPresentationText(presentNextActionKind(kind), `ja next action ${kind}`));
  actionKinds.forEach((kind) => {
    const action = presentAction(kind);
    [action.roleLabel, action.actionLevelLabel, action.routeLabel, action.documentEffectLabel, action.controlLabel, action.resultSurfaceLabel]
      .forEach((text, index) => assertPresentationText(text, `ja action ${kind}/${index}`));
  });
  (["questioner", "comparer", "critic", "researcher", "organizer"] as const).map(presentRole).forEach((text, i) => assertPresentationText(text, `ja role ${i}`));
  (["AL-0", "AL-1", "AL-2"] as const).map(presentActionLevel).forEach((text, i) => assertPresentationText(text, `ja action level ${i}`));
  (["dialogue", "direct-transform", "direct-web-search", "direct-relation-suggestion", "direct-cluster-suggestion"] as const).map(presentRoute).forEach((text, i) => assertPresentationText(text, `ja route ${i}`));
  (["dialogue", "transform", "web-search", "proposal"] as const).map(presentDocumentEffect).forEach((text, i) => assertPresentationText(text, `ja effect ${i}`));
  (["answer-dismiss", "undo", "dismiss-promote", "modify-accept-reject", "modify-accept-reject-close"] as const).map(presentControl).forEach((text, i) => assertPresentationText(text, `ja control ${i}`));
  (["dialogue", "direct-transform", "context-packet", "relation-proposal", "cluster-proposal"] as const).map(presentResultSurface).forEach((text, i) => assertPresentationText(text, `ja result ${i}`));
  (["running", "proposed", "applied", "rejected", "conflict", "cancelled", "stale", "error", "done", "pending", "ready", "failed"] as const).map(presentStatus).forEach((text, i) => assertPresentationText(text, `ja status ${i}`));
  (["source", "derived", "supports", "opposes", "similar"] as const).map(presentRelationKind).forEach((text, i) => assertPresentationText(text, `ja relation ${i}`));
  (["forward", "reverse"] as const).map(presentRelationDirection).forEach((text, i) => assertPresentationText(text, `ja direction ${i}`));
  const jaVisibleFailure = presentUiMessage({ code: "canvas.exportFailed" });
  const cancelledDescriptor: UiMessageDescriptor = { code: "chat.cancelled" };
  const jaCancelled = presentUiMessage(cancelledDescriptor);
  assert.equal(jaCancelled, "キャンセルしました。", "cancelled chat descriptor must render Japanese copy");
  assert.equal(formatNumber(1234.5, "ja-JP"), "1,234.5");
  const jaDate = formatDate(0, "ja-JP", { timeZone: "UTC" });
  assert.ok(jaDate.includes("1970"), `ja date must include year: ${jaDate}`);
  assert.equal(formatCount(10000, "ja-JP"), "10,000");
  assert.ok(presentUiMessage({ code: "subcanvas.moveSuccess", values: { count: 10000 } }).includes("10,000"), `ja formatted count: ${presentUiMessage({ code: "subcanvas.moveSuccess", values: { count: 10000 } })}`);
  assert.equal(presentDirectOperation("compare"), "比較");
  await initI18n("en");
  assert.equal(presentUiMessage({ code: "messages.defaultChatTitle" }), "New chat");
  const enMove = [0, 1, 2].map((count) => presentUiMessage({ code: "subcanvas.moveSuccess", values: { count } }));
  assert.equal(enMove[0], "Moved 0 nodes.");
  assert.equal(enMove[1], "Moved 1 node.");
  assert.equal(enMove[2], "Moved 2 nodes.");
  descriptors.forEach((descriptor, index) => assertPresentationText(presentUiMessage(descriptor), `en descriptor ${index}`));
  actionKinds.forEach((kind) => assertPresentationText(presentNextActionKind(kind), `en next action ${kind}`));
  actionKinds.forEach((kind) => {
    const action = presentAction(kind);
    [action.roleLabel, action.actionLevelLabel, action.routeLabel, action.documentEffectLabel, action.controlLabel, action.resultSurfaceLabel]
      .forEach((text, index) => assertPresentationText(text, `en action ${kind}/${index}`));
  });
  (["questioner", "comparer", "critic", "researcher", "organizer"] as const).map(presentRole).forEach((text, i) => assertPresentationText(text, `en role ${i}`));
  (["AL-0", "AL-1", "AL-2"] as const).map(presentActionLevel).forEach((text, i) => assertPresentationText(text, `en action level ${i}`));
  (["dialogue", "direct-transform", "direct-web-search", "direct-relation-suggestion", "direct-cluster-suggestion"] as const).map(presentRoute).forEach((text, i) => assertPresentationText(text, `en route ${i}`));
  (["dialogue", "transform", "web-search", "proposal"] as const).map(presentDocumentEffect).forEach((text, i) => assertPresentationText(text, `en effect ${i}`));
  (["answer-dismiss", "undo", "dismiss-promote", "modify-accept-reject", "modify-accept-reject-close"] as const).map(presentControl).forEach((text, i) => assertPresentationText(text, `en control ${i}`));
  (["dialogue", "direct-transform", "context-packet", "relation-proposal", "cluster-proposal"] as const).map(presentResultSurface).forEach((text, i) => assertPresentationText(text, `en result ${i}`));
  (["running", "proposed", "applied", "rejected", "conflict", "cancelled", "stale", "error", "done", "pending", "ready", "failed"] as const).map(presentStatus).forEach((text, i) => assertPresentationText(text, `en status ${i}`));
  (["source", "derived", "supports", "opposes", "similar"] as const).map(presentRelationKind).forEach((text, i) => assertPresentationText(text, `en relation ${i}`));
  (["forward", "reverse"] as const).map(presentRelationDirection).forEach((text, i) => assertPresentationText(text, `en direction ${i}`));
  assert.equal(formatNumber(1234.5, "en-US"), "1,234.5");
  assert.equal(formatCount(10000, "en-US"), "10,000");
  assert.ok(presentUiMessage({ code: "subcanvas.moveSuccess", values: { count: 10000 } }).includes("10,000"), `en formatted count: ${presentUiMessage({ code: "subcanvas.moveSuccess", values: { count: 10000 } })}`);
  assert.equal(presentDirectOperation("compare"), "Compare");
  const enDate = formatDate(0, "en-US", { timeZone: "UTC" });
  assert.ok(enDate.includes("1970"), `en date must include year: ${enDate}`);
  assert.ok(jaDate !== enDate, `ja/en date formats must be locale-aware: ${jaDate} / ${enDate}`);
  assert.ok(jaVisibleFailure !== presentUiMessage({ code: "canvas.exportFailed" }), "the same descriptor must re-present after locale change");
  assert.equal(presentUiMessage(cancelledDescriptor), "Cancelled.", "cancelled chat descriptor must re-present in English after locale change");
  assert.ok(jaCancelled !== presentUiMessage(cancelledDescriptor), "cancelled chat descriptor must be locale-neutral");
  console.log("i18n foundation tests passed");
};

void runI18nRuntimeTest();
