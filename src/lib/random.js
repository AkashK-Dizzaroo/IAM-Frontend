// Cryptographically secure random helpers. Math.random() is not safe for
// anything used as an identifier or secret (predictable, not CSPRNG-backed).

/** Unbiased random integer in [0, max) via rejection sampling over crypto.getRandomValues. */
export function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0 || max > 256) {
    throw new RangeError("secureRandomInt: max must be an integer in (0, 256]");
  }
  const range = 256 - (256 % max);
  const bytes = new Uint8Array(1);
  let value;
  do {
    crypto.getRandomValues(bytes);
    value = bytes[0];
  } while (value >= range);
  return value % max;
}

/** Random id for correlation/UI keys — not a secret, but avoids Math.random(). */
export function secureRandomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
