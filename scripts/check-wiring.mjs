#!/usr/bin/env node
/**
 * Is everything devvit.json names actually wired up? `npm run check`.
 *
 * Every failure this catches is silent in production: nothing type-checks it,
 * the preview cannot reach it, and the symptom is a menu press that shows
 * Reddit's own "Something went wrong" or a scheduled post that never goes out.
 *
 *  1. **Post kinds.** Each entry in `POST_KINDS` names a `formName`; that name
 *     needs a line in devvit.json → `forms`, and that path needs a `router.post`.
 *  2. **The menu is one row.** Menu rows are addressed by index; see postKinds.ts.
 *  3. **Scheduler tasks.** `CRON_TASKS` in cron.ts and devvit.json → scheduler
 *     must name the same tasks, each with a route — and **no manifest task may
 *     carry a `cron`**, because the runtime reconcile registers one too and the
 *     job then fires twice.
 *  4. **Triggers** point at routes that exist.
 *
 * Read as text rather than imported, so it runs in a second without booting
 * the server.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, "devvit.json"), "utf8"));
const read = (p) => readFileSync(join(root, p), "utf8");

const routes = new Set();
const routeDir = join(root, "src/server/routes");
for (const f of readdirSync(routeDir).filter((f) => f.endsWith(".ts"))) {
  for (const m of read(`src/server/routes/${f}`).matchAll(/router\.post\(\s*["'`]([^"'`]+)["'`]/g)) {
    routes.add(m[1]);
  }
}

const problems = [];

/* 1. post kinds */
const forms = manifest.forms ?? {};
const kindsSrc = read("src/server/postKinds.ts");
const kinds = [...kindsSrc.matchAll(/value:\s*"([^"]+)",[\s\S]*?formName:\s*"([^"]+)"/g)].map(
  ([, value, formName]) => ({ value, formName }),
);
if (!kinds.length) problems.push("found no POST_KINDS entries — has postKinds.ts been reshaped?");
for (const k of kinds) {
  const path = forms[k.formName];
  if (!path) problems.push(`kind ${k.value}: formName "${k.formName}" has no entry in devvit.json → forms`);
  else if (!routes.has(path)) problems.push(`kind ${k.value}: form ${k.formName} → ${path}, but no router.post for it`);
}
const offered = new Set(kinds.map((k) => k.formName));
for (const [name, path] of Object.entries(forms)) {
  if (!routes.has(path)) problems.push(`form ${name} → ${path}, but no router.post for it`);
  if (name !== "chooseKind" && !offered.has(name)) {
    problems.push(`form ${name} is declared in devvit.json but no POST_KINDS entry offers it`);
  }
}

/* 2. one menu row */
const items = manifest.menu?.items ?? [];
if (items.length !== 1) {
  problems.push(
    `devvit.json → menu.items has ${items.length} rows. Keep it at one: rows are addressed by index and clients cache the list (see postKinds.ts).`,
  );
}
for (const it of items) {
  if (!routes.has(it.endpoint)) problems.push(`menu row "${it.label}" → ${it.endpoint}, but no router.post for it`);
}

/* 3. scheduler */
const cronSrc = read("src/server/cron.ts");
const listM = cronSrc.match(/CRON_TASKS = \[([^\]]*)\]/);
const cronTasks = listM ? [...listM[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
const tasks = manifest.scheduler?.tasks ?? {};
for (const [name, t] of Object.entries(tasks)) {
  if (t.cron) {
    problems.push(
      `scheduler task ${name} has a "cron" in devvit.json. Remove it: the schedule lives in cron.ts and a manifest cron makes the job fire twice.`,
    );
  }
  if (!routes.has(t.endpoint)) problems.push(`scheduler task ${name} → ${t.endpoint}, but no router.post for it`);
  if (!cronTasks.includes(name)) problems.push(`scheduler task ${name} is not in CRON_TASKS (cron.ts)`);
}
for (const name of cronTasks) {
  if (!tasks[name]) problems.push(`CRON_TASKS names ${name}, which devvit.json → scheduler.tasks does not declare`);
}

/* 4. triggers */
for (const [event, path] of Object.entries(manifest.triggers ?? {})) {
  if (!routes.has(path)) problems.push(`trigger ${event} → ${path}, but no router.post for it`);
}
for (const required of ["onPostDelete", "onCommentDelete"]) {
  if (!manifest.triggers?.[required]) {
    problems.push(`no ${required} trigger: the Devvit Rules require deleting related content (see deletions.ts)`);
  }
}

if (problems.length) {
  console.error(`\ncheck:wiring — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}
console.log(
  `check:wiring ✓  ${kinds.length} post kind(s), ${items.length} menu row, ${Object.keys(tasks).length} scheduled task(s), ${Object.keys(manifest.triggers ?? {}).length} trigger(s)`,
);
