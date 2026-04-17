import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a human-readable platform role label derived from effectiveRoles.
 */
export function getDisplayRole(effectiveRoles) {
  if (!effectiveRoles) return "User";
  if (effectiveRoles.isHubOwner)   return "Hub Owner";
  if (effectiveRoles.isITSupport)  return "IT Support";
  if (effectiveRoles.isAppOwner)   return "App Owner";
  if (effectiveRoles.isAppManager) return "App Manager";
  return "User";
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