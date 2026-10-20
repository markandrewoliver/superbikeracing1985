/**
 * The cron reconcile, played against a scheduler that enforces Reddit's cap
 * of ten jobs per installation. `npm run sim:crons`.
 *
 * It exists for one case a dev install cannot show: an installation holding
 * ten jobs under OLD names. There, an add attempted before the cancels are done
 * is the eleventh and is refused. On dev the names already match, so each
 * cancel frees the slot its own add wants and an interleaved reconcile looks
 * perfect.
 *
 * It also walks a week of Eastern hours through `isDue`. **Mutation-test a
 * check here before believing it**: break the thing it guards and make sure it
 * goes red.
 */
import { planSync, type CronJobRow } from "../src/server/cron";
import { isDue, parseEt, wakeCron } from "../src/shared/schedule";

const LIMIT = 10;

class FakeScheduler {
  jobs: CronJobRow[];
  refused: string[] = [];
  private n = 0;
  constructor(seed: CronJobRow[]) {
    this.jobs = [...seed];
  }
  cancel(id: string) {
    const i = this.jobs.findIndex((j) => j.id === id);
    if (i < 0) throw new Error(`no job ${id}`);
    this.jobs.splice(i, 1);
  }
  run(name: string, cron: string) {
    if (this.jobs.length >= LIMIT) {
      this.refused.push(name);
      throw new Error("limit exceeded: cron actions");
    }
    this.jobs.push({ id: `j${++this.n}`, name, cron });
  }
}

/** As `syncCrons` does it: every cancel, then every add. The crons come from
 *  `planSync` — a sim that re-derives what it is checking checks itself. */
function apply(s: FakeScheduler, plan: Record<string, string>) {
  const want = planSync(plan, s.jobs);
  for (const c of want.cancel) s.cancel(c.id);
  for (const a of want.add) {
    try {
      s.run(a.name, a.cron);
    } catch {
      /* counted in s.refused */
    }
  }
  return want;
}

let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

/* planSync only plans tasks named in CRON_TASKS, so the sim uses that one name
   plus stale jobs. Ten stale jobs under old names, one wanted. */
const PLAN = { examplePost: "0 9 1" };
const STALE: CronJobRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: `old${i}`,
  name: `oldJob${i}`,
  cron: `0 ${i} * * *`,
}));

console.log("cron reconcile\n");
{
  const s = new FakeScheduler(STALE);
  apply(s, PLAN);
  check("a full installation ends on exactly the plan", s.jobs.length === 1, `${s.jobs.length} jobs`);
  check("nothing was refused by the cap", s.refused.length === 0, s.refused.join(", "));
  check(
    "the planned job runs on its derived wake cron",
    s.jobs[0]?.name === "examplePost" && s.jobs[0]?.cron === wakeCron(parseEt(PLAN.examplePost)!),
  );
}
{
  /* The control: fuse the two passes and it must lose jobs, or the check above
     is passing for the wrong reason. */
  const s = new FakeScheduler(STALE);
  const want = planSync(PLAN, s.jobs);
  for (const a of want.add) {
    try {
      s.run(a.name, a.cron);
    } catch {
      /* counted */
    }
    for (const c of want.cancel) s.cancel(c.id);
  }
  check("adding before cancelling really does hit the cap", s.refused.length > 0, "it did not");
}
{
  const s = new FakeScheduler([]);
  apply(s, PLAN);
  const again = apply(s, PLAN);
  check("a second reconcile changes nothing", again.cancel.length === 0 && again.add.length === 0);
}
{
  const s = new FakeScheduler([
    { id: "a", name: "examplePost", cron: "0 * * * *" },
    { id: "b", name: "examplePost", cron: "0 * * * *" },
  ]);
  apply(s, PLAN);
  check("duplicates collapse to one", s.jobs.filter((j) => j.name === "examplePost").length === 1);
}
{
  const s = new FakeScheduler([{ id: "a", name: "examplePost", cron: "0 * * * *" }]);
  apply(s, { examplePost: "" });
  check("an empty plan entry switches the job off", s.jobs.length === 0);
}

console.log("\nEastern gate\n");
{
  let hits = 0;
  for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) if (isDue("0 9 1", h, wd)) hits++;
  check('"0 9 1" is due exactly once a week', hits === 1, `${hits}`);
  let daily = 0;
  for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) if (isDue("30 7 *", h, wd)) daily++;
  check('"30 7 *" is due once a day', daily === 7, `${daily}`);
  check("an unreadable spec is never due", !isDue("nonsense", 9, 1));
  check("an empty spec is never due", !isDue("", 9, 1));
}

console.log(failed ? `\n${failed} check(s) failed ✗\n` : "\nall checks pass ✓\n");
process.exit(failed ? 1 : 0);
