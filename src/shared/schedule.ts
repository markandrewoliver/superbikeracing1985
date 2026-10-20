/**
 * Reading and writing the app's schedule, without a clock or a store.
 *
 * Shared because the moderator console has to say what a schedule *means* as it
 * is typed — three bare numbers were misread once, `"45 0 *"` entered for a
 * quarter to nine at night when it is a quarter to one in the morning, with
 * nothing on screen to catch it — and the server cannot answer a keystroke.
 * A copy in the client would be a second parser to disagree with the one that
 * decides whether a job actually runs, which is the drift this file prevents.
 *
 * `server/cron.ts` owns everything that touches Redis or the scheduler; this is
 * the pure half. See that file for why the schedule is Eastern at all.
 */

/** One parsed field: does this number match? `*` matches everything. */
function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    const step = part.split("/");
    const range = (step[0] ?? "").trim();
    const by = step.length > 1 ? Number(step[1]) : 1;
    if (!Number.isFinite(by) || by < 1) return false;
    let lo: number;
    let hi: number;
    if (range === "*") {
      lo = 0;
      hi = 59;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-");
      lo = Number(a);
      hi = Number(b);
    } else {
      lo = Number(range);
      hi = lo;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
    if (value < lo || value > hi) continue;
    if ((value - lo) % by === 0) return true;
  }
  return false;
}


/** `"minute hour weekday"`, Eastern. Absent fields are not a schedule. */
export type EtPlan = { minute: string; hour: string; weekday: string };

/**
 * Parse a plan entry. Returns null for anything that is not three fields,
 * which is how an unusable override is refused rather than half-applied.
 */
export function parseEt(spec: string): EtPlan | null {
  const f = spec.trim().split(/\s+/);
  if (f.length !== 3) return null;
  const [minute, hour, weekday] = f as [string, string, string];
  /* Each field has to match *something* in its own range, or a typo like `"0 25
     1"` would register a job that can never be due and say nothing. */
  const any = (field: string, lo: number, hi: number) => {
    for (let v = lo; v <= hi; v++) if (fieldMatches(field, v)) return true;
    return false;
  };
  if (!any(minute, 0, 59) || !any(hour, 0, 23) || !any(weekday, 0, 6)) return null;
  return { minute, hour, weekday };
}


/**
 * The cron this plan entry wakes on: its minute, every hour, every day.
 *
 * The hour and the weekday are deliberately **not** pushed into the cron. They
 * are Eastern and a cron is UTC, and translating them is the DST hack this
 * replaced — see the note at the top. Waking hourly and asking New York what
 * time it is costs 23 no-ops a day and cannot be wrong.
 */
export function wakeCron(et: EtPlan): string {
  return `${et.minute} * * * *`;
}


const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The schedule in words: `"45 0 *"` → `"12:45 AM, every day"`.
 *
 * **Because three bare numbers are ambiguous to read and were misread.** The
 * field order is minute-hour-weekday, so `"45 0 *"` is a quarter to one in the
 * morning — and it was entered expecting a quarter to nine at night, which the
 * box gave no way to notice. The console draws this beside the field, so the
 * answer is on screen before Save is pressed rather than in a log line an hour
 * later.
 *
 * Plain numbers get a real time; anything cleverer (a list, a range, a step) is
 * described in its own terms rather than expanded, because "9:00 AM, 5:00 PM
 * and 1:00 AM on Monday, Wednesday" is harder to check than what was typed.
 */
export function describeEt(spec: string): string {
  const et = parseEt(spec);
  if (!et) return "not a schedule";
  const plain = (f: string) => (/^\d+$/.test(f) ? Number(f) : null);
  const h = plain(et.hour);
  const m = plain(et.minute);
  const time =
    h !== null && m !== null
      ? `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
      : `minute ${et.minute} of hour ${et.hour}`;
  const day =
    et.weekday === "*"
      ? "every day"
      : /^[0-6](,[0-6])*$/.test(et.weekday)
        ? et.weekday.split(",").map((d) => DAYS[Number(d)]).join(" and ")
        : `weekday ${et.weekday}`;
  return `${time}, ${day}`;
}


/**
 * Does this schedule cover this Eastern hour and weekday?
 *
 * Pure, and exported, so the gate can be checked without a Redis read or a
 * clock — `npm run sim:crons` walks every hour of a week against it. An
 * unreadable or empty spec is **never** due: a plan nobody can parse should
 * stop a post rather than fire one at a time nobody chose.
 */
export function isDue(spec: string, hour: number, weekday: number): boolean {
  const et = parseEt(spec);
  if (!et) return false;
  return fieldMatches(et.hour, hour) && fieldMatches(et.weekday, weekday);
}


/**
 * The first item in bank order that is not in `done`.
 *
 * **Pure, and shared with `npm run sim:crons`, because a sim that
 * reimplements the rule it is checking checks itself.** That is not
 * hypothetical here: the cron reconcile had exactly that shape, its sim
 * derived a value the executor was supposed to derive, and a real install
 * refused every registration while the sim stayed green.
 *
 * By id rather than by position, which is what makes a bank safe to edit: a
 * set inserted mid-bank shifts nothing, and one removed and restored is simply
 * unposted again.
 */
export function firstUnposted<T>(
  bank: readonly T[],
  idOf: (item: T) => string,
  done: ReadonlySet<string>,
): T | null {
  return bank.find((item) => !done.has(idOf(item))) ?? null;
}
