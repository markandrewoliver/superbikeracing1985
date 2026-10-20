import { redis, scheduler } from "@devvit/web/server";
import { easternNow } from "./time";
import { describeEt, isDue, parseEt, wakeCron, type EtPlan } from "../shared/schedule";

/* Re-exported so callers have one import for "the schedule", and because the
   split is about the client bundle rather than about these being two ideas. */
export { describeEt, isDue, parseEt, wakeCron, type EtPlan };

/**
 * The recurring schedule, registered at runtime instead of declared in
 * `devvit.json`. See docs/04-devvit-platform.md → Scheduler.
 *
 * **Why: a cron in `devvit.json` can only be changed by shipping a version, and
 * a version can only reach production by being approved.** Reddit approves apps
 * per version, so moving a post from 9am to 10am means an upload, a review and
 * an install — days, for a string. A cron registered through
 * `scheduler.runJob({name, cron})` is installation state, so it is a Redis
 * write and a reconcile away. `devvit.json` still *declares* each task — the
 * name is how an endpoint is found — it just does not say when.
 *
 * **Never also put a `cron` on the task in `devvit.json`.** That is the
 * obvious-looking fix for "the schedule is not running", and it makes every
 * post go out twice.
 *
 * ## The schedule is stated in Eastern time
 *
 * The plan is `"minute hour weekday"`, read in `America/New_York`, and it is
 * the only statement of when anything happens. The wake cron is *derived*:
 * `"<minute> * * * *"`, every hour, and each handler asks `dueNow(task)`.
 * **No handler may test the clock itself** — a literal `hour !== 9` left in a
 * handler means the cron decides when a job *wakes* and the literal decides
 * when it *acts*, and moving a job still needs a version.
 *
 * Waking hourly also deletes the DST problem rather than working around it: 9am
 * Eastern is 13:00 UTC in summer and 14:00 in winter, and asking New York the
 * time is right on both sides and on the two strange days, for 23 no-op
 * invocations a day per job.
 *
 * ## Reconcile, never register
 *
 * `syncCrons` reads what the installation holds and makes it match the plan.
 * A version install **keeps** the previous version's jobs (measured), so a
 * blind register doubles every job. It runs from `onAppInstall` /
 * `onAppUpgrade` and can be run again any time.
 *
 * **One-off jobs are never touched**: the filter is "has a `cron`", not a name
 * list, because a name list is a thing to forget.
 */

/**
 * Redis: the overrides, name → `"minute hour weekday"` Eastern. An absent name
 * takes the shipped default. If the *meaning* of a stored value ever changes,
 * bump the version in the key rather than reading old rows forward.
 */
const PLAN_KEY = "cron:plan:v1";

/**
 * Every task name this app may put on a clock.
 *
 * It is the full set rather than the scheduled subset, so an override can be
 * validated by name: a `runJob` naming a task `devvit.json` does not declare
 * registers a job pointing at no endpoint, which fires and 404s for ever with
 * nothing on any screen saying so. `npm run check:crons` holds this list to the
 * manifest's own, in both directions.
 */
export const CRON_TASKS = ["examplePost"] as const;

export type CronTask = (typeof CRON_TASKS)[number];

/**
 * The schedule as shipped: `"minute hour weekday"`, **Eastern**.
 *
 * Each field is a cron field: a star, a number, a comma list, a range (`9-17`)
 * or a step (`star-slash-2`, spelled out here because the two characters would
 * close this comment). Weekday is 0=Sunday. `"0 9 1"` is 9:00 AM Monday in New
 * York, all year, whatever UTC happens to be doing.
 *
 * **This is a default, not the truth.** The truth is this merged with whatever
 * anything has written into the plan key via `setPlanEntry`.
 */
export const CRON_PLAN: Record<CronTask, string> = {
  /* Off by default ("" = off): a template should not start posting to a
     subreddit the moment it is installed. Set it with setPlanEntry, or here. */
  examplePost: "",
};

/**
 * The schedule this installation should be running.
 *
 * An override of `""` is how a task is turned **off** — it is kept as an empty
 * string rather than deleted, because a deleted row is indistinguishable from
 * one that was never written and would fall straight back to the default. A
 * task with no cron at all is still declared and still bookable; it simply has
 * no clock.
 */
