/**
 * Timezone helpers and comprehensive IANA timezone database.
 * Defaults to India Standard Time (IST) - Asia/Kolkata.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_TIMEZONE_LABEL = "India Standard Time (IST) — Asia/Kolkata";

export type TimezoneOption = {
  value: string;
  label: string;
  group?: string;
};

// Curated prominent timezones with polished human-readable labels
const PROMINENT_TIMEZONES: Record<string, string> = {
  "Asia/Kolkata": "India Standard Time (IST) — Asia/Kolkata",
  "UTC": "Coordinated Universal Time (UTC) — UTC",
  "America/New_York": "Eastern Time (ET) — America/New_York",
  "America/Chicago": "Central Time (CT) — America/Chicago",
  "America/Denver": "Mountain Time (MT) — America/Denver",
  "America/Los_Angeles": "Pacific Time (PT) — America/Los_Angeles",
  "America/Anchorage": "Alaska Time (AKT) — America/Anchorage",
  "Pacific/Honolulu": "Hawaii Time (HST) — Pacific/Honolulu",
  "Europe/London": "London / GMT — Europe/London",
  "Europe/Paris": "Paris / Central European Time — Europe/Paris",
  "Europe/Berlin": "Berlin / Central European Time — Europe/Berlin",
  "Asia/Dubai": "Dubai / Gulf Standard Time (GST) — Asia/Dubai",
  "Asia/Singapore": "Singapore Standard Time (SGT) — Asia/Singapore",
  "Asia/Tokyo": "Japan Standard Time (JST) — Asia/Tokyo",
  "Asia/Seoul": "Korea Standard Time (KST) — Asia/Seoul",
  "Australia/Sydney": "Sydney / Australian Eastern Time — Australia/Sydney",
  "America/Toronto": "Toronto / Eastern Time — America/Toronto",
  "America/Sao_Paulo": "São Paulo / Brasilia Time — America/Sao_Paulo",
  "Africa/Johannesburg": "Johannesburg / South Africa Time — Africa/Johannesburg",
};

/**
 * Validates whether a timezone identifier is a recognized, valid IANA timezone.
 */
export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a human-friendly label for any IANA timezone.
 */
export function formatTimezoneLabel(tz: string): string {
  if (PROMINENT_TIMEZONES[tz]) {
    return PROMINENT_TIMEZONES[tz];
  }

  // Format city/region from IANA identifier (e.g., "America/Indiana/Indianapolis" -> "Indianapolis")
  const parts = tz.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  const region = parts[0].replace(/_/g, " ");

  try {
    // Attempt to compute standard offset like "GMT+5:30"
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const offsetPart = formatter.formatToParts(now).find((p) => p.type === "timeZoneName")?.value;
    if (offsetPart) {
      return `${city} (${offsetPart}) — ${tz}`;
    }
  } catch {
    // Fallback if offset calculation fails
  }

  return `${city} (${region}) — ${tz}`;
}

/**
 * Comprehensive list of supported IANA timezones.
 * Always places Asia/Kolkata at the very top as the default.
 */
export function getAllTimezoneOptions(): TimezoneOption[] {
  let allSupported: string[] = [];

  try {
    if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
      allSupported = (Intl as any).supportedValuesOf("timeZone");
    }
  } catch {
    // fallback
  }

  if (!allSupported || allSupported.length === 0) {
    allSupported = Object.keys(PROMINENT_TIMEZONES);
  }

  // Make sure Asia/Kolkata and UTC are in the list
  if (!allSupported.includes("Asia/Kolkata")) allSupported.unshift("Asia/Kolkata");
  if (!allSupported.includes("UTC")) allSupported.push("UTC");

  const prominentKeys = Object.keys(PROMINENT_TIMEZONES);
  
  // 1. Featured list (Asia/Kolkata first, then rest of prominent)
  const featuredList: TimezoneOption[] = prominentKeys.map((tz) => ({
    value: tz,
    label: PROMINENT_TIMEZONES[tz],
    group: "Popular & Recommended",
  }));

  // 2. All other IANA timezones
  const otherKeys = allSupported
    .filter((tz) => !PROMINENT_TIMEZONES[tz])
    .sort((a, b) => a.localeCompare(b));

  const otherList: TimezoneOption[] = otherKeys.map((tz) => ({
    value: tz,
    label: formatTimezoneLabel(tz),
    group: "All Timezones (IANA)",
  }));

  return [...featuredList, ...otherList];
}
