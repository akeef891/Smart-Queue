import { notFound } from "next/navigation";
import { getPublicTicketSnapshot } from "@/lib/actions/ticket";
import { LiveTicketView } from "@/components/customer/live-ticket-view";

export default async function CustomerTicketPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string; ticketId: string }>;
}) {
  const { businessId, queueId, ticketId } = await params;
  const result = await getPublicTicketSnapshot(businessId, queueId, ticketId);

  if (!("snapshot" in result) || !result.snapshot) {
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
