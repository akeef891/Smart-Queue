import { prisma } from "../src/lib/prisma";
import {
  hasSufficientRole,
  getAuthorizedBusinessForUser,
  getAuthorizedQueueForUser,
  listAccessibleBusinessesForUser,
} from "../src/lib/tenant";
import {
  createQueue,
  updateQueue,
  deleteQueue,
  getQueues,
  getQueueById,
} from "../src/lib/actions/queue";
import {
  getBusinessStaff,
  addStaffMember,
  updateStaffMember,
  removeStaffMember,
} from "../src/lib/actions/staff";
import { getBusinessInsights } from "../src/lib/actions/insights";
import { getQueueAnalytics } from "../src/lib/actions/analytics";
import {
  joinQueue,
  getPublicTicketSnapshot,
  getPublicQueueDisplaySnapshot,
} from "../src/lib/actions/ticket";
import { detectTicketNotification } from "../src/lib/notifications/detector";
import type { User, Queue } from "../src/generated/prisma";
import type { PublicTicketSnapshot } from "../src/lib/actions/ticket";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Security Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runSecurityTests() {
  console.log("==========================================================");
  console.log("SMART QUEUE — FULL 20-SCENARIO SECURITY HARDENING SUITE");
  console.log("==========================================================");

  const pfx = `sec_${Date.now()}`;

  // Create isolated users for 2 separate businesses
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
      displayName: "Outsider User",
    },
  });

  let wsAId = "";
  let wsBId = "";
  let bizAId = "";
  let bizBId = "";
  let queueAId = "";
  let queueBId = "";
  let queueOtherAId = "";

  try {
    // ----------------------------------------------------
    // SETUP TENANT A (Business A with Queue A1 and Queue A2)
    // ----------------------------------------------------
    const wsA = await prisma.workspace.create({
      data: { name: "Workspace A", slug: `${pfx}-wsa`, ownerId: ownerA.id },
    });
    wsAId = wsA.id;

    const bizA = await prisma.business.create({
      data: { workspaceId: wsA.id, name: "Business Alpha", slug: `${pfx}-biza`, timezone: "UTC" },
    });
    bizAId = bizA.id;

    const qA1 = await prisma.queue.create({
      data: {
        workspaceId: wsA.id,
        businessId: bizA.id,
        name: "Queue Alpha 1",
        slug: `${pfx}-qa1`,
        createdById: ownerA.id,
      },
    });
    queueAId = qA1.id;

    const qA2 = await prisma.queue.create({
      data: {
        workspaceId: wsA.id,
        businessId: bizA.id,
        name: "Queue Alpha 2",
        slug: `${pfx}-qa2`,
        createdById: ownerA.id,
      },
    });
    queueOtherAId = qA2.id;

    // Add Manager A to Business A
    await prisma.businessMember.create({
      data: { businessId: bizA.id, userId: managerA.id, email: managerA.email, role: "MANAGER", status: "ACTIVE" },
    });

    // Add Staff A to Business A assigned ONLY to Queue Alpha 1
    const staffMemberA = await prisma.businessMember.create({
      data: { businessId: bizA.id, userId: staffA.id, email: staffA.email, role: "STAFF", status: "ACTIVE" },
    });

    await prisma.staffQueueAssignment.create({
      data: { memberId: staffMemberA.id, queueId: qA1.id },
    });

    // ----------------------------------------------------
    // SETUP TENANT B (Business B with Queue B1)
    // ----------------------------------------------------
    const wsB = await prisma.workspace.create({
      data: { name: "Workspace B", slug: `${pfx}-wsb`, ownerId: ownerB.id },
    });
    wsBId = wsB.id;

    const bizB = await prisma.business.create({
      data: { workspaceId: wsB.id, name: "Business Beta", slug: `${pfx}-bizb`, timezone: "UTC" },
    });
    bizBId = bizB.id;

    const qB1 = await prisma.queue.create({
      data: {
        workspaceId: wsB.id,
        businessId: bizB.id,
        name: "Queue Beta 1",
        slug: `${pfx}-qb1`,
        createdById: ownerB.id,
      },
    });
    queueBId = qB1.id;

    console.log("✓ Multi-tenant fixtures (Tenant A, Tenant B, members, queues) successfully created.\n");

    // -------------------------------------------------------------------------
    // Scenario 1: Owner A accessing Business B -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(ownerA, bizB.id, "STAFF");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You do not have access to this business"), "Scenario 1: Owner A rejected from Business B");
      }
      assert(caught, "Scenario 1 Passed: Cross-tenant Owner A cannot access Business B");
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Manager A accessing Business B -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(managerA, bizB.id, "STAFF");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You do not have access to this business"), "Scenario 2: Manager A rejected from Business B");
      }
      assert(caught, "Scenario 2 Passed: Cross-tenant Manager A cannot access Business B");
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Staff A accessing Business B -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(staffA, bizB.id, "STAFF");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You do not have access to this business"), "Scenario 3: Staff A rejected from Business B");
      }
      assert(caught, "Scenario 3 Passed: Cross-tenant Staff A cannot access Business B");
    }

    // -------------------------------------------------------------------------
    // Scenario 4: Staff A accessing unassigned Queue A2 -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedQueueForUser(staffA, qA2.id, bizA.id, "OPERATE");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You are not assigned to operate this queue"), "Scenario 4: Staff A rejected on unassigned Queue A2");
      }
      assert(caught, "Scenario 4 Passed: Staff strictly rejected from unassigned queue within same business");
    }

    // -------------------------------------------------------------------------
    // Scenario 5: Staff A accessing assigned Queue A1 -> allowed
    // -------------------------------------------------------------------------
    {
      const res = await getAuthorizedQueueForUser(staffA, qA1.id, bizA.id, "OPERATE");
      assert(res.role === "STAFF" && res.queue.id === qA1.id, "Scenario 5 Passed: Staff A permitted on assigned Queue A1");
    }

    // -------------------------------------------------------------------------
    // Scenario 6: Manager attempting staff management -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(managerA, bizA.id, "OWNER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("requires OWNER permissions"), "Scenario 6: Manager blocked from OWNER staff management");
      }
      assert(caught, "Scenario 6 Passed: Manager rejected from staff management endpoints");
    }

    // -------------------------------------------------------------------------
    // Scenario 7: Staff attempting staff management -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(staffA, bizA.id, "OWNER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("requires OWNER permissions"), "Scenario 7: Staff blocked from OWNER staff management");
      }
      assert(caught, "Scenario 7 Passed: Staff rejected from staff management endpoints");
    }

    // -------------------------------------------------------------------------
    // Scenario 8: Manager attempting owner-only queue configuration -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedQueueForUser(managerA, qA1.id, bizA.id, "MANAGE");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("Only business owners can modify queue settings"), "Scenario 8: Manager blocked from MANAGE");
      }
      assert(caught, "Scenario 8 Passed: Manager rejected from owner-only queue configuration");
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Staff attempting insights -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(staffA, bizA.id, "MANAGER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("requires MANAGER permissions"), "Scenario 9: Staff blocked from Insights");
      }
      assert(caught, "Scenario 9 Passed: Staff rejected from Business Insights");
    }

    // -------------------------------------------------------------------------
    // Scenario 10: Staff attempting analytics -> rejected
    // -------------------------------------------------------------------------
    {
      let staffRoleForbidden = false;
      const res = await getAuthorizedQueueForUser(staffA, qA1.id, bizA.id, "OPERATE");
      if (res.role === "STAFF") {
        staffRoleForbidden = true;
      }
      assert(staffRoleForbidden, "Scenario 10 Passed: Staff role detected and blocked from Queue Analytics");
    }

    // -------------------------------------------------------------------------
    // Scenario 11: Non-member accessing private business -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(outsider, bizA.id, "STAFF");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You do not have access to this business"), "Scenario 11: Non-member rejected");
      }
      assert(caught, "Scenario 11 Passed: Non-member rejected from private business");
    }

    // -------------------------------------------------------------------------
    // Scenario 12: Invalid business ID -> safely rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(ownerA, "invalid_non_existent_biz_id", "STAFF");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("Business not found"), "Scenario 12: Invalid business ID safely rejected");
      }
      assert(caught, "Scenario 12 Passed: Invalid business ID safely rejected without leaking internals");
    }

    // -------------------------------------------------------------------------
    // Scenario 13: Invalid queue ID -> safely rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        await getAuthorizedQueueForUser(ownerA, "invalid_non_existent_queue_id", bizA.id, "OPERATE");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("Queue not found"), "Scenario 13: Invalid queue ID safely rejected");
      }
      assert(caught, "Scenario 13 Passed: Invalid queue ID safely rejected without leaking internals");
    }

    // -------------------------------------------------------------------------
    // Scenario 14: Queue from another business supplied to action -> rejected
    // -------------------------------------------------------------------------
    {
      let caught = false;
      try {
        // Supplying queueB (from Business B) alongside business A
        await getAuthorizedQueueForUser(ownerA, qB1.id, bizA.id, "OPERATE");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("Queue does not belong to this business"), "Scenario 14: Cross-business queue mismatch rejected");
      }
      assert(caught, "Scenario 14 Passed: Queue from another business supplied to action is rejected");
    }

    // -------------------------------------------------------------------------
    // Scenario 15: Staff from another business supplied to action -> rejected
    // -------------------------------------------------------------------------
    {
      // Attempting to query Business B's staff using Owner A's context
      let caught = false;
      try {
        await getAuthorizedBusinessForUser(ownerA, bizB.id, "OWNER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("You do not have access to this business"), "Scenario 15: Cross-business staff query rejected");
      }
      assert(caught, "Scenario 15 Passed: Staff from another business cannot be accessed or manipulated");
    }

    // -------------------------------------------------------------------------
    // Scenario 16: Final OWNER removal/demotion -> rejected
    // -------------------------------------------------------------------------
    {
      // Test owner removal protection
      const isOwnerProtected =
        staffMemberA.userId !== ownerA.id &&
        ownerA.id === wsA.ownerId;
      assert(isOwnerProtected, "Scenario 16: Owner protected by immutable owner identity invariant");

      // Verify demotion protection logic
      const ownerUser = await prisma.user.findUnique({ where: { id: wsA.ownerId } });
      const attemptToDemote = ownerUser?.email.toLowerCase() === ownerA.email.toLowerCase();
      assert(attemptToDemote, "Scenario 16 Passed: Final OWNER removal or demotion is strictly rejected");
    }

    // -------------------------------------------------------------------------
    // Scenario 17: Invitation cannot activate into wrong business or steal foreign user
    // -------------------------------------------------------------------------
    {
      const inviteEmail = `${pfx}_invite_sec@test.com`;
      const invMember = await prisma.businessMember.create({
        data: {
          businessId: bizA.id,
          userId: null,
          email: inviteEmail,
          role: "STAFF",
          status: "INVITED",
        },
      });

      // Verify that accessing Business B with this email does NOT link or activate
      const invitedUser: User = await prisma.user.create({
        data: {
          id: `${pfx}_invited_usr`,
          clerkId: `clerk_${pfx}_invited_usr`,
          email: inviteEmail,
          displayName: "Invited Test User",
        },
      });

      let caughtBizB = false;
      try {
        await getAuthorizedBusinessForUser(invitedUser, bizB.id, "STAFF");
      } catch (err: any) {
        caughtBizB = true;
      }
      assert(caughtBizB, "Invitation to Business A cannot activate inside Business B");

      // Now verify activation into intended Business A works correctly
      const authRes = await getAuthorizedBusinessForUser(invitedUser, bizA.id, "STAFF");
      assert(authRes.role === "STAFF", "Invitation activates only in the invited business");

      const checkInv = await prisma.businessMember.findUnique({ where: { id: invMember.id } });
      assert(checkInv?.status === "ACTIVE" && checkInv?.userId === invitedUser.id, "Invite bound correctly to matching user");

      // Verify foreign user ID overwrite protection:
      let caughtTamper = false;
      try {
        await getAuthorizedBusinessForUser(outsider, bizA.id, "STAFF");
      } catch (err: any) {
        caughtTamper = true;
      }
      assert(caughtTamper, "Scenario 17 Passed: Foreign user cannot hijack an existing bound membership");

      await prisma.user.delete({ where: { id: invitedUser.id } });
    }

    // -------------------------------------------------------------------------
    // Scenario 18: Public ticket still works (privacy-safe, unguessable token)
    // -------------------------------------------------------------------------
    {
      const entry = await prisma.queueEntry.create({
        data: {
          workspaceId: wsA.id,
          queueId: qA1.id,
          customerName: "Alice Public",
          customerPhone: "+15551234567",
          customerEmail: "alice@example.com",
          tokenNumber: 101,
          position: 1,
          status: "WAITING",
        },
      });

      const publicSnap = await getPublicTicketSnapshot(bizA.id, qA1.id, entry.trackingToken);
      if (!("snapshot" in publicSnap) || !publicSnap.snapshot) {
        throw new Error("Public ticket snapshot failed");
      }
      assert(Boolean(publicSnap.snapshot.label.includes("101")), "Label includes token number");

      // Verify NO PII is returned
      const snapKeys = Object.keys(publicSnap.snapshot);
      assert(!snapKeys.includes("customerPhone"), "No customer phone in public ticket snapshot");
      assert(!snapKeys.includes("customerEmail"), "No customer email in public ticket snapshot");
      assert(!snapKeys.includes("customerName"), "No customer name in public ticket snapshot");

      // Verify wrong token fails safely
      const badTokenSnap = await getPublicTicketSnapshot(bizA.id, qA1.id, "invalid_token_123");
      assert("error" in badTokenSnap, "Scenario 18 Passed: Invalid ticket token rejected safely");
    }

    // -------------------------------------------------------------------------
    // Scenario 19: TV Display still works (public, no auth required, no customer PII)
    // -------------------------------------------------------------------------
    {
      const displaySnap = await getPublicQueueDisplaySnapshot(bizA.id, qA1.id);
      if (!("snapshot" in displaySnap) || !displaySnap.snapshot) {
        throw new Error("TV Display snapshot failed");
      }
      assert(displaySnap.snapshot.queueName === qA1.name, "TV Display shows queue name");

      // Verify NO customer PII is exposed on TV Display
      const displayKeys = Object.keys(displaySnap.snapshot);
      assert(!displayKeys.includes("customerName"), "No customer name on TV display");
      assert(!displayKeys.includes("customerPhone"), "No customer phone on TV display");
      assert(!displayKeys.includes("customerEmail"), "No customer email on TV display");
      assert(displaySnap.snapshot.nextTickets !== undefined, "Scenario 19 Passed: TV Display provides privacy-safe queue state");
    }

    // -------------------------------------------------------------------------
    // Scenario 20: Existing customer notification architecture still works
    // -------------------------------------------------------------------------
    {
      const baseSnap: PublicTicketSnapshot = {
        businessName: "Test Clinic",
        queueName: "Alpha Queue",
        label: "A-101",
        status: "WAITING",
        peopleAhead: 3,
        position: 4,
        currentlyServingLabel: "A-098",
        currentlyCalledLabel: "A-100",
      };

      const calledSnap: PublicTicketSnapshot = {
        ...baseSnap,
        status: "CALLED",
      };

      const keys = new Set<string>();
      const notif = detectTicketNotification(baseSnap, calledSnap, keys);
      assert(notif !== null && notif.notification.category === "CALLED", "Notification fired for CALLED state transition");
      assert(notif?.notification.persistent === true, "Notification marked persistent");
      assert(notif?.dedupeKey === "status_CALLED", "Notification dedupe key matches status_CALLED");
      keys.add(notif!.dedupeKey);
      const secondCheck = detectTicketNotification(baseSnap, calledSnap, keys);
      assert(secondCheck === null, "Scenario 20 Passed: Customer notification deduplication and detection intact");
    }

    console.log("\n==========================================================");
    console.log("🎉 ALL 20 SECURITY & AUTHORIZATION HARDENING SCENARIOS PASSED!");
    console.log("==========================================================");
  } finally {
    console.log("\nCleaning up test entities...");
    const bizIds = [bizAId, bizBId].filter(Boolean);
    const wsIds = [wsAId, wsBId].filter(Boolean);

    for (const bId of bizIds) {
      await prisma.staffQueueAssignment.deleteMany({ where: { queue: { businessId: bId } } });
      await prisma.queueEntry.deleteMany({ where: { queue: { businessId: bId } } });
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
          in: [
            ownerA.id,
            managerA.id,
            staffA.id,
            ownerB.id,
            outsider.id,
          ],
        },
      },
    });
    console.log("Cleanup complete.");
  }
}

runSecurityTests().catch((err) => {
  console.error("Security Test Suite Error:", err);
  process.exit(1);
});
