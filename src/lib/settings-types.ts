import type { BusinessType, BusinessRole } from "@/generated/prisma";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // HH:MM in 24-hour format e.g. "09:00"
  closeTime: string; // HH:MM in 24-hour format e.g. "17:00"
}

export type WeeklyOperatingHours = Record<DayOfWeek, DaySchedule>;

export const DEFAULT_OPERATING_HOURS: WeeklyOperatingHours = {
  monday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  tuesday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  wednesday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  thursday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  friday: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  saturday: { isOpen: true, openTime: "10:00", closeTime: "16:00" },
  sunday: { isOpen: false, openTime: "09:00", closeTime: "17:00" },
};

export interface BusinessProfileData {
  name: string;
  type: BusinessType;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  timezone: string;
}

export interface QueueDefaultsData {
  defaultQueueName: string;
  defaultServiceTime: number;
  maxQueueCapacity: number | null;
  allowCustomerLeave: boolean;
  allowCustomerRejoin: boolean;
  autoExpireStaleTickets: boolean;
  noShowHandling: string;
}

export interface CustomerExperienceData {
  welcomeMessage: string | null;
  queueInstructions: string | null;
  enableNotifications: boolean;
  enableQrJoin: boolean;
  allowCustomerLeave: boolean;
}

export interface DisplaySettingsData {
  displayTitle: string;
  showQrCode: boolean;
  showCurrentlyServing: boolean;
  showWaitingCount: boolean;
  brandingText: string | null;
  soundAlertEnabled: boolean;
}

export interface BusinessSettingsSnapshot {
  businessId: string;
  workspaceName: string;
  userRole: BusinessRole;
  profile: BusinessProfileData;
  queueDefaults: QueueDefaultsData;
  customerExperience: CustomerExperienceData;
  displaySettings: DisplaySettingsData;
  operatingHours: WeeklyOperatingHours;
}
