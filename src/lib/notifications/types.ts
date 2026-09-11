export type NotificationSeverity = "info" | "warning" | "success" | "error";

export type NotificationCategory =
  | "CALLED"
  | "ALMOST_UP"
  | "NEXT_IN_LINE"
  | "SERVING"
  | "COMPLETED"
  | "CANCELLED"
  | "SKIPPED"
  | "NO_SHOW";

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  timestamp: number;
  persistent?: boolean;
};

export type BrowserPermissionState = "default" | "granted" | "denied" | "unsupported";
