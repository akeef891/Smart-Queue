import { z } from "zod";
import { isValidIanaTimeZone, DEFAULT_TIMEZONE } from "@/lib/timezones";

const TIME_FORMAT_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(100, "Business name must be 100 characters or fewer."),
  type: z.enum([
    "CLINIC",
    "HOSPITAL",
    "SALON",
    "RESTAURANT",
    "BANK",
    "GOVERNMENT",
    "DIAGNOSTIC_CENTER",
    "TUITION_CENTER",
    "OTHER",
  ]),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer.").nullable().optional(),
  phone: z.string().trim().max(30, "Phone number must be 30 characters or fewer.").nullable().optional(),
  email: z
    .string()
    .trim()
    .max(100, "Email must be 100 characters or fewer.")
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Please enter a valid email address.",
    })
    .nullable()
    .optional(),
  address: z.string().trim().max(200, "Address must be 200 characters or fewer.").nullable().optional(),
  logoUrl: z
    .string()
    .trim()
    .max(1000, "Logo URL must be 1000 characters or fewer.")
    .refine((val) => !val || /^https?:\/\/.+/.test(val) || val.startsWith("/"), {
      message: "Logo URL must be a valid http or https URL.",
    })
    .nullable()
    .optional(),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .max(100, "Timezone identifier is too long.")
    .refine((val) => isValidIanaTimeZone(val), {
      message: "Invalid timezone. Please select a valid IANA timezone.",
    })
    .default(DEFAULT_TIMEZONE),
});

export const queueDefaultsSchema = z.object({
  defaultQueueName: z
    .string()
    .trim()
    .min(1, "Default queue name is required.")
    .max(100, "Default queue name must be 100 characters or fewer."),
  defaultServiceTime: z
    .number({ invalid_type_error: "Service time must be a number." })
    .int()
    .min(1, "Service time must be at least 1 minute.")
    .max(720, "Service time cannot exceed 720 minutes (12 hours)."),
  maxQueueCapacity: z
    .number({ invalid_type_error: "Max capacity must be a number." })
    .int()
    .min(1, "Max capacity must be at least 1.")
    .max(10000, "Max capacity cannot exceed 10,000.")
    .nullable()
    .optional(),
  allowCustomerLeave: z.boolean(),
  allowCustomerRejoin: z.boolean(),
  autoExpireStaleTickets: z.boolean(),
  noShowHandling: z.enum(["MANUAL", "AUTO_CANCEL", "HOLD_FOR_MINUTES"]),
});

export const customerExperienceSchema = z.object({
  welcomeMessage: z.string().trim().max(300, "Welcome message must be 300 characters or fewer.").nullable().optional(),
  queueInstructions: z.string().trim().max(500, "Instructions must be 500 characters or fewer.").nullable().optional(),
  enableNotifications: z.boolean(),
  enableQrJoin: z.boolean(),
  allowCustomerLeave: z.boolean(),
});

export const displaySettingsSchema = z.object({
  displayTitle: z
    .string()
    .trim()
    .min(1, "Display title is required.")
    .max(60, "Display title must be 60 characters or fewer."),
  showQrCode: z.boolean(),
  showCurrentlyServing: z.boolean(),
  showWaitingCount: z.boolean(),
  brandingText: z.string().trim().max(100, "Branding text must be 100 characters or fewer.").nullable().optional(),
  soundAlertEnabled: z.boolean(),
});

export const dayScheduleSchema = z
  .object({
    isOpen: z.boolean(),
    openTime: z.string().regex(TIME_FORMAT_REGEX, "Open time must be in HH:MM format (e.g. 09:00)."),
    closeTime: z.string().regex(TIME_FORMAT_REGEX, "Close time must be in HH:MM format (e.g. 17:00)."),
  })
  .refine(
    (data) => {
      if (!data.isOpen) return true;
      return data.closeTime > data.openTime;
    },
    {
      message: "Closing time must be after opening time.",
      path: ["closeTime"],
    }
  );

export const operatingHoursSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});
