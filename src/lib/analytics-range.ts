export type AnalyticsPeriod = "today";

function getZonedYmd(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: value("year"), month: value("month"), day: value("day") };
}

function addCalendarDay(year: number, month: number, day: number) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const num = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    let zonedHour = num("hour");
    if (zonedHour === 24) zonedHour = 0;
    const asUtc = Date.UTC(
      num("year"),
      num("month") - 1,
      num("day"),
      zonedHour,
      num("minute"),
      num("second")
    );
    return asUtc - instant;
  };
  const first = utcGuess - offsetAt(utcGuess);
  return new Date(utcGuess - offsetAt(first));
}

export function getAnalyticsPeriodRange(
  timeZone: string,
  period: AnalyticsPeriod = "today",
  now = new Date()
) {
  let tz = timeZone.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(now);
  } catch {
    tz = "UTC";
  }

  const ymd = getZonedYmd(now, tz);
  const start = zonedLocalToUtc(ymd.year, ymd.month, ymd.day, 0, 0, 0, tz);
  const next = addCalendarDay(ymd.year, ymd.month, ymd.day);
  const end = zonedLocalToUtc(next.year, next.month, next.day, 0, 0, 0, tz);

  return {
    start,
    end,
    label: period === "today" ? "Today" : period,
    timeZone: tz,
  };
}
