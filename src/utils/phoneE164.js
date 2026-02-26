/**
 * E.164: + followed by 8–15 digits.
 * Returns normalized E.164 or null if invalid.
 */
export function normalizePhoneE164(input) {
  if (input == null || typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

export function isValidPhoneE164(input) {
  return /^\+[0-9]{8,15}$/.test(String(input).trim());
}
