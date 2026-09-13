"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, AuthError } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { notifyQueueChanged } from "@/lib/realtime-notify";
import { createClient } from "@supabase/supabase-js";
import { getBrowserSupabaseUrl } from "@/lib/realtime-channel";
import { getServerSupabaseKey } from "@/lib/realtime-server";
import type { User } from "@/generated/prisma";
import {
  businessProfileSchema,
  queueDefaultsSchema,
  customerExperienceSchema,
  displaySettingsSchema,
  operatingHoursSchema,
} from "@/lib/validations/settings";
import {
  DEFAULT_OPERATING_HOURS,
  type BusinessSettingsSnapshot,
  type WeeklyOperatingHours,
} from "@/lib/settings-types";

function mapError(err: unknown, actionName: string): { error: string } {
  if (err instanceof AuthError) {
    if (err.code === "UNAUTHENTICATED") {
      return { error: "Please sign in to continue." };
    }
    return { error: "You do not have permission to modify these settings." };
  }
  if (err instanceof Error) {
    return { error: err.message };
  }
  console.error(`[settings] ${actionName} error:`, err);
  return { error: "An unexpected error occurred. Please try again." };
}

function revalidateSettingsPaths(businessId: string) {
  try {
    revalidatePath("/businesses");
    revalidatePath(`/businesses/${businessId}`);
    revalidatePath(`/businesses/${businessId}/settings`);
    revalidatePath(`/businesses/${businessId}/insights`);
  } catch {
    // Silently ignore if invoked outside Next.js request context
  }
}

export async function getBusinessSettings(
  businessId: string,
  overrideUser?: User
): Promise<{ snapshot: BusinessSettingsSnapshot } | { error: string }> {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business, workspace, role } = await getAuthorizedBusinessForUser(
      user,
      businessId,
      "MANAGER"
    );

    const businessWithSettings = await prisma.business.findUnique({
      where: { id: business.id },
      include: {
        settings: true,
      },
    });

    if (!businessWithSettings || businessWithSettings.status === "ARCHIVED") {
      return { error: "Business could not be found." };
    }

    const s = businessWithSettings.settings;
    const parsedOperatingHours =
      (s?.operatingHours as unknown as WeeklyOperatingHours) || DEFAULT_OPERATING_HOURS;

    const snapshot: BusinessSettingsSnapshot = {
      businessId: businessWithSettings.id,
      workspaceName: workspace.name,
      userRole: role,
      profile: {
        name: businessWithSettings.name,
        type: businessWithSettings.type,
        description: businessWithSettings.description,
        phone: businessWithSettings.phone,
        email: businessWithSettings.email,
        address: businessWithSettings.address,
        logoUrl: businessWithSettings.logoUrl,
        timezone: businessWithSettings.timezone,
      },
      queueDefaults: {
        defaultQueueName: s?.defaultQueueName ?? "General Queue",
        defaultServiceTime: s?.defaultServiceTime ?? 10,
        maxQueueCapacity: s?.maxQueueCapacity ?? null,
        allowCustomerLeave: s?.allowCustomerLeave ?? true,
        allowCustomerRejoin: s?.allowCustomerRejoin ?? false,
        autoExpireStaleTickets: s?.autoExpireStaleTickets ?? false,
        noShowHandling: s?.noShowHandling ?? "MANUAL",
      },
      customerExperience: {
        welcomeMessage: s?.welcomeMessage ?? null,
        queueInstructions: s?.queueInstructions ?? null,
        enableNotifications: s?.enableNotifications ?? true,
        enableQrJoin: s?.enableQrJoin ?? true,
        allowCustomerLeave: s?.allowCustomerLeave ?? true,
      },
      displaySettings: {
        displayTitle: s?.displayTitle ?? "Now Serving",
        showQrCode: s?.showQrCode ?? true,
        showCurrentlyServing: s?.showCurrentlyServing ?? true,
        showWaitingCount: s?.showWaitingCount ?? true,
        brandingText: s?.brandingText ?? null,
        soundAlertEnabled: s?.soundAlertEnabled ?? true,
      },
      operatingHours: parsedOperatingHours,
    };

    return { snapshot };
  } catch (err) {
    return mapError(err, "getBusinessSettings");
  }
}

