import { notFound } from "next/navigation";
import { getPublicTicketSnapshot } from "@/lib/actions/ticket";
import { LiveTicketView } from "@/components/customer/live-ticket-view";

export default async function CustomerTicketPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string; ticketId: string }>;
}) {
  const { businessId, queueId, ticketId } = await params;
  console.log("[CustomerTicketPage] params:", { businessId, queueId, ticketId });
  const result = await getPublicTicketSnapshot(businessId, queueId, ticketId);
  console.log("[CustomerTicketPage] snapshot result:", result);

  if (!("snapshot" in result) || !result.snapshot) {
    console.warn("[CustomerTicketPage] Calling notFound() because snapshot is missing!");
    notFound();
  }

  return (
    <LiveTicketView
      businessId={businessId}
      queueId={queueId}
      trackingToken={ticketId}
      initial={result.snapshot}
    />
  );
}
