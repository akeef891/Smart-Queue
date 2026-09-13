import { prisma } from "../src/lib/prisma";
import {
  hasSufficientRole,
  getAuthorizedBusinessForUser,
  getAuthorizedQueueForUser,
  listAccessibleBusinessesForUser,
  type BusinessRole,
} from "../src/lib/tenant";
import type { User } from "../src/generated/prisma";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function runTests() {
  console.log("--- Starting Staff & Roles Authorization Test Suite ---");

  // 1. Unit Tests: hasSufficientRole matrix
  console.log("\n[1] Testing hasSufficientRole logic matrix...");
  assert(hasSufficientRole("OWNER", "OWNER") === true, "OWNER has sufficient role for OWNER");
  assert(hasSufficientRole("OWNER", "MANAGER") === true, "OWNER has sufficient role for MANAGER");
  assert(hasSufficientRole("OWNER", "STAFF") === true, "OWNER has sufficient role for STAFF");

  assert(hasSufficientRole("MANAGER", "OWNER") === false, "MANAGER is rejected for OWNER requirement");
  assert(hasSufficientRole("MANAGER", "MANAGER") === true, "MANAGER has sufficient role for MANAGER");
  assert(hasSufficientRole("MANAGER", "STAFF") === true, "MANAGER has sufficient role for STAFF");

  assert(hasSufficientRole("STAFF", "OWNER") === false, "STAFF is rejected for OWNER requirement");
  assert(hasSufficientRole("STAFF", "MANAGER") === false, "STAFF is rejected for MANAGER requirement");
  assert(hasSufficientRole("STAFF", "STAFF") === true, "STAFF has sufficient role for STAFF");

  // 2. Integration Tests: Database Setup
  console.log("\n[2] Setting up test database entities...");
  const uniquePrefix = `test_team_${Date.now()}`;

  const ownerUser: User = await prisma.user.create({
    data: {
      id: `${uniquePrefix}_owner`,
      clerkId: `clerk_${uniquePrefix}_owner`,
      email: `${uniquePrefix}_owner@example.com`,
      displayName: "Test Owner",
    },
  });

  const managerUser: User = await prisma.user.create({
    data: {
      id: `${uniquePrefix}_mgr`,
      clerkId: `clerk_${uniquePrefix}_mgr`,
      email: `${uniquePrefix}_mgr@example.com`,
      displayName: "Test Manager",
    },
  });

  const staffUser: User = await prisma.user.create({
    data: {
      id: `${uniquePrefix}_stf`,
      clerkId: `clerk_${uniquePrefix}_stf`,
      email: `${uniquePrefix}_stf@example.com`,
      displayName: "Test Staff",
    },
  });

  const unassignedStaffUser: User = await prisma.user.create({
    data: {
      id: `${uniquePrefix}_unassigned`,
      clerkId: `clerk_${uniquePrefix}_unassigned`,
      email: `${uniquePrefix}_unassigned@example.com`,
      displayName: "Unassigned Staff",
    },
  });

  let workspaceId = "";
  let businessId = "";
  let queueAId = "";
  let queueBId = "";

  try {
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace",
        slug: `${uniquePrefix}-ws`,
        ownerId: ownerUser.id,
      },
    });
    workspaceId = workspace.id;

    const business = await prisma.business.create({
      data: {
        workspaceId: workspace.id,
        name: "Test Clinic",
        slug: `${uniquePrefix}-clinic`,
        timezone: "UTC",
      },
    });
    businessId = business.id;

    const queueA = await prisma.queue.create({
      data: {
        workspaceId: workspace.id,
        businessId: business.id,
        name: "General Queue A",
        slug: `${uniquePrefix}-qa`,
        status: "ACTIVE",
        createdById: ownerUser.id,
      },
    });
    queueAId = queueA.id;

    const queueB = await prisma.queue.create({
      data: {
        workspaceId: workspace.id,
        businessId: business.id,
        name: "Specialist Queue B",
        slug: `${uniquePrefix}-qb`,
        status: "ACTIVE",
        createdById: ownerUser.id,
      },
    });
    queueBId = queueB.id;

    // Add manager member
    await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: managerUser.id,
        email: managerUser.email,
        role: "MANAGER",
        status: "ACTIVE",
      },
    });

    // Add staff member assigned ONLY to Queue A
    const staffMember = await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: staffUser.id,
        email: staffUser.email,
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    await prisma.staffQueueAssignment.create({
      data: {
        memberId: staffMember.id,
        queueId: queueA.id,
      },
    });

    // Add unassigned staff member (assigned to 0 queues)
    await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: unassignedStaffUser.id,
        email: unassignedStaffUser.email,
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    console.log("✓ Entities and memberships created.");

    // 3. Test getAuthorizedBusinessForUser
    console.log("\n[3] Testing getAuthorizedBusinessForUser role resolution...");
    {
      const res = await getAuthorizedBusinessForUser(ownerUser, business.id, "OWNER");
      assert(res.role === "OWNER", "Owner resolves role = OWNER");
    }

    {
      const res = await getAuthorizedBusinessForUser(managerUser, business.id, "MANAGER");
      assert(res.role === "MANAGER", "Manager resolves role = MANAGER");

      let caught = false;
      try {
        await getAuthorizedBusinessForUser(managerUser, business.id, "OWNER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("requires OWNER permissions"), "Manager cannot access OWNER required endpoint");
      }
      assert(caught, "Manager blocked from minRole: OWNER");
    }

    {
      const res = await getAuthorizedBusinessForUser(staffUser, business.id, "STAFF");
      assert(res.role === "STAFF", "Staff resolves role = STAFF");
      assert(res.assignedQueueIds.length === 1 && res.assignedQueueIds[0] === queueA.id, "Staff has assigned queue A");

      let caught = false;
      try {
        await getAuthorizedBusinessForUser(staffUser, business.id, "MANAGER");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("requires MANAGER permissions"), "Staff cannot access MANAGER required endpoint (insights)");
      }
      assert(caught, "Staff blocked from minRole: MANAGER (Insights)");
    }

    // 4. Test Queue Access Authorization
    console.log("\n[4] Testing getAuthorizedQueueForUser restrictions...");
    // Owner can OPERATE and MANAGE both queues
    {
      const opA = await getAuthorizedQueueForUser(ownerUser, queueA.id, business.id, "OPERATE");
      assert(opA.role === "OWNER", "Owner can OPERATE queue A");
      const mgA = await getAuthorizedQueueForUser(ownerUser, queueA.id, business.id, "MANAGE");
      assert(mgA.role === "OWNER", "Owner can MANAGE queue A");
    }

    // Manager can OPERATE both queues, but cannot MANAGE
    {
      const opA = await getAuthorizedQueueForUser(managerUser, queueA.id, business.id, "OPERATE");
      assert(opA.role === "MANAGER", "Manager can OPERATE queue A");
      const opB = await getAuthorizedQueueForUser(managerUser, queueB.id, business.id, "OPERATE");
      assert(opB.role === "MANAGER", "Manager can OPERATE queue B");

      let caught = false;
      try {
        await getAuthorizedQueueForUser(managerUser, queueA.id, business.id, "MANAGE");
      } catch (err: any) {
        caught = true;
        assert(err.message.includes("Only business owners can modify queue settings"), "Manager cannot MANAGE queue settings");
      }
      assert(caught, "Manager blocked from MANAGE queue settings");
    }

    // Staff can OPERATE assigned queue A, but is strictly blocked from unassigned queue B
    {
      const opA = await getAuthorizedQueueForUser(staffUser, queueA.id, business.id, "OPERATE");
      assert(opA.role === "STAFF", "Staff can OPERATE assigned queue A");

      let caughtUnassigned = false;
      try {
        await getAuthorizedQueueForUser(staffUser, queueB.id, business.id, "OPERATE");
      } catch (err: any) {
        caughtUnassigned = true;
        assert(err.message.includes("You are not assigned to operate this queue"), "Staff rejected on unassigned queue B");
      }
      assert(caughtUnassigned, "Staff strictly blocked from unassigned queue B");

      let caughtManage = false;
      try {
        await getAuthorizedQueueForUser(staffUser, queueA.id, business.id, "MANAGE");
      } catch (err: any) {
        caughtManage = true;
        assert(err.message.includes("Only business owners can modify queue settings"), "Staff rejected from MANAGE");
      }
      assert(caughtManage, "Staff blocked from MANAGE queue settings");
    }

    // Unassigned staff is blocked from both queues
    {
      let caught = false;
      try {
        await getAuthorizedQueueForUser(unassignedStaffUser, queueA.id, business.id, "OPERATE");
      } catch {
        caught = true;
      }
      assert(caught, "Unassigned staff blocked from queue A");
    }

    // 5. Test listAccessibleBusinessesForUser
    console.log("\n[5] Testing listAccessibleBusinessesForUser listing...");
    {
      const ownerList = await listAccessibleBusinessesForUser(ownerUser);
      const found = ownerList.find((b) => b.id === business.id);
      assert(found !== undefined && found.role === "OWNER", "Owner lists business with role = OWNER");

      const managerList = await listAccessibleBusinessesForUser(managerUser);
      const foundMgr = managerList.find((b) => b.id === business.id);
      assert(foundMgr !== undefined && foundMgr.role === "MANAGER", "Manager lists business with role = MANAGER");

      const staffList = await listAccessibleBusinessesForUser(staffUser);
      const foundStf = staffList.find((b) => b.id === business.id);
      assert(foundStf !== undefined && foundStf.role === "STAFF", "Staff lists business with role = STAFF");
    }

    // 6. Test Invitation Auto-linking upon Login
    console.log("\n[6] Testing invite and auto-activation on login...");
    const inviteEmail = `${uniquePrefix}_invited@testcorp.com`;
    const invitedMember = await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: null,
        email: inviteEmail,
        role: "STAFF",
        status: "INVITED",
      },
    });
    assert(invitedMember.status === "INVITED" && invitedMember.userId === null, "Invite initially in INVITED status without userId");

    // Simulate invited user signs in for first time via Clerk
    const newSignedInUser: User = await prisma.user.create({
      data: {
        id: `${uniquePrefix}_newly_signed_in`,
        clerkId: `clerk_${uniquePrefix}_newly_signed_in`,
        email: inviteEmail,
        displayName: "Newly Joined Staff",
      },
    });

    // When the user accesses the business, getAuthorizedBusinessForUser auto-links and activates
    const authRes = await getAuthorizedBusinessForUser(newSignedInUser, business.id, "STAFF");
    assert(authRes.role === "STAFF", "Invited user resolves role = STAFF");

    const reloadedMember = await prisma.businessMember.findUnique({
      where: { id: invitedMember.id },
    });
    assert(
      reloadedMember?.status === "ACTIVE" && reloadedMember?.userId === newSignedInUser.id,
      "Invited member record automatically upgraded to ACTIVE and linked to userId upon login"
    );

    // Clean up newly created user
    await prisma.user.delete({ where: { id: newSignedInUser.id } });

    console.log("\n✅ All 6 Staff & Roles test suites passed successfully!");
  } finally {
    // Cleanup
    console.log("\nCleaning up test entities...");
    if (businessId) {
      await prisma.staffQueueAssignment.deleteMany({
        where: { queue: { businessId } },
      });
      await prisma.businessMember.deleteMany({
        where: { businessId },
      });
      await prisma.queue.deleteMany({
        where: { businessId },
      });
      await prisma.business.deleteMany({
        where: { id: businessId },
      });
    }
    if (workspaceId) {
      await prisma.workspace.deleteMany({
        where: { id: workspaceId },
      });
    }
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            ownerUser.id,
            managerUser.id,
            staffUser.id,
            unassignedStaffUser.id,
          ],
        },
      },
    });
    console.log("Cleanup complete.");
  }
}

runTests().catch((err) => {
  console.error("Test failed with unhandled error:", err);
  process.exit(1);
});
