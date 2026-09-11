import { detectTicketNotification } from "../src/lib/notifications/detector";
import type { PublicTicketSnapshot } from "../src/lib/actions/ticket";
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  sendBrowserNotification,
} from "../src/lib/notifications/browser-notifications";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

console.log("--- Starting Notifications Test Suite ---");

const baseSnapshot: PublicTicketSnapshot = {
  businessName: "Acme Clinic",
  queueName: "General Queue",
  label: "A-12",
  status: "WAITING",
  peopleAhead: 5,
  position: 6,
  currentlyServingLabel: "A-07",
  currentlyCalledLabel: "A-08",
};

// Test 1: Initial mount (prev === null) must NOT notify
{
  const notifiedKeys = new Set<string>();
  const res = detectTicketNotification(null, baseSnapshot, notifiedKeys);
  assert(res === null, "Initial load with prev === null does not fire notification");
}

// Test 2: Status transition to CALLED
{
  const notifiedKeys = new Set<string>();
  const calledSnapshot: PublicTicketSnapshot = {
    ...baseSnapshot,
    status: "CALLED",
  };
  const res = detectTicketNotification(baseSnapshot, calledSnapshot, notifiedKeys);
  assert(res !== null, "Transition WAITING -> CALLED generates notification");
  assert(res?.dedupeKey === "status_CALLED", "Dedupe key is status_CALLED");
  assert(res?.notification.category === "CALLED", "Category is CALLED");
  assert(res?.notification.title === "Smart Queue — Your turn", "Title matches 'Smart Queue — Your turn'");
  assert(
    Boolean(
      res?.notification.message.includes("A-12") &&
        res?.notification.message.includes("General Queue")
    ),
    "Message includes ticket number and queue name"
  );
  assert(res?.notification.persistent === true, "CALLED notification is marked persistent");
}

// Test 3: Deduplication prevents repeated notification for CALLED
{
  const notifiedKeys = new Set<string>(["status_CALLED"]);
  const calledSnapshot: PublicTicketSnapshot = {
    ...baseSnapshot,
    status: "CALLED",
  };
  const res = detectTicketNotification(baseSnapshot, calledSnapshot, notifiedKeys);
  assert(res === null, "Duplicate CALLED event is blocked by deduplication key");
}

// Test 4: Status transition to SERVING
{
  const notifiedKeys = new Set<string>();
  const calledSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "CALLED" };
  const servingSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "SERVING" };
  const res = detectTicketNotification(calledSnapshot, servingSnapshot, notifiedKeys);
  assert(res !== null, "Transition to SERVING generates notification");
  assert(res?.dedupeKey === "status_SERVING", "Dedupe key is status_SERVING");
  assert(res?.notification.message === "Your service has started.", "Message is 'Your service has started.'");
}

// Test 5: Status transition to COMPLETED
{
  const notifiedKeys = new Set<string>();
  const servingSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "SERVING" };
  const completedSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "COMPLETED" };
  const res = detectTicketNotification(servingSnapshot, completedSnapshot, notifiedKeys);
  assert(res !== null, "Transition to COMPLETED generates notification");
  assert(res?.dedupeKey === "status_COMPLETED", "Dedupe key is status_COMPLETED");
  assert(res?.notification.category === "COMPLETED", "Category is COMPLETED");
}

// Test 6: Terminal statuses: CANCELLED, SKIPPED, NO_SHOW
{
  const notifiedKeys = new Set<string>();
  const cancelledSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "CANCELLED" };
  const resCancelled = detectTicketNotification(baseSnapshot, cancelledSnapshot, notifiedKeys);
  assert(resCancelled?.dedupeKey === "status_CANCELLED", "CANCELLED transition detected");

  const skippedSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "SKIPPED" };
  const resSkipped = detectTicketNotification(baseSnapshot, skippedSnapshot, notifiedKeys);
  assert(resSkipped?.dedupeKey === "status_SKIPPED", "SKIPPED transition detected");

  const noShowSnapshot: PublicTicketSnapshot = { ...baseSnapshot, status: "NO_SHOW" };
  const resNoShow = detectTicketNotification(baseSnapshot, noShowSnapshot, notifiedKeys);
  assert(resNoShow?.dedupeKey === "status_NO_SHOW", "NO_SHOW transition detected");
}

// Test 7: Proximity transition (peopleAhead from 5 down to 2)
{
  const notifiedKeys = new Set<string>();
  const almostUpSnapshot: PublicTicketSnapshot = {
    ...baseSnapshot,
    peopleAhead: 2,
    position: 3,
  };
  const res = detectTicketNotification(baseSnapshot, almostUpSnapshot, notifiedKeys);
  assert(res !== null, "Queue movement from 5 to 2 triggers ALMOST_UP notification");
  assert(res?.dedupeKey === "queue_almost_up_2", "Dedupe key is queue_almost_up_2");
  assert(
    Boolean(res?.notification.message.includes("2 customers")),
    "Notification mentions 2 customers"
  );
}

// Test 8: Proximity transition to next in line (peopleAhead from 1 down to 0)
{
  const notifiedKeys = new Set<string>();
  const oneAheadSnapshot: PublicTicketSnapshot = { ...baseSnapshot, peopleAhead: 1, position: 2 };
  const zeroAheadSnapshot: PublicTicketSnapshot = { ...baseSnapshot, peopleAhead: 0, position: 1 };
  const res = detectTicketNotification(oneAheadSnapshot, zeroAheadSnapshot, notifiedKeys);
  assert(res !== null, "Queue movement from 1 to 0 triggers NEXT_IN_LINE notification");
  assert(res?.dedupeKey === "queue_next_in_line", "Dedupe key is queue_next_in_line");
  assert(res?.notification.category === "NEXT_IN_LINE", "Category is NEXT_IN_LINE");
}

// Test 9: Browser notification SSR / non-browser safety
{
  assert(isBrowserNotificationSupported() === false, "isBrowserNotificationSupported returns false in Node.js");
  assert(getNotificationPermission() === "unsupported", "getNotificationPermission returns 'unsupported' in Node.js");
  assert(
    sendBrowserNotification({ title: "test", body: "test" }) === false,
    "sendBrowserNotification safely returns false in Node.js without crashing"
  );
}

console.log("\n🎉 ALL NOTIFICATION TESTS PASSED SUCCESSFULLY!\n");
