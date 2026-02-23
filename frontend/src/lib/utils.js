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