export async function readPlan(): Promise<Record<string, string>> {
  const plan: Record<string, string> = { ...CRON_PLAN };
  let over: Record<string, string> = {};
  try {
    over = (await redis.hGetAll(PLAN_KEY)) ?? {};
  } catch (err) {
    /* A plan we cannot read is not a reason to unschedule the app. The shipped
       defaults are the honest fallback, and the failure is loud. */
    console.error(`[cron] override read failed, using defaults: ${String(err)}`);
    return plan;
  }
  for (const [name, cron] of Object.entries(over)) {
    if (!CRON_TASKS.includes(name as CronTask)) {
      console.error(`[cron] override for unknown task "${name}" ignored`);
      continue;
    }
    if (cron !== "" && !parseEt(cron)) {
      console.error(`[cron] override for "${name}" is not a "minute hour weekday", ignored: ${cron}`);
      continue;
    }
    plan[name] = cron;
  }
  return plan;
}

/**
 * Write or clear an override.
 *
 * `cron` of `null` removes the row, which returns that task to the shipped
 * default; `""` turns it off. Validated here as well as on read, because a bad
 * expression that is merely ignored on read is one somebody has to notice is
 * being ignored.
 */
export async function setPlanEntry(name: string, cron: string | null): Promise<void> {
  if (!CRON_TASKS.includes(name as CronTask)) throw new Error(`unknown task "${name}"`);
  if (cron === null) {
    await redis.hDel(PLAN_KEY, [name]);
    return;
  }
  if (cron !== "" && !parseEt(cron))
    throw new Error(`not a "minute hour weekday" schedule: "${cron}"`);
  await redis.hSet(PLAN_KEY, { [name]: cron });
}

/** One cron job as the scheduler reports it, reduced to what a plan needs. */
export type CronJobRow = { id: string; name: string; cron: string };

/** What a reconcile has decided to do, before any of it is done. */
export type CronActions = {
  /** Job ids to cancel, in order. */
  cancel: { id: string; name: string }[];
  /**
   * What to register afterwards, **expression included**.
   *
   * The cron is decided here rather than by the caller because it once was
   * not: the Eastern `"0 7 *"` went straight to `runJob`, which wants five
   * fields, and every registration was refused — an app with no schedule.
   */
  add: { name: string; cron: string }[];
  kept: string[];
  removed: string[];
  running: Record<string, string>;
};

/**
 * Decide what to change. Pure, so the one property that matters can be checked
 * without a scheduler: **everything to cancel is decided before anything is
 * added**, and the caller runs the two lists in that order.
 *
 * That ordering is not tidiness. Reddit caps an installation at ten cron jobs.
 * An installation holding ten under *old* names, none in the plan, refuses an
 * add attempted before the cancels — the eleventh. **A dev install cannot show
 * this**: its jobs already carry the planned names, so each cancel frees the
 * slot its own add wants and the interleaved version looks perfect.
 */
export function planSync(plan: Record<string, string>, jobs: CronJobRow[]): CronActions {
  const existing = new Map<string, CronJobRow[]>();
  for (const j of jobs) {
    const list = existing.get(j.name) ?? [];
    list.push(j);
    existing.set(j.name, list);
  }

  const out: CronActions = { cancel: [], add: [], kept: [], removed: [], running: {} };
  for (const name of new Set([...Object.keys(plan), ...existing.keys()])) {
    /* A name the plan has never heard of is a job from an older version of this
       app. It wants cancelling, not keeping. */
    /* The plan is Eastern; what the scheduler holds is a cron. Compare like
       with like — two different Eastern schedules can share a wake cron (only
       the minute reaches it), and re-registering an identical job for a change
       that does not affect it would be churn on every save. */
    const et = CRON_TASKS.includes(name as CronTask) ? parseEt(plan[name] ?? "") : null;
    const want = et ? wakeCron(et) : "";
    const have = existing.get(name) ?? [];

    /* **Exactly one job with exactly the right expression, or start again.**
       Duplicates are the case that matters — two jobs of one name both fire, so
       the post goes out twice — and they cannot be told from one correct job
       except by counting. */
    if (want && have.length === 1 && have[0]!.cron === want) {
      out.kept.push(name);
      /* **The Eastern schedule, not the wake cron.** This field said one or the
         other depending on whether a job had just been re-registered, so one
         log line carried both `"0 * * * *"` and `"45 0 *"` under the same key
         — unreadable at exactly the moment somebody is reading it to find out
         why a job did not fire. */
      out.running[name] = plan[name] ?? want;
      continue;
    }
    for (const j of have) out.cancel.push({ id: j.id, name });
    if (have.length) out.removed.push(name);
    if (want) out.add.push({ name, cron: want });
  }
  return out;
}

