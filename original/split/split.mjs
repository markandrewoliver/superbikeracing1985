// Splits the single-file Super Bike Racing 1985 into ES modules.
// usage: node split.mjs <original.html> <outDir> [--analyze]
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import * as eslintScope from 'eslint-scope';
import MagicString from 'magic-string';
import { RANGES, OVERRIDES, NAME_OVERRIDES, GROUPS, HEADERS, PRE_EDITS, KEEP_LEAD } from './config.mjs';

const [, , SRC, OUT, FLAG] = process.argv;
const analyzeOnly = FLAG === '--analyze';
const fileLines = fs.readFileSync(SRC, 'utf8').split('\n');
const FIRST = 62, LAST = 4957;                       // the script body, inside the IIFE
const OFF = FIRST - 1;
let body = fileLines.slice(FIRST - 1, LAST).join('\n');

/* ---------- 1. pre-edits: exact, unique string replacements ---------- */
// lineMap[i] = original file line of line i+1 of the edited body
let lineMap = body.split('\n').map((_, i) => i + FIRST);
for (const [from, to, count = 1] of PRE_EDITS) {
  const n = body.split(from).length - 1;
  if (n !== count) throw new Error(`pre-edit expected ${count} match(es), found ${n}: ${from.slice(0, 80)}`);
  let at = 0;
  for (let k = 0; k < n; k++) {
    const pos = body.indexOf(from, at);
    const L = body.slice(0, pos).split('\n').length - 1;
    const a = from.split('\n').length, b = to.split('\n').length;
    lineMap.splice(L, a, ...Array(b).fill(lineMap[L]));
    body = body.slice(0, pos) + to + body.slice(pos + from.length);
    at = pos + to.length;
  }
}

