import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a MongoDB ObjectId-like 24-char hex string.
 * Generic utility for any feature that needs IDs.
 */
export function generateObjectId() {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

