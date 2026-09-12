export type AnalyticsPeriod = "today" | "yesterday" | "last7days" | "last30days";

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

function shiftCalendarDays(year: number, month: number, day: number, delta: number) {
  const next = new Date(Date.UTC(year, month - 1, day + delta));
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

export type AnalyticsPeriodResult = {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  comparisonLabel: string;
  timeZone: string;
  period: AnalyticsPeriod;
};

export function getAnalyticsPeriodRange(
  timeZone: string,
  period: AnalyticsPeriod = "today",
  now = new Date()
): AnalyticsPeriodResult {
  let tz = timeZone.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(now);
  } catch {
    tz = "UTC";
  }

  const ymd = getZonedYmd(now, tz);

  if (period === "yesterday") {
    const yDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -1);
    const start = zonedLocalToUtc(yDay.year, yDay.month, yDay.day, 0, 0, 0, tz);
    const end = zonedLocalToUtc(ymd.year, ymd.month, ymd.day, 0, 0, 0, tz);

    const prevDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -2);
    const prevStart = zonedLocalToUtc(prevDay.year, prevDay.month, prevDay.day, 0, 0, 0, tz);
    const prevEnd = start;

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: "Yesterday",
      comparisonLabel: "Day Before Yesterday",
      timeZone: tz,
      period,
    };
  }

  if (period === "last7days") {
    // 7 days ending at the end of today (today + 6 previous days)
    const nextDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, 1);
    const end = zonedLocalToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, 0, tz);

    const startDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -6);
    const start = zonedLocalToUtc(startDay.year, startDay.month, startDay.day, 0, 0, 0, tz);

    const prevStartDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -13);
    const prevStart = zonedLocalToUtc(prevStartDay.year, prevStartDay.month, prevStartDay.day, 0, 0, 0, tz);
    const prevEnd = start;

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: "Last 7 Days",
      comparisonLabel: "Previous 7 Days",
      timeZone: tz,
      period,
    };
  }

  if (period === "last30days") {
    // 30 days ending at the end of today (today + 29 previous days)
    const nextDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, 1);
    const end = zonedLocalToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, 0, tz);

    const startDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -29);
    const start = zonedLocalToUtc(startDay.year, startDay.month, startDay.day, 0, 0, 0, tz);

    const prevStartDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -59);
    const prevStart = zonedLocalToUtc(prevStartDay.year, prevStartDay.month, prevStartDay.day, 0, 0, 0, tz);
    const prevEnd = start;

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: "Last 30 Days",
      comparisonLabel: "Previous 30 Days",
      timeZone: tz,
      period,
    };
  }

  // Default: "today"
  const start = zonedLocalToUtc(ymd.year, ymd.month, ymd.day, 0, 0, 0, tz);
  const next = shiftCalendarDays(ymd.year, ymd.month, ymd.day, 1);
  const end = zonedLocalToUtc(next.year, next.month, next.day, 0, 0, 0, tz);

  const prevDay = shiftCalendarDays(ymd.year, ymd.month, ymd.day, -1);
  const prevStart = zonedLocalToUtc(prevDay.year, prevDay.month, prevDay.day, 0, 0, 0, tz);
  const prevEnd = start;

  return {
    start,
    end,
    prevStart,
    prevEnd,
    label: "Today",
    comparisonLabel: "Yesterday",
    timeZone: tz,
    period: "today",
  };
}
