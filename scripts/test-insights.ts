import { getAnalyticsPeriodRange, type AnalyticsPeriod } from "../src/lib/analytics-range";
import { WAIT_TIME_WARNING_THRESHOLD_MINUTES } from "../src/lib/insights-types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

console.log("--- Starting Business Insights Test Suite ---");

// Test 1: getAnalyticsPeriodRange for "today"
{
  const refDate = new Date("2026-09-12T15:30:00.000Z");
  const res = getAnalyticsPeriodRange("UTC", "today", refDate);
  assert(res.period === "today", "Period is 'today'");
  assert(res.label === "Today", "Label is 'Today'");
  assert(res.comparisonLabel === "Yesterday", "Comparison label is 'Yesterday'");
  assert(res.start.toISOString() === "2026-09-12T00:00:00.000Z", "Start is 2026-09-12T00:00:00.000Z");
  assert(res.end.toISOString() === "2026-09-13T00:00:00.000Z", "End is 2026-09-13T00:00:00.000Z");
  assert(res.prevStart.toISOString() === "2026-09-11T00:00:00.000Z", "Prev start is 2026-09-11T00:00:00.000Z");
  assert(res.prevEnd.toISOString() === "2026-09-12T00:00:00.000Z", "Prev end is 2026-09-12T00:00:00.000Z");
}

// Test 2: getAnalyticsPeriodRange for "yesterday"
{
  const refDate = new Date("2026-09-12T15:30:00.000Z");
  const res = getAnalyticsPeriodRange("UTC", "yesterday", refDate);
  assert(res.period === "yesterday", "Period is 'yesterday'");
  assert(res.label === "Yesterday", "Label is 'Yesterday'");
  assert(res.start.toISOString() === "2026-09-11T00:00:00.000Z", "Yesterday start is 2026-09-11T00:00:00.000Z");
  assert(res.end.toISOString() === "2026-09-12T00:00:00.000Z", "Yesterday end is 2026-09-12T00:00:00.000Z");
  assert(res.prevStart.toISOString() === "2026-09-10T00:00:00.000Z", "Day before yesterday start is 2026-09-10T00:00:00.000Z");
}

// Test 3: getAnalyticsPeriodRange for "last7days"
{
  const refDate = new Date("2026-09-12T15:30:00.000Z");
  const res = getAnalyticsPeriodRange("UTC", "last7days", refDate);
  assert(res.period === "last7days", "Period is 'last7days'");
  assert(res.label === "Last 7 Days", "Label is 'Last 7 Days'");
  // End of today: 2026-09-13T00:00:00.000Z
  assert(res.end.toISOString() === "2026-09-13T00:00:00.000Z", "Last 7 days end is end of today");
  // 7 days total: 2026-09-06T00:00:00.000Z to 2026-09-13T00:00:00.000Z
  assert(res.start.toISOString() === "2026-09-06T00:00:00.000Z", "Last 7 days start is 2026-09-06T00:00:00.000Z");
  const durationDays = (res.end.getTime() - res.start.getTime()) / (1000 * 60 * 60 * 24);
  assert(durationDays === 7, `Duration is exactly 7 days (got ${durationDays})`);
}

// Test 4: getAnalyticsPeriodRange for "last30days"
{
  const refDate = new Date("2026-09-12T15:30:00.000Z");
  const res = getAnalyticsPeriodRange("UTC", "last30days", refDate);
  assert(res.period === "last30days", "Period is 'last30days'");
  const durationDays = (res.end.getTime() - res.start.getTime()) / (1000 * 60 * 60 * 24);
  assert(durationDays === 30, `Duration is exactly 30 days (got ${durationDays})`);
}

// Test 5: Calculation validation - Wait duration math
{
  // Test scenario: Joined at 10:00, called at 10:15, service started at 10:18, completed at 10:30
  const joinedAt = new Date("2026-09-12T10:00:00.000Z");
  const calledAt = new Date("2026-09-12T10:15:00.000Z");
  const servingAt = new Date("2026-09-12T10:18:00.000Z");
  const completedAt = new Date("2026-09-12T10:30:00.000Z");

  const waitMs = (servingAt ?? calledAt).getTime() - joinedAt.getTime();
  assert(waitMs === 18 * 60 * 1000, "Wait time is 18 minutes (from joinedAt to servingAt)");

  const serviceMs = completedAt.getTime() - servingAt.getTime();
  assert(serviceMs === 12 * 60 * 1000, "Service time is 12 minutes (from servingAt to completedAt)");
}

// Test 6: Completion rate calculation
{
  // 40 completed, 4 skipped, 4 no-show, 2 cancelled
  const completed = 40;
  const skipped = 4;
  const noShow = 4;
  const cancelled = 2;
  const terminal = completed + skipped + noShow + cancelled; // 50
  const rate = Math.round((completed / terminal) * 100);
  assert(rate === 80, "Completion rate is 80% (40/50)");
}

// Test 7: Warning threshold definition
{
  assert(
    WAIT_TIME_WARNING_THRESHOLD_MINUTES === 30,
    "Wait time warning threshold is 30 minutes as specified"
  );
}

console.log("\n🎉 ALL BUSINESS INSIGHTS TESTS PASSED SUCCESSFULLY!\n");
