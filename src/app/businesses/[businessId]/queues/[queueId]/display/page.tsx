import { notFound } from "next/navigation";
import { getPublicQueueDisplaySnapshot } from "@/lib/actions/ticket";
import { QueueDisplay } from "@/components/display/queue-display";
import { getAppOrigin } from "@/lib/app-origin";
import QRCode from "qrcode";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string }>;
}): Promise<Metadata> {
  const { businessId, queueId } = await params;
  const result = await getPublicQueueDisplaySnapshot(businessId, queueId);

  if (!("snapshot" in result) || !result.snapshot) {
    return { title: "Queue Display — Smart Queue" };
  }

  return {
    title: `${result.snapshot.queueName} — TV Display | Smart Queue`,
    description: `Live waiting room TV display for ${result.snapshot.queueName} at ${result.snapshot.businessName}`,
  };
}

export default async function QueueDisplayPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string }>;
}) {
  const { businessId, queueId } = await params;
  const result = await getPublicQueueDisplaySnapshot(businessId, queueId);

  if (!("snapshot" in result) || !result.snapshot) {
    notFound();
  }

  const joinPath = `/businesses/${businessId}/queues/${queueId}/join`;
  const origin = await getAppOrigin();
  const joinUrl = origin ? `${origin}${joinPath}` : joinPath;

  let joinQrDataUrl: string | null = null;
  try {
    joinQrDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    // QR code generation failed, fallback to null
  }

  return (
    <QueueDisplay
      initial={result.snapshot}
      businessId={businessId}
      queueId={queueId}
      joinUrl={joinUrl}
      joinQrDataUrl={joinQrDataUrl}
    />
  );
}
