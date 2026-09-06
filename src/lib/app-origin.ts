import { headers } from "next/headers";

/** Public origin for customer-facing links (QR codes). Never hard-code localhost. */
export async function getAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();

  if (!host) return "";

  const protocol = proto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}
