import { prisma } from "../src/lib/prisma";
import type { User } from "../src/generated/prisma";
import {
  getBusinessSettings,
  updateBusinessProfile,
  updateQueueDefaults,
  updateCustomerExperience,
  updateDisplaySettings,
  updateOperatingHours,
  pauseAllQueues,
  archiveBusiness,
  deleteBusiness,
} from "../src/lib/actions/settings";
import {
  joinQueue,
  leaveQueue,
  getPublicTicketSnapshot,
  getPublicQueueDisplaySnapshot,
} from "../src/lib/actions/ticket";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runSettingsTestSuite() {
  console.log("==========================================================");
  console.log("SMART QUEUE — BUSINESS SETTINGS & CONFIGURATION TEST SUITE");
  console.log("==========================================================");

  const pfx = `test_set_${Date.now()}`;

  // 1. Create Users
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
  let qA2Id = "";

  try {
    // ----------------------------------------------------
    // SETUP TENANT A (Business Alpha with Queues A1 & A2)
    // ----------------------------------------------------
    const wsA = await prisma.workspace.create({
      data: { name: "Workspace A", slug: `${pfx}-wsa`, ownerId: ownerA.id },
    });
    wsAId = wsA.id;

    const bizA = await prisma.business.create({
      data: {
        workspaceId: wsA.id,
        name: "Clinic Alpha",
        slug: `${pfx}-biza`,
        type: "CLINIC",
        timezone: "UTC",
      },
    });
    bizAId = bizA.id;

    const qA1 = await prisma.queue.create({
      data: {
        workspaceId: wsA.id,
        businessId: bizA.id,
        name: "Doctor Consultation",
        slug: `${pfx}-qa1`,
        createdById: ownerA.id,
      },
    });
    qA1Id = qA1.id;

    const qA2 = await prisma.queue.create({
      data: {
        workspaceId: wsA.id,
        businessId: bizA.id,
        name: "Lab & Diagnostics",
        slug: `${pfx}-qa2`,
        createdById: ownerA.id,
      },
    });
    qA2Id = qA2.id;

    // Add Manager A to Business A
    await prisma.businessMember.create({
      data: {
        businessId: bizA.id,
        userId: managerA.id,
        email: managerA.email,
        role: "MANAGER",
        status: "ACTIVE",
      },
    });

    // Add Staff A to Business A assigned to Queue A1
    const staffMemberA = await prisma.businessMember.create({
      data: {
        businessId: bizA.id,
        userId: staffA.id,
        email: staffA.email,
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    await prisma.staffQueueAssignment.create({
      data: { memberId: staffMemberA.id, queueId: qA1.id },
    });

    // ----------------------------------------------------
    // SETUP TENANT B (Business Beta)
    // ----------------------------------------------------
    const wsB = await prisma.workspace.create({
      data: { name: "Workspace B", slug: `${pfx}-wsb`, ownerId: ownerB.id },
    });
    wsBId = wsB.id;

    const bizB = await prisma.business.create({
      data: {
        workspaceId: wsB.id,
        name: "Salon Beta",
        slug: `${pfx}-bizb`,
        type: "SALON",
        timezone: "UTC",
      },
    });
    bizBId = bizB.id;

    console.log("✓ Test fixtures created.\n");

    // -------------------------------------------------------------------------
    // Scenario 1: OWNER can read settings
    // -------------------------------------------------------------------------
    {
      const res = await getBusinessSettings(bizA.id, ownerA);
      if (!("snapshot" in res) || !res.snapshot) throw new Error("Missing snapshot");
      assert(res.snapshot.profile.name === "Clinic Alpha", "Owner reads correct business name");
      assert(res.snapshot.userRole === "OWNER", "Owner role resolved as OWNER");
      assert(res.snapshot.queueDefaults.defaultServiceTime === 10, "Default service time initialized");
    }

    // -------------------------------------------------------------------------
    // Scenario 2: OWNER can update business profile
    // -------------------------------------------------------------------------
    {
      const res = await updateBusinessProfile(
        bizA.id,
        {
          name: "Alpha Medical Center",
          type: "HOSPITAL",
          description: "Top healthcare center",
          phone: "+1 555-123-4567",
          email: "contact@alphamed.com",
          address: "456 Health Ave, New York, NY",
          logoUrl: "https://example.com/logo.png",
          timezone: "America/New_York",
        },
        ownerA
      );
      assert("ok" in res && res.ok === true, "Scenario 2: OWNER can update business profile");

      const check = await prisma.business.findUnique({ where: { id: bizA.id } });
      assert(check?.name === "Alpha Medical Center", "Business name updated in PostgreSQL");
      assert(check?.type === "HOSPITAL", "Business type updated in PostgreSQL");
      assert(check?.email === "contact@alphamed.com", "Business email updated in PostgreSQL");
    }

    // -------------------------------------------------------------------------
    // Scenario 3: OWNER can update queue defaults
    // -------------------------------------------------------------------------
    {
      const res = await updateQueueDefaults(
        bizA.id,
        {
          defaultQueueName: "Standard Line",
          defaultServiceTime: 15,
          maxQueueCapacity: 50,
          allowCustomerLeave: false, // Disabling customer leave
          allowCustomerRejoin: true,
          autoExpireStaleTickets: true,
          noShowHandling: "AUTO_CANCEL",
        },
        ownerA
      );
      assert("ok" in res && res.ok === true, "Scenario 3: OWNER can update queue defaults");

      const check = await prisma.businessSettings.findUnique({ where: { businessId: bizA.id } });
      assert(check?.defaultServiceTime === 15, "Queue default service time persisted");
      assert(check?.maxQueueCapacity === 50, "Queue default max capacity persisted");
      assert(check?.allowCustomerLeave === false, "allowCustomerLeave persisted as false");
    }

    // -------------------------------------------------------------------------
    // Scenario 4: OWNER can update customer experience settings
    // -------------------------------------------------------------------------
    {
      const res = await updateCustomerExperience(
        bizA.id,
        {
          welcomeMessage: "Welcome to Alpha Medical Center. Please join our queue.",
          queueInstructions: "Please watch the TV display above counter 1.",
          enableNotifications: false, // Disabling notifications
          enableQrJoin: false,
          allowCustomerLeave: false,
        },
        ownerA
      );
      assert("ok" in res && res.ok === true, "Scenario 4: OWNER can update customer experience settings");

      const check = await prisma.businessSettings.findUnique({ where: { businessId: bizA.id } });
      assert(check?.welcomeMessage?.includes("Alpha Medical Center") === true, "Welcome message persisted");
      assert(check?.enableNotifications === false, "Notifications toggle persisted");
    }

    // -------------------------------------------------------------------------
    // Scenario 5: OWNER can update display settings
    // -------------------------------------------------------------------------
    {
      const res = await updateDisplaySettings(
        bizA.id,
        {
          displayTitle: "Alpha Main Hall Display",
          showQrCode: false,
          showCurrentlyServing: true,
          showWaitingCount: true,
          brandingText: "Alpha Healthcare Network",
          soundAlertEnabled: true,
        },
        ownerA
      );
      assert("ok" in res && res.ok === true, "Scenario 5: OWNER can update display settings");

      const check = await prisma.businessSettings.findUnique({ where: { businessId: bizA.id } });
      assert(check?.displayTitle === "Alpha Main Hall Display", "Display title persisted");
      assert(check?.showQrCode === false, "QR code toggle persisted");
      assert(check?.brandingText === "Alpha Healthcare Network", "Branding text persisted");
    }

    // -------------------------------------------------------------------------
    // Scenario 6: OWNER can update operating hours
    // -------------------------------------------------------------------------
    {
      const customHours = {
        monday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
        tuesday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
        wednesday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
        thursday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
        friday: { isOpen: true, openTime: "08:00", closeTime: "15:00" },
        saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
        sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
      };

      const res = await updateOperatingHours(bizA.id, customHours, ownerA);
      assert("ok" in res && res.ok === true, "Scenario 6: OWNER can update operating hours");

      const check = await prisma.businessSettings.findUnique({ where: { businessId: bizA.id } });
      const savedHours = check?.operatingHours as any;
      assert(savedHours?.monday?.openTime === "08:00", "Operating hours persisted");
      assert(savedHours?.saturday?.isOpen === false, "Closed day schedule persisted");
    }

    // -------------------------------------------------------------------------
    // Scenario 7: OWNER can execute danger-zone pause all queues
    // -------------------------------------------------------------------------
    {
      const res = await pauseAllQueues(bizA.id, ownerA);
      if (!("count" in res)) throw new Error("Missing count in pauseAllQueues response");
      assert(res.count === 2, "All 2 queues were paused");

      const q1 = await prisma.queue.findUnique({ where: { id: qA1.id } });
      const q2 = await prisma.queue.findUnique({ where: { id: qA2.id } });
      assert(q1?.status === "PAUSED", "Queue 1 status is PAUSED");
      assert(q2?.status === "PAUSED", "Queue 2 status is PAUSED");

      // Resume queue 1 for subsequent tests
      await prisma.queue.update({ where: { id: qA1.id }, data: { status: "ACTIVE" } });
    }

    // -------------------------------------------------------------------------
    // Scenario 8: MANAGER cannot perform OWNER-only mutations
    // -------------------------------------------------------------------------
    {
      // 8a: Manager can read settings in read-only mode
      const readRes = await getBusinessSettings(bizA.id, managerA);
      if (!("snapshot" in readRes) || !readRes.snapshot) throw new Error("Missing manager snapshot");
      assert(readRes.snapshot.userRole === "MANAGER", "Manager role correctly resolved");

      // 8b: Manager cannot update profile
      const profRes = await updateBusinessProfile(bizA.id, { name: "Hacked by Manager", type: "CLINIC" }, managerA);
      assert("error" in profRes, "Scenario 8 Passed: Manager blocked from updating business profile");

      // 8c: Manager cannot update queue defaults
      const queueRes = await updateQueueDefaults(bizA.id, { defaultQueueName: "Hacked", defaultServiceTime: 10, allowCustomerLeave: true, allowCustomerRejoin: false, autoExpireStaleTickets: false, noShowHandling: "MANUAL" }, managerA);
      assert("error" in queueRes, "Manager blocked from updating queue defaults");

      // 8d: Manager cannot pause all queues (danger zone)
      const pauseRes = await pauseAllQueues(bizA.id, managerA);
      assert("error" in pauseRes, "Manager blocked from danger zone operations");
    }

    // -------------------------------------------------------------------------
    // Scenario 9: STAFF cannot access settings (read or write)
    // -------------------------------------------------------------------------
    {
      const staffRead = await getBusinessSettings(bizA.id, staffA);
      assert("error" in staffRead, "Scenario 9 Passed: Staff blocked from reading business settings");

      const staffWrite = await updateBusinessProfile(bizA.id, { name: "Staff Update", type: "CLINIC" }, staffA);
      assert("error" in staffWrite, "Staff blocked from updating business profile");
    }

    // -------------------------------------------------------------------------
    // Scenario 10: Non-member cannot access settings
    // -------------------------------------------------------------------------
    {
      const outRead = await getBusinessSettings(bizA.id, outsider);
      assert("error" in outRead, "Scenario 10 Passed: Non-member rejected from reading settings");

      const outWrite = await updateBusinessProfile(bizA.id, { name: "Outsider Update", type: "CLINIC" }, outsider);
      assert("error" in outWrite, "Non-member rejected from modifying settings");
    }

    // -------------------------------------------------------------------------
    // Scenario 11: Cross-business isolation (Tenant B cannot modify Tenant A)
    // -------------------------------------------------------------------------
    {
      const crossWrite = await updateBusinessProfile(
        bizA.id,
        { name: "Tenant B Overwrite", type: "SALON" },
        ownerB
      );
      assert("error" in crossWrite, "Scenario 11 Passed: Cross-tenant Owner B cannot modify Business A settings");
    }

    // -------------------------------------------------------------------------
    // Scenario 12: Invalid business ID safely rejected
    // -------------------------------------------------------------------------
    {
      const invRes = await getBusinessSettings("invalid_biz_id_999", ownerA);
      assert("error" in invRes, "Scenario 12 Passed: Invalid business ID safely rejected");
    }

    // -------------------------------------------------------------------------
    // Scenario 13: Invalid setting values rejected by Zod validation
    // -------------------------------------------------------------------------
    {
      // 13a: Negative service time
      const badTimeRes = await updateQueueDefaults(
        bizA.id,
        {
          defaultQueueName: "Line",
          defaultServiceTime: -5,
          allowCustomerLeave: true,
          allowCustomerRejoin: false,
          autoExpireStaleTickets: false,
          noShowHandling: "MANUAL",
        },
        ownerA
      );
      assert("error" in badTimeRes, "Negative service time rejected");

      // 13b: Invalid operating hours (closing before opening)
      const badHoursRes = await updateOperatingHours(
        bizA.id,
        {
          monday: { isOpen: true, openTime: "17:00", closeTime: "09:00" }, // Invalid!
          tuesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
          wednesday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
          thursday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
          friday: { isOpen: true, openTime: "09:00", closeTime: "17:00" },
          saturday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
          sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
        },
        ownerA
      );
      assert("error" in badHoursRes, "Scenario 13 Passed: Invalid operating hours rejected by validation");
    }

    // -------------------------------------------------------------------------
    // Scenario 14: Existing queue behavior respects allowCustomerLeave: false
    // -------------------------------------------------------------------------
    {
      // Join a customer to Queue A1
      const joinRes = await joinQueue({
        businessId: bizA.id,
        queueId: qA1.id,
        customerName: "Alice Walker",
      });
      if (!("ticket" in joinRes) || !joinRes.ticket) {
        throw new Error("Customer failed to join queue in test");
      }
      const trackingToken = joinRes.ticket.trackingToken;

      // Since allowCustomerLeave is false in Business A settings, leaveQueue must be rejected!
      const leaveRes = await leaveQueue({
        businessId: bizA.id,
        queueId: qA1.id,
        trackingToken,
      });

      if (!("error" in leaveRes)) throw new Error("Expected error in leaveRes");
      assert(
        leaveRes.error.includes("Leaving the queue has been disabled") === true,
        "Scenario 14 Passed: Existing leaveQueue strictly respects allowCustomerLeave: false"
      );
    }

    // -------------------------------------------------------------------------
    // Scenario 15: Existing customer join respects business maxQueueCapacity
    // -------------------------------------------------------------------------
    {
      // Set maxQueueCapacity = 1 in business settings
      await prisma.businessSettings.update({
        where: { businessId: bizA.id },
        data: { maxQueueCapacity: 1 },
      });

      // There is already 1 customer (Alice) waiting in Queue A1. Second customer joining should be rejected!
      const secondJoin = await joinQueue({
        businessId: bizA.id,
        queueId: qA1.id,
        customerName: "Bob Runner",
      });

      if (!("error" in secondJoin) || typeof secondJoin.error !== "string") {
        throw new Error("Expected error in secondJoin");
      }
      assert(
        secondJoin.error.includes("queue is currently full") === true,
        "Scenario 15 Passed: Existing joinQueue strictly enforces business maxQueueCapacity"
      );
    }

    // -------------------------------------------------------------------------
    // Scenario 16: Existing TV display snapshot reflects configured display settings
    // -------------------------------------------------------------------------
    {
      const displaySnap = await getPublicQueueDisplaySnapshot(bizA.id, qA1.id);
      if (!("snapshot" in displaySnap) || !displaySnap.snapshot) throw new Error("Missing display snapshot");
      assert(displaySnap.snapshot.displayTitle === "Alpha Main Hall Display", "Snapshot reflects configured displayTitle");
      assert(displaySnap.snapshot.showQrCode === false, "Snapshot reflects configured showQrCode");
      assert(displaySnap.snapshot.brandingText === "Alpha Healthcare Network", "Scenario 16 Passed: Snapshot reflects configured brandingText");
    }

    // -------------------------------------------------------------------------
    // Scenario 17: Existing customer ticket snapshot reflects customer experience settings
    // -------------------------------------------------------------------------
    {
      const entry = await prisma.queueEntry.findFirst({
        where: { queueId: qA1.id },
      });
      assert(entry !== null, "Queue entry found");

      const ticketSnap = await getPublicTicketSnapshot(bizA.id, qA1.id, entry!.trackingToken);
      if (!("snapshot" in ticketSnap) || !ticketSnap.snapshot) throw new Error("Missing ticket snapshot");
      assert(ticketSnap.snapshot.allowCustomerLeave === false, "Ticket snapshot reflects allowCustomerLeave: false");
      assert(ticketSnap.snapshot.enableNotifications === false, "Scenario 17 Passed: Ticket snapshot reflects enableNotifications: false");
    }

    // -------------------------------------------------------------------------
    // Scenario 18: Danger zone deleteBusiness cleans up all relations safely
    // -------------------------------------------------------------------------
    {
      const delRes = await deleteBusiness(bizB.id, ownerB);
      assert("ok" in delRes && delRes.ok === true, "Scenario 18 Passed: OWNER can safely delete business");

      const checkBizB = await prisma.business.findUnique({ where: { id: bizB.id } });
      assert(checkBizB === null, "Business B deleted from PostgreSQL");
      bizBId = ""; // Marked deleted
    }

    console.log("\n==========================================================");
    console.log("🎉 ALL 18 BUSINESS SETTINGS & CONFIGURATION SCENARIOS PASSED!");
    console.log("==========================================================");
  } finally {
    console.log("\nCleaning up test entities...");
    const bizIds = [bizAId, bizBId].filter(Boolean);
    const wsIds = [wsAId, wsBId].filter(Boolean);

    for (const bId of bizIds) {
      await prisma.staffQueueAssignment.deleteMany({ where: { queue: { businessId: bId } } });
      await prisma.queueEntry.deleteMany({ where: { queue: { businessId: bId } } });
      await prisma.businessSettings.deleteMany({ where: { businessId: bId } });
      await prisma.businessMember.deleteMany({ where: { businessId: bId } });
      await prisma.queue.deleteMany({ where: { businessId: bId } });
      await prisma.business.deleteMany({ where: { id: bId } });
    }

    for (const wId of wsIds) {
      await prisma.workspace.deleteMany({ where: { id: wId } });
    }

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ownerA.id, managerA.id, staffA.id, ownerB.id, outsider.id],
        },
      },
    });
    console.log("Cleanup complete.");
  }
}

runSettingsTestSuite().catch((err) => {
  console.error("Settings Test Suite Error:", err);
  process.exit(1);
});
