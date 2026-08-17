import {
  handleMarkdownLinkClick,
  isAllowedExternalMarkdownUrl,
} from "../components/markdown/markdownLinks";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const event = () => {
  let prevented = false;
  let stopped = false;
  return {
    value: {
      preventDefault: () => {
        prevented = true;
      },
      stopPropagation: () => {
        stopped = true;
      },
    },
    wasPrevented: () => prevented,
    wasStopped: () => stopped,
  };
};

for (const url of [
  "http://example.com/docs",
  "https://example.com/docs?q=1#top",
]) {
  assert(isAllowedExternalMarkdownUrl(url), `${url} should be allowed`);
}

for (const url of [
  "mailto:user@example.com",
  "javascript:alert(1)",
  "file:///tmp/example.md",
  "/relative/path",
  "#fragment",
  "//example.com/protocol-relative",
  undefined,
]) {
  assert(!isAllowedExternalMarkdownUrl(url), `${url} should be rejected`);
}

const allowed = event();
const opened: string[] = [];
assert(
  handleMarkdownLinkClick(
    allowed.value,
    "https://example.com/accepted",
    (url) => opened.push(url),
  ),
  "allowed link click should report handled",
);
assert(allowed.wasPrevented() && allowed.wasStopped(), "allowed link should stop WebView navigation and propagation");
assert(opened.join(",") === "https://example.com/accepted", "allowed link was not delegated exactly once");

const rejected = event();
assert(
  !handleMarkdownLinkClick(rejected.value, "javascript:alert(1)", (url) => opened.push(url)),
  "rejected link click should not report an external launch",
);
assert(rejected.wasPrevented() && rejected.wasStopped(), "rejected link should still stop WebView navigation and propagation");
assert(opened.join(",") === "https://example.com/accepted", "rejected link reached the external browser");

console.log("markdownLinks tests passed");
