import { joinQueue, getPublicTicketSnapshot } from "../src/lib/actions/ticket";

async function main() {
  console.log("1. Joining queue...");
  const joinResult = await joinQueue({
    businessId: "cmtd2uy2z00018kvw8xajng7m",
    queueId: "cmtdusuiv0000ygvwej88gbd8",
    customerName: "Test Diagnostic " + Date.now(),
  });

  console.log("joinResult:", JSON.stringify(joinResult, null, 2));

  if (!("ticket" in joinResult) || !joinResult.ticket) {
    console.error("Join failed!");
    process.exit(1);
  }

  const { ticket } = joinResult;
  console.log("ticketUrl:", ticket.ticketUrl);
  console.log("trackingToken:", ticket.trackingToken);
  console.log("id:", ticket.id);

  console.log("\n2. Testing getPublicTicketSnapshot with trackingToken...");
  const snapByToken = await getPublicTicketSnapshot(
    "cmtd2uy2z00018kvw8xajng7m",
    "cmtdusuiv0000ygvwej88gbd8",
    ticket.trackingToken
  );
  console.log("snapByToken:", JSON.stringify(snapByToken, null, 2));

  console.log("\n3. Testing getPublicTicketSnapshot with id...");
  const snapById = await getPublicTicketSnapshot(
    "cmtd2uy2z00018kvw8xajng7m",
    "cmtdusuiv0000ygvwej88gbd8",
    ticket.id
  );
  console.log("snapById:", JSON.stringify(snapById, null, 2));

  console.log("\n4. Fetching from HTTP server...");
  const fullUrl = `http://localhost:3000${ticket.ticketUrl}`;
  console.log("Fetching:", fullUrl);
  const res = await fetch(fullUrl);
  console.log("HTTP Status:", res.status);
  const text = await res.text();
  console.log("Is 404 in HTML?:", text.includes("404") || text.includes("This page could not be found"));
  console.log("Body snippet:", text.slice(0, 300));
}

main().catch(console.error);
