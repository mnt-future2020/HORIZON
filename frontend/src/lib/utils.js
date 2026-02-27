import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve media URLs from backend.
 * - S3 absolute URLs (https://...) pass through unchanged.
 * - Local uploads (/api/uploads/...) get backend base URL prepended.
 * - data: and blob: URIs pass through unchanged.
 */
export function mediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${process.env.REACT_APP_BACKEND_URL}${url}`;
}

/**
 * Convert 24h time string "HH:MM" to 12h AM/PM format.
 * e.g. "15:00" → "3:00 PM", "09:30" → "9:30 AM"
 */
export function fmt12h(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
