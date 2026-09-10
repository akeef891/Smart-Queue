import { prisma } from "../src/lib/prisma";

async function main() {
  const ref = process.argv[2] ?? "cmtvp7y4e00033svwnbyx3bu7";
  const byId = await prisma.queueEntry.findFirst({
    where: { id: ref },
    select: { id: true, trackingToken: true, queueId: true, queue: { select: { businessId: true } } },
  });
  const byToken = await prisma.queueEntry.findFirst({
    where: { trackingToken: ref },
    select: { id: true, trackingToken: true, queueId: true, queue: { select: { businessId: true } } },
  });
  console.log(
    JSON.stringify({
      ref,
      foundById: Boolean(byId),
      foundByTrackingToken: Boolean(byToken),
      idEqualsToken: byId ? byId.id === byId.trackingToken : null,
      idMatchesQueue:
        byId?.queueId === "cmtdusuiv0000ygvwej88gbd8" &&
        byId.queue.businessId === "cmtd2uy2z00018kvw8xajng7m",
      tokenMatchesQueue:
        byToken?.queueId === "cmtdusuiv0000ygvwej88gbd8" &&
        byToken.queue.businessId === "cmtd2uy2z00018kvw8xajng7m",
      tokensDiffer: byId ? byId.id !== byId.trackingToken : null,
    })
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.name : "unknown");
  process.exit(1);
});