export type CronSync = {
  /** name → expression, as it now stands. */
  running: Record<string, string>;
  kept: string[];
  added: string[];
  removed: string[];
  /** Names whose reconcile threw. They are left alone rather than half-done. */
  failed: string[];
};

/**
 * Make the installation's cron jobs match the plan. Safe to call at any time,
 * any number of times.
 *
 * The per-name rule: **exactly one job, with exactly the right expression, or
 * start again.** Duplicates are the case that matters — two jobs with the same
 * name and the same cron both fire, so a post goes out twice — and they cannot
 * be told apart from one correct job except by counting.
 *
 * **A cancel that fails stops that name there.** The alternative is registering
 * a replacement beside a job we could not remove, which is the duplicate this
 * function exists to prevent, arrived at by trying to prevent it.
 */
export async function syncCrons(): Promise<CronSync> {
  const plan = await readPlan();
  const jobs = await scheduler.listJobs();

  /* Cron jobs only. A one-off has a `runAt`; see the note at the top about why
     this is a shape test and not a name list. */
  const rows: CronJobRow[] = [];
  for (const j of jobs) {
    if (!("cron" in j) || !j.cron) continue;
    rows.push({ id: j.id, name: j.name, cron: j.cron });
  }

  const want = planSync(plan, rows);
  const out: CronSync = {
    running: { ...want.running },
    kept: want.kept,
    added: [],
    removed: want.removed,
    failed: [],
  };

  /* Cancels first, all of them — see `planSync`. */
  const blocked = new Set<string>();
  for (const j of want.cancel) {
    try {
      await scheduler.cancelJob(j.id);
    } catch (err) {
      /* **A name whose cancel failed is not registered.** The alternative is a
         replacement beside a job we could not remove, which is the duplicate
         this function exists to prevent, arrived at by trying to prevent it. */
      blocked.add(j.name);
      console.error(`[cron] could not cancel ${j.name} (${j.id}): ${String(err)}`);
    }
  }
  for (const name of blocked) {
    out.failed.push(name);
    out.removed = out.removed.filter((n) => n !== name);
    const still = rows.find((r) => r.name === name);
    /* Report what is still up, so the console shows the job rather than an
       empty row for a task that is in fact still firing. */
    if (still) out.running[name] = still.cron;
  }

  for (const { name, cron } of want.add) {
    if (blocked.has(name)) continue;
    try {
      await scheduler.runJob({ name, cron });
      out.added.push(name);
      out.running[name] = plan[name] ?? cron;
    } catch (err) {
      out.failed.push(name);
      console.error(`[cron] could not register ${name} "${cron}": ${String(err)}`);
    }
  }

  console.log(`[cron] sync ${JSON.stringify(out)}`);
  return out;
}

/**
 * Is this task due right now, in New York?
 *
 * **Every scheduled handler asks this instead of testing an hour itself**, and
 * that is the whole of what makes the schedule editable. That includes helpers
 * a gated job calls: a literal in one of those overrides the plan, and the only
 * symptom is posts quietly stopping.
 *
 * The **minute is not checked**, on purpose. It is already in the wake cron, so
 * it has been matched by the time anything calls this; re-testing it would only
 * add a way to fail, because an invocation that arrives a minute late is a
 * normal thing for a scheduler to do and would silently skip the day's post.
 * Hour and weekday are the whole gate.
 *
 * A task with no usable schedule is **not** due. That is the conservative
 * direction: a plan nobody can read should stop a post rather than fire one at
 * a time nobody chose.
 */
export async function dueNow(task: CronTask): Promise<{ ok: boolean; reason?: string }> {
  const plan = await readPlan();
  const spec = plan[task] ?? "";
  const now = easternNow();
  const where = `ET ${now.date} ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")} weekday ${now.weekday}`;
  if (!spec) return { ok: false, reason: `${task} is switched off (${where})` };
  const et = parseEt(spec);
  if (!et) return { ok: false, reason: `${task} has an unreadable schedule "${spec}" (${where})` };
  if (!isDue(spec, now.hour, now.weekday)) {
    return { ok: false, reason: `${task} wants "${spec}" ET, now is ${where}` };
  }
  return { ok: true };
}
