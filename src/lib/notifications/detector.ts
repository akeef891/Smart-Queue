import type { PublicTicketSnapshot } from "@/lib/actions/ticket";
import type { CustomerNotification } from "./types";

export type DetectedNotification = {
  notification: CustomerNotification;
  dedupeKey: string;
};

/**
 * Pure transition detector comparing previous snapshot against current snapshot.
 * Guarantees no notifications fire on initial mount (prev === null) or if
 * the dedupeKey has already been recorded.
 */
export function detectTicketNotification(
  prev: PublicTicketSnapshot | null,
  curr: PublicTicketSnapshot,
  alreadyNotifiedKeys: ReadonlySet<string>
): DetectedNotification | null {
  if (!prev) {
    return null;
  }

  const now = Date.now();

  // Status transitions
  if (curr.status !== prev.status) {
    switch (curr.status) {
      case "CALLED": {
        const dedupeKey = "status_CALLED";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_called`,
            title: "Smart Queue — Your turn",
            message: `Ticket ${curr.label} is now being called for ${curr.queueName}. Please proceed to the service counter.`,
            severity: "warning",
            category: "CALLED",
            timestamp: now,
            persistent: true,
          },
        };
      }

      case "SERVING": {
        const dedupeKey = "status_SERVING";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_serving`,
            title: "Smart Queue",
            message: "Your service has started.",
            severity: "info",
            category: "SERVING",
            timestamp: now,
          },
        };
      }

      case "COMPLETED": {
        const dedupeKey = "status_COMPLETED";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_completed`,
            title: "Smart Queue",
            message: "Your visit is complete. Thank you!",
            severity: "success",
            category: "COMPLETED",
            timestamp: now,
          },
        };
      }

      case "CANCELLED": {
        const dedupeKey = "status_CANCELLED";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_cancelled`,
            title: "Smart Queue",
            message: "You have left the queue. This ticket is cancelled.",
            severity: "info",
            category: "CANCELLED",
            timestamp: now,
          },
        };
      }

      case "SKIPPED": {
        const dedupeKey = "status_SKIPPED";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_skipped`,
            title: "Smart Queue",
            message: "This ticket was skipped. Please speak with a staff member.",
            severity: "warning",
            category: "SKIPPED",
            timestamp: now,
          },
        };
      }

      case "NO_SHOW": {
        const dedupeKey = "status_NO_SHOW";
        if (alreadyNotifiedKeys.has(dedupeKey)) return null;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_no_show`,
            title: "Smart Queue",
            message: "This ticket was marked as no-show.",
            severity: "warning",
            category: "NO_SHOW",
            timestamp: now,
          },
        };
      }
    }
  }

  // Waiting queue movement transitions
  if (curr.status === "WAITING" && prev.status === "WAITING") {
    // Next in line milestone
    if (curr.peopleAhead === 0 && prev.peopleAhead > 0) {
      const dedupeKey = "queue_next_in_line";
      if (!alreadyNotifiedKeys.has(dedupeKey)) {
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_next_in_line`,
            title: "Smart Queue",
            message: "You're next in line! Please stay near the service area.",
            severity: "info",
            category: "NEXT_IN_LINE",
            timestamp: now,
          },
        };
      }
    }

    // Almost up threshold (1 or 2 people ahead, down from > 2)
    if (
      curr.peopleAhead > 0 &&
      curr.peopleAhead <= 2 &&
      prev.peopleAhead > 2
    ) {
      const dedupeKey = `queue_almost_up_${curr.peopleAhead}`;
      if (!alreadyNotifiedKeys.has(dedupeKey)) {
        const countText =
          curr.peopleAhead === 1
            ? "Only 1 customer is ahead of you."
            : `Only ${curr.peopleAhead} customers are ahead of you.`;
        return {
          dedupeKey,
          notification: {
            id: `notif_${now}_almost_up`,
            title: "Smart Queue",
            message: `You're almost up. ${countText}`,
            severity: "info",
            category: "ALMOST_UP",
            timestamp: now,
          },
        };
      }
    }
  }

  return null;
}
