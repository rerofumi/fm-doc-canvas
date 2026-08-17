import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const normalize = (file) => path.relative(root, file).replaceAll(path.sep, "/");

// Only technical identifiers and user/model supplied values may remain literal.
// Keep entries exact and reviewable; never use a broad file or directory wildcard.
export const literalAllowlist = [
  { file: "App.tsx", pattern: /^FM Doc Canvas$/, reason: "product brand" },
  { file: "App.tsx", pattern: /^· rev$/, reason: "technical revision marker" },
  { file: "runtime/e2eBridge.ts", pattern: /^hello dialogue$/, reason: "E2E fixture user content" },
  { file: "utils/artifact.ts", pattern: /^markdown$|^text$/, reason: "persisted technical format enum" },
  { file: "components/drawer/SettingsDrawer.tsx", pattern: /^grok-imagine-image$|^xai-\.\.\.$/, reason: "provider configuration placeholder" },
  { file: "components/drawer/EditorDrawer.tsx", pattern: /^chapter\.md$/, reason: "file-name placeholder" },
  { file: "components/chat/ChatHeader.tsx", pattern: /^(?:OpenRouter|OpenAI|Google|xAI)$/, reason: "provider name" },
  { file: "components/drawer/SettingsDrawer.tsx", pattern: /^(?:OpenRouter|OpenAI|Google|xAI|Ollama|Kagi|Brave)$/, reason: "provider name" },
  { file: "domain/transform.ts", pattern: /^(?:summarize|compare|counterpoint)$/, reason: "domain operation identifier" },
  { file: "domain/workspaceCommands.ts", pattern: /^(?:clearCanvas|createText|createDirectText|importTextFile|createImageRef|applyImageVariant|promoteContextItems|editTextContent|editTextMetadata|switchTextRole|createSubCanvas|dissolveSubCanvas|moveFolderSubtree|renameSubCanvas|moveNodes|moveNodePositions|resizeNode|deleteNodes|addRelation|addRelations|updateRelation|reverseRelation|removeRelation)$/, reason: "history command identifier" },
];

const sourceFiles = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "i18n" || entry.name === "tests" || entry.name === "fixtures") continue;
      collect(file);
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      sourceFiles.push(file);
    }
  }
}
collect(root);

const natural = /[A-Za-z\u3040-\u30ff\u3400-\u9fff]/u;
const technical = /^(?:https?:\/\/|wss?:\/\/|data:|blob:|[A-Z0-9_]+(?:[.:/@{}$-][A-Z0-9_]+)*|[a-z][a-z0-9]*(?:[./:@{}$][a-z0-9]+)+)$/u;
const attrs = new Set(["aria-label", "aria-description", "title", "placeholder", "alt"]);
const presentationFields = new Set(["label", "message", "description", "emptyText", "errorText", "successText", "warningText", "helperText", "ariaLabel"]);
const userFacingSetters = /^(?:set(?:Error|Message|Description|EmptyText|Warning|Notice|Status|Toast|Notification)|alert|confirm)$/u;

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function isRenderedJsxLiteral(node) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isJsxExpression(parent)) return parent.expression === current;
    if (ts.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (ts.isConditionalExpression(parent) && (parent.whenTrue === current || parent.whenFalse === current)) {
      current = parent;
      continue;
    }
    if (ts.isBinaryExpression(parent) && (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken || parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) && parent.right === current) {
      current = parent;
      continue;
    }
    return false;
  }
  return false;
}

function isDirectJsxAttributeExpression(node) {
  return ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent);
}

function jsxAttributeName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) return current.name.text;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return undefined;
    current = current.parent;
  }
  return undefined;
}

function shouldCheckJsxExpression(node) {
  const attribute = jsxAttributeName(node);
  if (!attribute) return true;
  if (attrs.has(attribute)) return true;
  // Styling, selectors, DOM wiring, and event handlers are technical JSX
  // values, not user-facing copy. Presentation fields are checked separately.
  return false;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function isTechnical(text) {
  const trimmed = text.trim();
  return !trimmed || !natural.test(trimmed) || technical.test(trimmed);
}

function isAllowed(file, text) {
  const rel = normalize(file);
  const value = text.trim();
  return literalAllowlist.some((item) => item.file === rel && item.pattern.test(value));
}

const findings = [];
function add(file, node, kind, text) {
  if (!text || !natural.test(text) || isTechnical(text) || isAllowed(file, text)) return;
  const source = fs.readFileSync(file, "utf8");
  const line = source.slice(0, node.getStart()).split(/\r?\n/u).length;
  findings.push({ file: normalize(file), line, kind, text: text.replace(/\s+/gu, " ").trim().slice(0, 120) });
}

for (const file of sourceFiles) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isJsxText(node)) add(file, node, "JsxText", node.getText(source));
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isRenderedJsxLiteral(node) &&
      !isDirectJsxAttributeExpression(node) &&
      shouldCheckJsxExpression(node)
    ) {
      add(file, node, "jsx:expression", node.text);
    }
    if (ts.isJsxAttribute(node) && attrs.has(node.name.text) && node.initializer) {
      const value = ts.isStringLiteral(node.initializer) ? node.initializer.text : ts.isJsxExpression(node.initializer) ? literalValue(node.initializer.expression) : undefined;
      if (value !== undefined) add(file, node, `jsx:${node.name.text}`, value);
    }
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      if (name && userFacingSetters.test(name)) {
        for (const arg of node.arguments) {
          const value = literalValue(arg);
          if (value !== undefined) add(file, arg, `call:${name}`, value);
        }
      }
    }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && presentationFields.has(node.name.text)) {
      const value = literalValue(node.initializer);
      if (value !== undefined) add(file, node.initializer, `field:${node.name.text}`, value);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind));
if (findings.length) {
  console.error(`i18n checker: ${findings.length} unallowlisted production literal(s)`);
  for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.kind}: ${finding.text}`);
  process.exitCode = 1;
} else {
  console.log(`i18n checker: 0 unallowlisted production literals (${sourceFiles.length} files scanned)`);
}
