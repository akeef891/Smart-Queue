import { z } from "zod";

export const workspaceCreateSchema = z.object({
  name: z
    .string({ required_error: "Enter a workspace name." })
    .trim()
    .min(1, "Enter a workspace name.")
    .max(100, "Workspace name must be 100 characters or fewer."),
});

export const businessManageSchema = z.object({
  name: z
    .string({ required_error: "Enter a business name." })
    .trim()
    .min(1, "Enter a business name.")
    .max(150, "Business name must be 150 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional(),
});

export const businessCreateSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z
    .string({ required_error: "Enter a business name." })
    .trim()
    .min(1, "Enter a business name.")
    .max(150, "Business name must be 150 characters or fewer."),
  description: z.string().trim().max(1000).optional(),
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
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  logoUrl: z.string().url().optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  timezone: z.string().min(1).max(64).default("Asia/Kolkata"),
});

export const businessUpdateSchema = businessCreateSchema.partial().extend({
  businessId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

export const queueManageSchema = z.object({
  name: z
    .string({ required_error: "Enter a queue name." })
    .trim()
    .min(1, "Enter a queue name.")
    .max(100, "Queue name must be 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional(),
});

export const queueCreateSchema = z.object({
  workspaceId: z.string().cuid(),
  businessId: z.string().cuid(),
  name: z
    .string({ required_error: "Enter a queue name." })
    .trim()
    .min(1, "Enter a queue name.")
    .max(100, "Queue name must be 100 characters or fewer."),
  description: z.string().trim().max(500).optional(),
  averageServiceTime: z.number().int().min(1).max(480).default(10),
  maxCapacity: z.number().int().min(1).max(10000).optional(),
});

export const queueStatusUpdateSchema = z.object({
  workspaceId: z.string().cuid(),
  queueId: z.string().cuid(),
  status: z.enum(["DRAFT", "OPEN", "ACTIVE", "INACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]),
});

// Public-facing: customer joining a queue. Kept intentionally strict since
// this endpoint is unauthenticated and internet-facing.
export const customerJoinSchema = z.object({
  customerName: z
    .string({ required_error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
});

export const queueJoinSchema = z.object({
  customerName: z
    .string({ required_error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-()]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  customerEmail: z.string().trim().email().optional().or(z.literal("")),
});

export const queueEntryActionSchema = z.object({
  workspaceId: z.string().cuid(),
  queueId: z.string().cuid(),
  entryId: z.string().cuid(),
  action: z.enum([
    "CALL",
    "START_SERVING",
    "COMPLETE",
    "SKIP",
    "CANCEL",
    "NO_SHOW",
    "RECALL",
  ]),
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type BusinessManageInput = z.infer<typeof businessManageSchema>;
export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
export type QueueManageInput = z.infer<typeof queueManageSchema>;
export type QueueCreateInput = z.infer<typeof queueCreateSchema>;
export type QueueJoinInput = z.infer<typeof queueJoinSchema>;
export type CustomerJoinInput = z.infer<typeof customerJoinSchema>;
