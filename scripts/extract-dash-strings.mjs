// Collects the English text of the owner dashboard into lib/dash-strings.json, using the TypeScript
// parser: JSX text, UI attributes (placeholder, aria-label, title, alt) and UI-looking string
// literals. Template literals keep their shape with {n} where a value goes, e.g. "{n} of {n}".
// The dashboard translates exactly these strings into the owner's language (see DashTranslator).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOTS = ["app/dashboard", "components/dashboard", "components/SupportChat.tsx", "lib/format.ts", "lib/themes.ts"];
const UI_ATTRS = new Set(["placeholder", "aria-label", "title", "alt", "label"]);
const SKIP_ATTRS = new Set(["className", "href", "src", "style", "type", "id", "key", "role", "accept", "autoComplete", "inputMode", "rel", "target", "htmlFor", "name", "value", "viewBox", "d", "lang", "dir", "precedence", "aria-current", "aria-hidden"]);
const SKIP_CALLS = new Set(["from", "select", "eq", "rpc", "order", "in", "upsert", "insert", "update", "delete", "fetch", "matchMedia", "getItem", "setItem", "removeItem", "addEventListener", "removeEventListener", "querySelector", "querySelectorAll", "postMessage", "channel", "on", "upload", "getPublicUrl", "push", "replace", "createElement", "getContext", "toDataURL", "includes", "startsWith", "split", "join", "test", "toLocaleDateString", "toLocaleTimeString", "toLocaleString", "setAttribute", "getComputedStyle", "require", "import", "storage", "cookies", "get", "set", "has", "Error", "String", "Number"]);
const SKIP_PROPS = new Set(["className", "href", "icon", "font", "google", "family", "id", "kind", "scripts", "brand", "ink", "card", "sheet", "chip", "paper", "text", "dim", "line", "cards", "contentType", "cacheControl", "method", "behavior", "type"]);

const files = [];
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.tsx?$/.test(p) && files.push(p));
ROOTS.forEach(walk);

const out = new Set();
const add = (raw) => {
  const s = raw.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 400 || !/[A-Za-z]{2}/.test(s.replace(/\{n\}/g, ""))) return;
  out.add(s);
};
const looksLikeText = (s) => /^[A-Z“"‘'(+•·←→✓]/.test(s.trim()) || (/ /.test(s.trim()) && /^[a-z]/i.test(s.trim()) && !/[{}=;<>]|--|\(|\)\s*=>/.test(s));
const codey = (s) => /^[a-z0-9_.-]+$/.test(s) || /^(\/|#|https?:|@\/|\.\/|var\(|rgba?\(|linear-gradient|url\()/.test(s) || /^[a-z-]+(\s[a-z-]+)*$/.test(s) && !/\s(the|a|to|of|your|and|or|for|in|on|with|is|it)\s/.test(` ${s} `);

function callName(node) {
  let p = node.parent;
  while (p && (ts.isBinaryExpression(p) || ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isTemplateSpan(p))) p = p.parent;
  if (p && ts.isCallExpression(p)) {
    const e = p.expression;
    return ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : "";
  }
  return null;
}
function propName(node) {
  const p = node.parent;
  if (p && ts.isPropertyAssignment(p) && p.initializer === node) return p.name.getText();
  return null;
}
function attrName(node) {
  let p = node.parent;
  while (p && !ts.isJsxAttribute(p) && !ts.isJsxElement(p) && !ts.isJsxSelfClosingElement(p) && !ts.isSourceFile(p) && !ts.isBlock(p)) p = p.parent;
  return p && ts.isJsxAttribute(p) ? p.name.getText() : null;
}
function literal(node, text) {
  if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExpressionStatement(node.parent)) return;
  const attr = attrName(node);
  if (attr && (SKIP_ATTRS.has(attr) || (!UI_ATTRS.has(attr) && !/^on[A-Z]/.test(attr) && !looksLikeText(text)))) return;
  const call = callName(node);
  if (call && SKIP_CALLS.has(call)) return;
  const prop = propName(node);
  if (prop && SKIP_PROPS.has(prop)) return;
  if (ts.isElementAccessExpression(node.parent) || ts.isCaseClause(node.parent)) return;
  if (ts.isBinaryExpression(node.parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.parent.operatorToken.kind)) return;
  if (ts.isLiteralTypeNode(node.parent)) return;
  if (codey(text) || !(attr && UI_ATTRS.has(attr)) && !looksLikeText(text)) return;
  add(text);
}

for (const f of files) {
  const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node.text);
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literal(node, node.text);
    else if (ts.isTemplateExpression(node)) literal(node, node.head.text + node.templateSpans.map((s) => "{n}" + s.literal.text).join(""));
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const list = [...out].sort();
writeFileSync("lib/dash-strings.json", JSON.stringify(list) + "\n");
console.log(`dash strings: ${list.length}`);
