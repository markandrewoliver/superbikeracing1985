/**
 * US Eastern time — the one clock the app runs on.
 *
 * Every schedule, day boundary and displayed date goes through here. A
 * timezone spelled out in three places is a timezone the app can disagree with
 * itself about in three places. Change `EASTERN` if your game lives elsewhere.
 *
 * A named zone rather than a fixed offset on purpose: it observes DST, which is
 * what lets the scheduler wake hourly and ask "is it 9 in New York?".
 */
const EASTERN = "America/New_York";

/** YYYY-MM-DD for a moment in Eastern time. */
export function etDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/**
 * The same, for a stored publish timestamp. Falls back to the raw date part
 * when it cannot be parsed, so a malformed row still shows something sane
 * rather than "Invalid Date".
 */
export function etDateOf(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return etDate(ms);
}

/** Current hour (0-23), minute (0-59), date (YYYY-MM-DD) and weekday in Eastern. */
export function easternNow(): {
  hour: number;
  minute: number;
  date: string;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    // 0 = Sunday. -1 if the runtime's short names ever differ from the above,
    // which the callers read as "not the day I wanted" rather than a wrong day.
    weekday: DAYS.indexOf(get("weekday")),
  };
}

/** Today's date in Eastern time — the same clock every schedule reads. */
export function easternToday(): string {
  return easternNow().date;
}

/**
 * The Sunday that starts the week a given Eastern date falls in, as YYYY-MM-DD.
 *
 * Pure date arithmetic in UTC on an already-Eastern date string, so DST never
 * enters into it. Adding hours to a real instant would move the answer twice a
 * year.
 */
export function weekStart(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return date;
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/**
 * Whole days from one ET date string to another, `b - a`.
 *
 * Pure date arithmetic in UTC on dates that have already had their timezone
 * resolved — the same reason `weekStart` works that way, and the reason adding
 * hours to a real instant would move the answer twice a year.
 *
 * Infinity for anything unparseable, so a caller comparing against a gap reads
 * a broken record as "long enough ago" rather than as "just now".
 */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Noon Eastern on a given ET date, as a UTC timestamp.
 *
 * Built by correction rather than by assuming an offset: start from noon *UTC*
 * on that date, ask what hour that is in Eastern, and shift by the difference.
 * ET is behind UTC, so the guess always lands the same ET date in the morning,
 * and one correction is exact on both sides of a DST change. The second pass is
 * belt and braces for the two days a year when the shift itself crosses the
 * transition.
 */
export function etNoon(date: string): number {
  const hourAt = (ms: number) =>
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: EASTERN,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date(ms)),
    );
  let t = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(t)) return Number.NaN;
  t += (12 - hourAt(t)) * 3_600_000;
  const drift = 12 - hourAt(t);
  if (drift !== 0) t += drift * 3_600_000;
  return t;
}

/**
 * The first noon Eastern at or after `ms` — when a post whose day ends at `ms`
 * should be reported on.
 *
 * **"At or after", not "on the day it ends".** An event that ends at 8 AM is
 * reported at noon the same day; one that ends at 4 PM is still being played at
 * midday, so it waits for the next. That asymmetry is the whole reason this is a
 * function rather than a date.
 */
export function noonAfter(ms: number): number {
  const today = etNoon(etDate(ms));
  if (Number.isFinite(today) && today > ms) return today;
  /* Tomorrow's ET date, by arithmetic on the date string rather than on the
     instant — adding 24h to a real moment is wrong twice a year. */
  const next = new Date(Date.parse(`${etDate(ms)}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return etNoon(next);
}
