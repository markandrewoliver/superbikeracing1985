// Static check: simulate ES module evaluation order from main.js and report top-level code that touches
// another module's let/const before that module has run.
import fs from 'node:fs'; import path from 'node:path';
import * as acorn from 'acorn'; import * as walk from 'acorn-walk'; import * as eslintScope from 'eslint-scope';
const ROOT = process.argv[2];
const files = []; (function rd(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'assets') rd(p); } else if (f.endsWith('.js')) files.push(p); } })(ROOT);
const mods = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', ranges: true, locations: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const ms = sm.scopes.find((s) => s.type === 'module');
  const imports = []; const importedFrom = new Map();
  for (const s of ast.body) if (s.type === 'ImportDeclaration') {
    const target = path.resolve(path.dirname(f), s.source.value); imports.push(target);
    for (const sp of s.specifiers) importedFrom.set(sp.local.name, { mod: target, name: sp.imported ? sp.imported.name : 'default' });
  }
  const decls = new Map();   // name -> kind (function | let | const)
  for (const v of ms.variables) { const d = v.defs[0]; if (d.type === 'ImportBinding') continue; decls.set(v.name, d.type === 'FunctionName' ? 'function' : d.parent.kind); }
  mods.set(f, { f, ast, ms, imports, importedFrom, decls });
}
// eager references: identifiers evaluated at module top level (not inside a function), plus bodies of top-level functions called at top level (transitively)
function eagerRefs(m) {
  const out = []; const fnBodies = new Map();
  for (const s of m.ast.body) {
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    if (d && d.type === 'FunctionDeclaration') fnBodies.set(d.id.name, d);
    if (d && d.type === 'VariableDeclaration') for (const x of d.declarations) if (x.init && /Function/.test(x.init.type)) fnBodies.set(x.id.name, x.init);
  }
  const seenFn = new Set();
  const scan = (node, insideFnOk) => {
    walk.recursive(node, null, {
      Function(n, st, c) { if (insideFnOk) { for (const p of n.params) c(p, st); c(n.body, st); } },
      CallExpression(n, st, c) {
        if (n.callee.type === 'Identifier' && fnBodies.has(n.callee.name) && !seenFn.has(n.callee.name)) { seenFn.add(n.callee.name); scan(fnBodies.get(n.callee.name), true); }
        if (/Function/.test(n.callee.type)) scan(n.callee, true);   // IIFE
        c(n.callee, st); for (const a of n.arguments) c(a, st);
      },
      Identifier(n) { out.push(n.name); },
      MemberExpression(n, st, c) { c(n.object, st); if (n.computed) c(n.property, st); },
      Property(n, st, c) { if (n.computed) c(n.key, st); c(n.value, st); },
    });
  };
  for (const s of m.ast.body) {
    if (s.type === 'ImportDeclaration') continue;
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s;
    if (!d || d.type === 'FunctionDeclaration') continue;
    scan(d, false);
  }
  return out;
}
const done = new Set(), visiting = new Set(), order = [];
(function visit(f) { visiting.add(f); for (const t of mods.get(f).imports) if (!done.has(t) && !visiting.has(t)) visit(t); visiting.delete(f); done.add(f); order.push(f); })(path.join(ROOT, 'main.js'));
const at = new Map(order.map((f, i) => [f, i]));
let bad = 0;
for (const f of order) {
  const m = mods.get(f);
  for (const name of new Set(eagerRefs(m))) {
    const imp = m.importedFrom.get(name); if (!imp) continue;
    const t = mods.get(imp.mod); const kind = t && t.decls.get(imp.name);
    if (kind === 'function') continue;
    if (at.get(imp.mod) > at.get(f)) { bad++; console.log(`${path.relative(ROOT, f)} uses ${name} (${kind}) from ${path.relative(ROOT, imp.mod)} before it runs`); }
  }
}
console.log(bad ? `${bad} problem(s)` : 'evaluation order OK'); console.log('order:', order.map((f) => path.relative(ROOT, f)).join(' '));
process.exit(bad ? 1 : 0);
