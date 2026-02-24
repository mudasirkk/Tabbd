/**
 * Normalize phone number to digits only for consistent storage and lookup.
 * Strips spaces, dashes, parentheses, dots, leading +1 or 1 (US), and any other non-digit characters.
 * Prevents duplicate customers for the same person (e.g. 555-123-4567 vs 5551234567).
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const digits = phone.replace(/\D/g, "");
  // Strip leading 1 (US country code) if present and length is 11
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}