export async function updateBusinessProfile(
  businessId: string,
  rawInput: unknown,
  overrideUser?: User
) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const parsed = businessProfileSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid profile data." };
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        logoUrl: parsed.data.logoUrl || null,
        timezone: parsed.data.timezone,
      },
    });

    revalidateSettingsPaths(business.id);
    return { ok: true, name: updated.name };
  } catch (err) {
    return mapError(err, "updateBusinessProfile");
  }
}

const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function uploadBusinessLogo(
  businessId: string,
  input: FormData | { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  overrideUser?: User
): Promise<{ ok: true; logoUrl: string } | { error: string }> {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    let file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null = null;
    if (typeof FormData !== "undefined" && input instanceof FormData) {
      const formFile = input.get("file");
      if (formFile && typeof formFile === "object" && "arrayBuffer" in formFile) {
        file = formFile as any;
      }
    } else if (input && typeof input === "object" && "arrayBuffer" in input) {
      file = input;
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return { error: "No image file provided for upload." };
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return { error: "Logo image must be smaller than 2MB." };
    }

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
      return { error: "Invalid image format. Supported formats are PNG, JPG, WEBP, and SVG." };
    }

    const ext = MIME_EXTENSIONS[file.type] || "png";
    const storagePath = `businesses/${business.id}/branding/logo-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const url = getBrowserSupabaseUrl();
    const key = getServerSupabaseKey();
    if (!url || !key) {
      return { error: "Supabase storage is not configured on this server." };
    }

    const supabase = createClient(url, key);
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("business-logos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr || !uploadData) {
      console.error("[settings] Supabase storage upload error:", uploadErr);
      return { error: "Failed to upload logo to storage. Please try again." };
    }

    const { data: publicData } = supabase.storage
      .from("business-logos")
      .getPublicUrl(storagePath);

    const publicLogoUrl = publicData.publicUrl;

    await prisma.business.update({
      where: { id: business.id },
      data: { logoUrl: publicLogoUrl },
    });

    const queues = await prisma.queue.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });
    for (const q of queues) {
      notifyQueueChanged(q.id);
    }

    revalidateSettingsPaths(business.id);
    return { ok: true, logoUrl: publicLogoUrl };
  } catch (err) {
    return mapError(err, "uploadBusinessLogo");
  }
}

export async function removeBusinessLogo(
  businessId: string,
  overrideUser?: User
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    await prisma.business.update({
      where: { id: business.id },
      data: { logoUrl: null },
    });

    const queues = await prisma.queue.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });
    for (const q of queues) {
      notifyQueueChanged(q.id);
    }

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "removeBusinessLogo");
  }
}

export async function updateQueueDefaults(
  businessId: string,
  rawInput: unknown,
  overrideUser?: User
) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const parsed = queueDefaultsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid queue default settings." };
    }

    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        defaultQueueName: parsed.data.defaultQueueName,
        defaultServiceTime: parsed.data.defaultServiceTime,
        maxQueueCapacity: parsed.data.maxQueueCapacity,
        allowCustomerLeave: parsed.data.allowCustomerLeave,
        allowCustomerRejoin: parsed.data.allowCustomerRejoin,
        autoExpireStaleTickets: parsed.data.autoExpireStaleTickets,
        noShowHandling: parsed.data.noShowHandling,
      },
      update: {
        defaultQueueName: parsed.data.defaultQueueName,
        defaultServiceTime: parsed.data.defaultServiceTime,
        maxQueueCapacity: parsed.data.maxQueueCapacity,
        allowCustomerLeave: parsed.data.allowCustomerLeave,
        allowCustomerRejoin: parsed.data.allowCustomerRejoin,
        autoExpireStaleTickets: parsed.data.autoExpireStaleTickets,
        noShowHandling: parsed.data.noShowHandling,
      },
    });

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "updateQueueDefaults");
  }
}

export async function updateCustomerExperience(
  businessId: string,
  rawInput: unknown,
  overrideUser?: User
) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const parsed = customerExperienceSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid customer experience settings." };
    }

    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        welcomeMessage: parsed.data.welcomeMessage || null,
        queueInstructions: parsed.data.queueInstructions || null,
        enableNotifications: parsed.data.enableNotifications,
        enableQrJoin: parsed.data.enableQrJoin,
        allowCustomerLeave: parsed.data.allowCustomerLeave,
      },
      update: {
        welcomeMessage: parsed.data.welcomeMessage || null,
        queueInstructions: parsed.data.queueInstructions || null,
        enableNotifications: parsed.data.enableNotifications,
        enableQrJoin: parsed.data.enableQrJoin,
        allowCustomerLeave: parsed.data.allowCustomerLeave,
      },
    });

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "updateCustomerExperience");
  }
}

export async function updateDisplaySettings(
  businessId: string,
  rawInput: unknown,
  overrideUser?: User
) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const parsed = displaySettingsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid display settings." };
    }

    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        displayTitle: parsed.data.displayTitle,
        showQrCode: parsed.data.showQrCode,
        showCurrentlyServing: parsed.data.showCurrentlyServing,
        showWaitingCount: parsed.data.showWaitingCount,
        brandingText: parsed.data.brandingText || null,
        soundAlertEnabled: parsed.data.soundAlertEnabled,
      },
      update: {
        displayTitle: parsed.data.displayTitle,
        showQrCode: parsed.data.showQrCode,
        showCurrentlyServing: parsed.data.showCurrentlyServing,
        showWaitingCount: parsed.data.showWaitingCount,
        brandingText: parsed.data.brandingText || null,
        soundAlertEnabled: parsed.data.soundAlertEnabled,
      },
    });

    // Notify active queues for realtime TV display updates
    const queues = await prisma.queue.findMany({
      where: { businessId: business.id, status: { in: ["ACTIVE", "OPEN", "PAUSED"] } },
      select: { id: true },
    });

    for (const q of queues) {
      notifyQueueChanged(q.id);
      try {
        revalidatePath(`/businesses/${business.id}/queues/${q.id}/display`);
      } catch {
        // ignore outside request
      }
    }

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "updateDisplaySettings");
  }
}

export async function updateOperatingHours(
  businessId: string,
  rawInput: unknown,
  overrideUser?: User
) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const parsed = operatingHoursSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid operating hours format." };
    }

    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        operatingHours: parsed.data,
      },
      update: {
        operatingHours: parsed.data,
      },
    });

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "updateOperatingHours");
  }
}

export async function pauseAllQueues(businessId: string, overrideUser?: User) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    const updated = await prisma.queue.updateMany({
      where: {
        businessId: business.id,
        status: { not: "ARCHIVED" },
      },
      data: {
        status: "PAUSED",
      },
    });

    const activeQueues = await prisma.queue.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });

    for (const q of activeQueues) {
      notifyQueueChanged(q.id);
      try {
        revalidatePath(`/businesses/${business.id}/queues/${q.id}`);
        revalidatePath(`/businesses/${business.id}/queues/${q.id}/display`);
      } catch {
        // ignore outside request
      }
    }

    revalidateSettingsPaths(business.id);
    return { ok: true, count: updated.count };
  } catch (err) {
    return mapError(err, "pauseAllQueues");
  }
}

export async function archiveBusiness(businessId: string, overrideUser?: User) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    await prisma.$transaction(async (tx) => {
      await tx.queue.updateMany({
        where: { businessId: business.id },
        data: { status: "ARCHIVED" },
      });

      await tx.business.update({
        where: { id: business.id },
        data: { status: "ARCHIVED" },
      });
    });

    revalidateSettingsPaths(business.id);
    return { ok: true };
  } catch (err) {
    return mapError(err, "archiveBusiness");
  }
}

export async function deleteBusiness(businessId: string, overrideUser?: User) {
  try {
    const user = overrideUser ?? (await getCurrentUser());
    const { business } = await getAuthorizedBusinessForUser(user, businessId, "OWNER");

    await prisma.$transaction(async (tx) => {
      // 1. Delete staff assignments for queues in this business
      await tx.staffQueueAssignment.deleteMany({
        where: { queue: { businessId: business.id } },
      });

      // 2. Delete queue entries
      await tx.queueEntry.deleteMany({
        where: { queue: { businessId: business.id } },
      });

      // 3. Delete queues
      await tx.queue.deleteMany({
        where: { businessId: business.id },
      });

      // 4. Delete business members
      await tx.businessMember.deleteMany({
        where: { businessId: business.id },
      });

      // 5. Delete business settings
      await tx.businessSettings.deleteMany({
        where: { businessId: business.id },
      });

      // 6. Delete business
      await tx.business.delete({
        where: { id: business.id },
      });
    });

    try {
      revalidatePath("/businesses");
      revalidatePath("/dashboard");
    } catch {
      // ignore outside request
    }

    return { ok: true };
  } catch (err) {
    return mapError(err, "deleteBusiness");
  }
}
