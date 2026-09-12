import { getPublicQueueDisplaySnapshot } from "../src/lib/actions/ticket";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function run() {
  console.log("--- Starting TV / Display Mode Snapshot Test ---");

  // Test 1: Function handles missing/invalid queue gracefully
  const missingResult = await getPublicQueueDisplaySnapshot(
    "non-existent-biz",
    "non-existent-queue"
  );
  assert("error" in missingResult, "Missing queue returns error object");
  if ("error" in missingResult && missingResult.error) {
    assert(
      missingResult.error === "Queue could not be found." ||
        missingResult.error === "Something went wrong. Please try again." ||
        missingResult.error.includes("trouble connecting"),
      "Returns expected error message format"
    );
  } else {
    assert(false, "Expected error in missingResult");
  }

  console.log("\n🎉 ALL DISPLAY TESTS PASSED SUCCESSFULLY!\n");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