/* ---------- 2. parse + scopes ---------- */
const ast = acorn.parse(body, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const modScope = sm.scopes.find((s) => s.type === 'module');
const lineOf = (node) => lineMap[node.loc.start.line - 1];   // original file line numbers

/* ---------- 3. statements -> modules ---------- */
const ranges = [...RANGES].sort((a, b) => a[0] - b[0]);
function moduleFor(stmt) {
  const ln = lineOf(stmt);
  if (OVERRIDES[ln]) return OVERRIDES[ln];
  const declName = stmt.type === 'FunctionDeclaration' ? stmt.id.name : null;
  if (declName && NAME_OVERRIDES[declName]) return NAME_OVERRIDES[declName];
  let m = null;
  for (const [start, mod] of ranges) if (start <= ln) m = mod;
  if (!m) throw new Error('no module for line ' + ln);
  return m;
}
// chunk boundaries: each statement takes the comments/blank lines before it, and its own trailing line comment
const stmts = ast.body;
const chunkStart = [];
for (let i = 0; i < stmts.length; i++) {
  if (i === 0) { chunkStart.push(0); continue; }
  const prev = stmts[i - 1], cur = stmts[i];
  if (prev.loc.end.line === cur.loc.start.line) { chunkStart.push(cur.start); continue; }
  const nl = body.indexOf('\n', prev.end);
  chunkStart.push(nl < 0 ? prev.end : nl + 1);
}
const chunkEnd = (i) => (i + 1 < stmts.length ? chunkStart[i + 1] : body.length);
const stmtModule = stmts.map(moduleFor);

// top-level binding -> module
const topVars = new Map();                      // name -> { v, module, kind, stmtIndex }
for (const v of modScope.variables) {
  const def = v.defs[0];
  const node = def.node.type === 'VariableDeclarator' ? def.parent : def.node;
  const idx = stmts.indexOf(node);
  if (idx < 0) throw new Error('top-level def not a statement: ' + v.name);
  topVars.set(v.name, { v, module: stmtModule[idx], kind: def.type === 'FunctionName' ? 'function' : def.parent.kind, idx });
}
const stmtIndexOfPos = (pos) => { let lo = 0, hi = stmts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (chunkStart[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
const moduleOfPos = (pos) => stmtModule[stmtIndexOfPos(pos)];

/* ---------- 4. which bindings are written from another module ---------- */
const crossWritten = new Map();
for (const [name, t] of topVars) {
  for (const r of t.v.references) {
    if (r.isWrite() && !r.init && moduleOfPos(r.identifier.start) !== t.module) {
      if (!crossWritten.has(name)) crossWritten.set(name, new Set());
      crossWritten.get(name).add(moduleOfPos(r.identifier.start));
    }
  }
}
const groupOf = new Map();
for (const [g, names] of Object.entries(GROUPS)) for (const n of names) groupOf.set(n, g);
const ungrouped = [...crossWritten.keys()].filter((n) => !groupOf.has(n));
if (analyzeOnly || ungrouped.length) {
  const sizes = {};
  stmts.forEach((s, i) => { const m = stmtModule[i]; sizes[m] = (sizes[m] || 0) + body.slice(chunkStart[i], chunkEnd(i)).split('\n').length - 1; });
  console.log('module sizes (lines):'); for (const [m, n] of Object.entries(sizes).sort()) console.log('  ', m.padEnd(28), n);
  console.log('cross-written:'); for (const [n, ms] of crossWritten) console.log('  ', n.padEnd(14), topVars.get(n).module.padEnd(24), '<-', [...ms].join(', '), groupOf.has(n) ? ' [' + groupOf.get(n) + ']' : ' UNGROUPED');
  if (ungrouped.length) { console.error('ungrouped cross-module writes: ' + ungrouped.join(' ')); process.exit(1); }
  if (analyzeOnly) process.exit(0);
}
for (const n of groupOf.keys()) {
  const t = topVars.get(n);
  if (!t) throw new Error('grouped name not found: ' + n);
  if (t.kind !== 'let') throw new Error('grouped name is not a let: ' + n);
}

/* ---------- 5. rewrite ---------- */
const ms = new MagicString(body);
// 5a. grouped references -> group.name
const shorthandIds = new Set();
walk.full(ast, (n) => { if (n.type === 'Property' && n.shorthand) shorthandIds.add(n.value); });
for (const [name, g] of groupOf) {
  const t = topVars.get(name);
  for (const r of t.v.references) {
    const id = r.identifier;
    if (r.init) continue;                         // the declaration itself is handled below
    if (shorthandIds.has(id)) ms.overwrite(id.start, id.end, `${name}: ${g}.${name}`);
    else ms.overwrite(id.start, id.end, `${g}.${name}`);
  }
}
// 5b. declarations: grouped declarators become assignments; exported ones get `export`
const usedBy = new Map();                       // name -> Set(modules that reference it)
for (const [name, t] of topVars) {
  const s = new Set();
  for (const r of t.v.references) s.add(moduleOfPos(r.identifier.start));
  usedBy.set(name, s);
}
const isExported = (name) => { const t = topVars.get(name); return !groupOf.has(name) && [...usedBy.get(name)].some((m) => m !== t.module); };
for (const s of stmts) {
  if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') {
    if (isExported(s.id.name)) ms.prependRight(s.start, 'export ');
    continue;
  }
  if (s.type !== 'VariableDeclaration') continue;
  const ds = s.declarations;
  const grouped = ds.map((d) => d.id.type === 'Identifier' && groupOf.has(d.id.name));
  const exp = ds.some((d) => d.id.type === 'Identifier' && isExported(d.id.name));
  if (!grouped.some(Boolean)) { if (exp) ms.prependRight(s.start, 'export '); continue; }
  const kw = (i) => (grouped[i] ? '' : (exp ? 'export ' : '') + s.kind + ' ');
  ms.overwrite(s.start, ds[0].start, kw(0));
  ds.forEach((d, i) => {
    if (grouped[i]) {
      const g = groupOf.get(d.id.name);
      ms.overwrite(d.id.start, d.id.end, `${g}.${d.id.name}`);
      if (!d.init) ms.appendLeft(d.id.end, ' = undefined');
    }
    if (i + 1 < ds.length) ms.overwrite(d.end, ds[i + 1].start, '; ' + kw(i + 1));
  });
}
// 5c. embedded PNGs -> png('<name>')
const assets = [];
walk.ancestor(ast, {
  Literal(node, _st, anc) {
    if (typeof node.value !== 'string' || !node.value.startsWith('data:image/png;base64,')) return;
    const segs = [];
    for (let i = 0; i < anc.length - 1; i++) {
      const a = anc[i], child = anc[i + 1];
      if (a.type === 'VariableDeclarator') segs.push(a.id.name);
      else if (a.type === 'Property' && child === a.value) segs.push(a.key.type === 'Identifier' ? a.key.name : String(a.key.value));
      else if (a.type === 'ArrayExpression') {
        const named = child.type === 'ObjectExpression' && child.properties.find((p) => p.key && (p.key.name === 'name' || p.key.value === 'name') && p.value.type === 'Literal');
        segs.push(named ? named.value.value : String(a.elements.indexOf(child)));
      }
    }
    const clean = segs.map((x) => x.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_|_$/g, ''));
    const name = clean[0].toLowerCase().replace(/_/g, '-') + '/' + clean.slice(1).join('-');
    if (assets.some((a) => a.name === name)) throw new Error('duplicate asset name ' + name);
    assets.push({ name, data: node.value.slice('data:image/png;base64,'.length) });
    ms.overwrite(node.start, node.end, `png('${name}')`);
  },
});

/* ---------- 6. emit modules ---------- */
const modules = new Map();                      // module -> [chunk text...]
let carry = '';
stmts.forEach((s, i) => {
  const m = stmtModule[i];
  if (!modules.has(m)) modules.set(m, []);
  let text = ms.slice(chunkStart[i], chunkEnd(i));
  if (KEEP_LEAD.has(lineOf(s))) {               // its comment describes the code around it, not the data: leave it there
    const lineStart = body.lastIndexOf('\n', s.start - 1) + 1;
    carry += ms.slice(chunkStart[i], lineStart); text = ms.slice(lineStart, chunkEnd(i));
  } else if (carry && m !== OVERRIDES[lineOf(s)]) { text = carry + text; carry = ''; }
  modules.get(m).push(text);
});
const rel = (from, to) => { let r = path.posix.relative(path.posix.dirname(from), to); if (!r.startsWith('.')) r = './' + r; return r; };
const usesPng = new Set();
for (const a of assets) usesPng.add(null);
fs.rmSync(OUT, { recursive: true, force: true });
for (const [m, chunks] of modules) {
  let code = chunks.join('').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
  // imports: top-level names this module references that live elsewhere
  const need = new Map();                       // module -> Set(names)
  const groupsUsed = new Set();
  for (const [name, t] of topVars) {
    if (t.module === m) continue;
    if (!usedBy.get(name).has(m)) continue;
    if (groupOf.has(name)) { groupsUsed.add(groupOf.get(name)); continue; }
    if (!need.has(t.module)) need.set(t.module, new Set());
    need.get(t.module).add(name);
  }
  for (const [name, g] of groupOf) if (topVars.get(name).module === m) groupsUsed.add(g);
  const imports = [];
  if (groupsUsed.size && m !== 'core/state.js') {
    if (!need.has('core/state.js')) need.set('core/state.js', new Set());
    for (const g of groupsUsed) need.get('core/state.js').add(g);
  }
  if (/\bpng\('/.test(code)) imports.push(`import { png } from '${rel(m, 'art/assets.js')}';`);
  const fromAssets = ['assetsReady', 'loadImg'].filter((n) => new RegExp('\\b' + n + '\\(').test(code));
  if (fromAssets.length) imports.push(`import { ${fromAssets.join(', ')} } from '${rel(m, 'art/assets.js')}';`);
  for (const [from, names] of [...need].sort((a, b) => a[0].localeCompare(b[0]))) {
    imports.push(`import { ${[...names].sort().join(', ')} } from '${rel(m, from)}';`);
  }
  if (m === 'main.js') {                        // every module, in the original's order, so all of them run, and in that order
    const order = [];
    stmts.forEach((_, i) => { if (!order.includes(stmtModule[i]) && stmtModule[i] !== 'main.js') order.push(stmtModule[i]); });
    imports.unshift(...order.map((o) => `import '${rel(m, o)}';`), '');
  }
  const header = HEADERS[m] ? HEADERS[m].trim() + '\n\n' : '';
  const out = header + (imports.length ? imports.join('\n') + '\n\n' : '') + code;
  const file = path.join(OUT, m);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
}
for (const a of assets) {
  const file = path.join(OUT, 'assets', a.name + '.png');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(a.data, 'base64'));
}
fs.writeFileSync(path.join(OUT, '.split-report.json'), JSON.stringify({
  modules: [...modules.keys()], assets: assets.length,
  groups: Object.fromEntries(Object.entries(GROUPS).map(([g, n]) => [g, n])),
}, null, 2));
console.log(`wrote ${modules.size} modules, ${assets.length} PNGs`);
