import { prisma } from "../src/lib/prisma";
import type { User } from "../src/generated/prisma";
import {
  getBusinessSettings,
  updateBusinessProfile,
  uploadBusinessLogo,
  removeBusinessLogo,
} from "../src/lib/actions/settings";
import {
  joinQueue,
  getPublicTicketSnapshot,
  getPublicQueueDisplaySnapshot,
  callNextTicket,
  startServingTicket,
  completeTicket,
} from "../src/lib/actions/ticket";
import { createBusiness } from "../src/lib/actions/business";
import { isValidIanaTimeZone, DEFAULT_TIMEZONE, getAllTimezoneOptions } from "../src/lib/timezones";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runTestSuite() {
  console.log("==========================================================");
  console.log("SMART QUEUE — LOGO, TIMEZONE & BRANDING VERIFICATION SUITE");
  console.log("==========================================================");

  const pfx = `test_brand_${Date.now()}`;

  // 1. Create Test Users
  const ownerA: User = await prisma.user.create({
    data: {
      id: `${pfx}_owner_a`,
      clerkId: `clerk_${pfx}_owner_a`,
      email: `${pfx}_owner_a@test.com`,
      displayName: "Owner Tenant A",
    },
  });

  const managerA: User = await prisma.user.create({
    data: {
      id: `${pfx}_mgr_a`,
      clerkId: `clerk_${pfx}_mgr_a`,
      email: `${pfx}_mgr_a@test.com`,
      displayName: "Manager Tenant A",
    },
  });

  const staffA: User = await prisma.user.create({
    data: {
      id: `${pfx}_stf_a`,
      clerkId: `clerk_${pfx}_stf_a`,
      email: `${pfx}_stf_a@test.com`,
      displayName: "Staff Tenant A",
    },
  });

  const ownerB: User = await prisma.user.create({
    data: {
      id: `${pfx}_owner_b`,
      clerkId: `clerk_${pfx}_owner_b`,
      email: `${pfx}_owner_b@test.com`,
      displayName: "Owner Tenant B",
    },
  });

  const outsider: User = await prisma.user.create({
    data: {
      id: `${pfx}_outsider`,
      clerkId: `clerk_${pfx}_outsider`,
      email: `${pfx}_outsider@test.com`,
      displayName: "Outsider",
    },
  });

  let wsAId = "";
  let wsBId = "";
  let bizAId = "";
  let bizBId = "";
  let qA1Id = "";

  try {
    // 2. Setup Tenant A
    const wsA = await prisma.workspace.create({
      data: { name: "Workspace A", slug: `${pfx}-wsa`, ownerId: ownerA.id, status: "ACTIVE" },
    });
    wsAId = wsA.id;

    // Create Business A via createBusiness to verify default timezone
    const bizACreateResult = await createBusiness({
      name: "Apex Diagnostics",
      description: "Premier diagnostic medical center",
    }, ownerA);

    assert("business" in bizACreateResult && Boolean(bizACreateResult.business), "Business A created via createBusiness");
    const bizA = (bizACreateResult as any).business;
    bizAId = bizA.id;

    // Link Manager A and Staff A to Business A
    await prisma.businessMember.create({
      data: {
        businessId: bizA.id,
        userId: managerA.id,
        email: managerA.email,
        role: "MANAGER",
        status: "ACTIVE",
      },
    });

    await prisma.businessMember.create({
      data: {
        businessId: bizA.id,
        userId: staffA.id,
        email: staffA.email,
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    // Create Queue A1
    const qA1 = await prisma.queue.create({
      data: {
        businessId: bizA.id,
        workspaceId: wsA.id,
        name: "Blood Test Desk",
        slug: "BLD",
        status: "ACTIVE",
        averageServiceTime: 12,
        createdById: ownerA.id,
      },
    });
    qA1Id = qA1.id;

    // Assign Staff A to Queue A1
    await prisma.staffQueueAssignment.create({
      data: {
        queueId: qA1.id,
        memberId: (
          await prisma.businessMember.findFirstOrThrow({
            where: { businessId: bizA.id, userId: staffA.id },
          })
        ).id,
      },
    });

    // 3. Setup Tenant B
    const wsB = await prisma.workspace.create({
      data: { name: "Workspace B", slug: `${pfx}-wsb`, ownerId: ownerB.id, status: "ACTIVE" },
    });
    wsBId = wsB.id;

    const bizB = await prisma.business.create({
      data: {
        workspaceId: wsB.id,
        name: "Zenith Salons",
        slug: `${pfx}-zenith`,
        status: "ACTIVE",
        timezone: "America/New_York", // Explicit custom timezone
      },
    });
    bizBId = bizB.id;

    console.log("✓ Test fixtures created successfully.\n");

    // ----------------------------------------------------
    // Scenario 1: New business default timezone is Asia/Kolkata
    // ----------------------------------------------------
    {
      assert(bizA.timezone === "Asia/Kolkata", "Scenario 1: New business created with default timezone Asia/Kolkata");
      const settingsRes = await getBusinessSettings(bizA.id, ownerA);
      assert("snapshot" in settingsRes && settingsRes.snapshot.profile.timezone === "Asia/Kolkata", "Scenario 1b: Settings snapshot profile defaults to Asia/Kolkata");
    }

    // ----------------------------------------------------
    // Scenario 2: Existing explicit timezone is preserved
    // ----------------------------------------------------
    {
      const bSettings = await getBusinessSettings(bizB.id, ownerB);
      assert("snapshot" in bSettings && bSettings.snapshot.profile.timezone === "America/New_York", "Scenario 2: Existing explicit timezone America/New_York is preserved");
    }

    // ----------------------------------------------------
    // Scenario 3: Valid IANA timezone can be saved
    // ----------------------------------------------------
    {
      assert(isValidIanaTimeZone("Europe/London"), "Europe/London is recognized as valid IANA");
      assert(isValidIanaTimeZone("Asia/Kolkata"), "Asia/Kolkata is recognized as valid IANA");
      assert(isValidIanaTimeZone("America/Los_Angeles"), "America/Los_Angeles is recognized as valid IANA");

      const updateRes = await updateBusinessProfile(
        bizA.id,
        {
          name: "Apex Diagnostics",
          type: "DIAGNOSTIC_CENTER",
          timezone: "Europe/London",
        },
        ownerA
      );
      assert("ok" in updateRes && updateRes.ok === true, "Scenario 3: Owner successfully saved valid IANA timezone Europe/London");

      const check = await getBusinessSettings(bizA.id, ownerA);
      assert("snapshot" in check && check.snapshot.profile.timezone === "Europe/London", "Scenario 3b: Timezone Europe/London persisted");
    }

    // ----------------------------------------------------
    // Scenario 4: Invalid timezone is rejected
    // ----------------------------------------------------
    {
      assert(!isValidIanaTimeZone("Invalid/Fake_Zone_123"), "Invalid zone detected by validator");

      const invalidRes = await updateBusinessProfile(
        bizA.id,
        {
          name: "Apex Diagnostics",
          type: "DIAGNOSTIC_CENTER",
          timezone: "Invalid/Fake_Zone_123",
        },
        ownerA
      );
      assert("error" in invalidRes, "Scenario 4: Invalid timezone is rejected by validation");
    }

    // ----------------------------------------------------
    // Scenario 5: OWNER can update timezone back to Asia/Kolkata
    // ----------------------------------------------------
    {
      const updateRes = await updateBusinessProfile(
        bizA.id,
        {
          name: "Apex Diagnostics",
          type: "DIAGNOSTIC_CENTER",
          timezone: "Asia/Kolkata",
        },
        ownerA
      );
      assert("ok" in updateRes && updateRes.ok === true, "Scenario 5: Owner successfully restored timezone to Asia/Kolkata");
    }

    // ----------------------------------------------------
    // Scenario 6: MANAGER cannot update timezone
    // ----------------------------------------------------
    {
      const mgrRes = await updateBusinessProfile(
        bizA.id,
        {
          name: "Apex Diagnostics",
          type: "DIAGNOSTIC_CENTER",
          timezone: "Asia/Dubai",
        },
        managerA
      );
      assert("error" in mgrRes, "Scenario 6: Manager is rejected from updating timezone");
    }

    // ----------------------------------------------------
    // Scenario 7: STAFF cannot update timezone
    // ----------------------------------------------------
    {
      const stfRes = await updateBusinessProfile(
        bizA.id,
        {
          name: "Apex Diagnostics",
          type: "DIAGNOSTIC_CENTER",
          timezone: "Asia/Dubai",
        },
        staffA
      );
      assert("error" in stfRes, "Scenario 7: Staff is rejected from updating timezone");
    }

    // ----------------------------------------------------
    // Scenario 8: OWNER can upload and update logo
    // ----------------------------------------------------
    let uploadedLogoUrl = "";
    {
      const fakeImageContent = Buffer.from("fake-png-image-binary-stream-apex-logo");
      const mockFile = {
        name: "apex-logo.png",
        type: "image/png",
        size: fakeImageContent.length,
        arrayBuffer: async () => fakeImageContent.buffer,
      };

      const uploadRes = await uploadBusinessLogo(bizA.id, mockFile, ownerA);
      assert("ok" in uploadRes && Boolean(uploadRes.logoUrl), "Scenario 8: Owner successfully uploaded logo via uploadBusinessLogo");
      uploadedLogoUrl = (uploadRes as any).logoUrl;
      assert(uploadedLogoUrl.includes("business-logos"), "Scenario 8b: Uploaded logo points to business-logos storage bucket");
    }

    // ----------------------------------------------------
    // Scenario 9: Unauthorized user cannot upload logo
    // ----------------------------------------------------
    {
      const fakeImageContent = Buffer.from("fake-png-data");
      const mockFile = {
        name: "hacked.png",
        type: "image/png",
        size: fakeImageContent.length,
        arrayBuffer: async () => fakeImageContent.buffer,
      };

      const outsiderRes = await uploadBusinessLogo(bizA.id, mockFile, outsider);
      assert("error" in outsiderRes, "Scenario 9: Outsider is strictly rejected from uploading logo");

      const staffRes = await uploadBusinessLogo(bizA.id, mockFile, staffA);
      assert("error" in staffRes, "Scenario 9b: Staff is strictly rejected from uploading logo");

      const mgrRes = await uploadBusinessLogo(bizA.id, mockFile, managerA);
      assert("error" in mgrRes, "Scenario 9c: Manager is strictly rejected from uploading logo");
    }

    // ----------------------------------------------------
    // Scenario 10: Business A cannot modify Business B logo
    // ----------------------------------------------------
    {
      const fakeImageContent = Buffer.from("cross-tenant-attack");
      const mockFile = {
        name: "exploit.png",
        type: "image/png",
        size: fakeImageContent.length,
        arrayBuffer: async () => fakeImageContent.buffer,
      };

      const crossTenantRes = await uploadBusinessLogo(bizB.id, mockFile, ownerA);
      assert("error" in crossTenantRes, "Scenario 10: Owner A cannot upload logo to Business B");
    }

    // ----------------------------------------------------
    // Scenario 11: Logo persists after refresh and in settings snapshot
    // ----------------------------------------------------
    {
      const settingsSnap = await getBusinessSettings(bizA.id, ownerA);
      assert("snapshot" in settingsSnap, "Got settings snapshot");
      if ("snapshot" in settingsSnap) {
        assert(settingsSnap.snapshot.profile.logoUrl === uploadedLogoUrl, "Scenario 11: Logo persists in BusinessSettings snapshot");
      }
    }

    // ----------------------------------------------------
    // Scenario 12: Public Join Queue exposes logo safely
    // ----------------------------------------------------
    {
      const queueRecord = await prisma.queue.findUnique({
        where: { id: qA1.id },
        include: { business: { select: { name: true, logoUrl: true } } },
      });
      assert(queueRecord?.business.logoUrl === uploadedLogoUrl, "Scenario 12: Public join query includes uploaded logo");
    }

    // ----------------------------------------------------
    // Scenario 13: Public ticket snapshot safely exposes logo
    // ----------------------------------------------------
    let trackingToken = "";
    let createdTicketId = "";
    {
      const joinRes = await joinQueue({
        businessId: bizA.id,
        queueId: qA1.id,
        customerName: "Rohan Sharma",
      });
      assert("ticket" in joinRes && Boolean(joinRes.ticket), "Customer joined queue");
      trackingToken = (joinRes as any).ticket.trackingToken;
      createdTicketId = (joinRes as any).ticket.id;

      const ticketSnap = await getPublicTicketSnapshot(bizA.id, qA1.id, trackingToken);
      assert("snapshot" in ticketSnap, "Public ticket snapshot loaded");
      if ("snapshot" in ticketSnap) {
        assert(ticketSnap.snapshot.logoUrl === uploadedLogoUrl, "Scenario 13: Ticket snapshot safely exposes logoUrl");
        assert(ticketSnap.snapshot.businessName === "Apex Diagnostics", "Scenario 13b: Ticket snapshot exposes businessName");
      }
    }

    // ----------------------------------------------------
    // Scenario 14: TV display snapshot safely exposes logo
    // ----------------------------------------------------
    {
      const displaySnap = await getPublicQueueDisplaySnapshot(bizA.id, qA1.id);
      assert("snapshot" in displaySnap && displaySnap.snapshot !== undefined, "TV display snapshot loaded");
      if ("snapshot" in displaySnap && displaySnap.snapshot !== undefined) {
        assert(displaySnap.snapshot.logoUrl === uploadedLogoUrl, "Scenario 14: TV display snapshot exposes logoUrl");
        assert(displaySnap.snapshot.businessName === "Apex Diagnostics", "Scenario 14b: TV display exposes businessName");
      }
    }

    // ----------------------------------------------------
    // Scenario 15: Oversized or invalid format logo is rejected
    // ----------------------------------------------------
    {
      // Oversized (>2MB)
      const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024);
      const hugeFile = {
        name: "huge.png",
        type: "image/png",
        size: hugeBuffer.length,
        arrayBuffer: async () => hugeBuffer.buffer,
      };
      const oversizeRes = await uploadBusinessLogo(bizA.id, hugeFile, ownerA);
      assert("error" in oversizeRes && oversizeRes.error.includes("2MB"), "Scenario 15: Oversized file (>2MB) rejected");

      // Invalid mime (PDF)
      const pdfBuffer = Buffer.from("%PDF-1.4 mock");
      const pdfFile = {
        name: "document.pdf",
        type: "application/pdf",
        size: pdfBuffer.length,
        arrayBuffer: async () => pdfBuffer.buffer,
      };
      const invalidMimeRes = await uploadBusinessLogo(bizA.id, pdfFile, ownerA);
      assert("error" in invalidMimeRes && invalidMimeRes.error.includes("format"), "Scenario 15b: Invalid format (PDF) rejected");
    }

    // ----------------------------------------------------
    // Scenario 16: Existing queue operations remain fully functional
    // ----------------------------------------------------
    {
      const callRes = await callNextTicket({ businessId: bizA.id, queueId: qA1.id }, ownerA);
      assert("ticketId" in callRes && Boolean(callRes.ticketId), "Scenario 16a: Ticket successfully called");

      const serveRes = await startServingTicket({ businessId: bizA.id, queueId: qA1.id, ticketId: createdTicketId }, ownerA);
      assert("ok" in serveRes && serveRes.ok === true, "Scenario 16b: Ticket successfully moved to serving");

      const completeRes = await completeTicket({ businessId: bizA.id, queueId: qA1.id, ticketId: createdTicketId }, ownerA);
      assert("ok" in completeRes && completeRes.ok === true, "Scenario 16c: Ticket successfully completed");
    }

    // ----------------------------------------------------
    // Scenario 17: Non-owner cannot remove logo
    // ----------------------------------------------------
    {
      const mgrRemove = await removeBusinessLogo(bizA.id, managerA);
      assert("error" in mgrRemove, "Scenario 17: Manager cannot remove logo");

      const stfRemove = await removeBusinessLogo(bizA.id, staffA);
      assert("error" in stfRemove, "Scenario 17b: Staff cannot remove logo");
    }

    // ----------------------------------------------------
    // Scenario 18: Logo removal works for owner
    // ----------------------------------------------------
    {
      const removeRes = await removeBusinessLogo(bizA.id, ownerA);
      assert("ok" in removeRes && removeRes.ok === true, "Scenario 18: Owner successfully removed logo");

      const afterRemove = await getBusinessSettings(bizA.id, ownerA);
      assert("snapshot" in afterRemove && afterRemove.snapshot.profile.logoUrl === null, "Scenario 18b: Logo is null after removal");

      const displayAfter = await getPublicQueueDisplaySnapshot(bizA.id, qA1.id);
      assert(
        "snapshot" in displayAfter &&
          displayAfter.snapshot !== undefined &&
          displayAfter.snapshot.logoUrl === null,
        "Scenario 18c: TV display reflects null logo"
      );
    }

    console.log("==========================================================");
    console.log("🎉 ALL 18 LOGO, TIMEZONE & BRANDING SCENARIOS PASSED!");
    console.log("==========================================================");
  } finally {
    // Cleanup
    console.log("Cleaning up test entities...");
    try {
      const bizIds = [bizAId, bizBId].filter(Boolean) as string[];
      if (bizIds.length > 0) {
        await prisma.staffQueueAssignment.deleteMany({ where: { queue: { businessId: { in: bizIds } } } }).catch(() => {});
        await prisma.queueEntry.deleteMany({ where: { queue: { businessId: { in: bizIds } } } }).catch(() => {});
        await prisma.queue.deleteMany({ where: { businessId: { in: bizIds } } }).catch(() => {});
        await prisma.businessMember.deleteMany({ where: { businessId: { in: bizIds } } }).catch(() => {});
        await prisma.businessSettings.deleteMany({ where: { businessId: { in: bizIds } } }).catch(() => {});
        await prisma.business.deleteMany({ where: { id: { in: bizIds } } }).catch(() => {});
      }
      const wsIds = [wsAId, wsBId].filter(Boolean) as string[];
      if (wsIds.length > 0) {
        await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } }).catch(() => {});
      }
      await prisma.user.deleteMany({
        where: { id: { in: [ownerA.id, managerA.id, staffA.id, ownerB.id, outsider.id] } },
      }).catch(() => {});
    } catch {}
    console.log("Cleanup complete.");
    await prisma.$disconnect();
  }
}

runTestSuite().catch((e) => {
  console.error("Test suite fatal error:", e);
  process.exit(1);
});
