/**
 * Developer & Test Account Configuration
 * Contains whitelisted developer emails and secret bypass codes for testing without Paystack charges.
 */

export const DEV_EMAILS = [
  'kola.victor14@gmail.com',
  'davidomoniyi33@gmail.com',
];

export const DEV_BYPASS_CODES = [
  'DEV_BYPASS_2026',
  'ROVA_DEV_FREE',
];

/**
 * Checks whether the given email belongs to a whitelisted developer account.
 */
export function isDeveloperEmail(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return DEV_EMAILS.some(devEmail => devEmail.toLowerCase() === cleanEmail);
}

/**
 * Checks whether the reference code is a valid developer secret bypass code.
 */
export function isDeveloperBypassCode(reference?: string | null): boolean {
  if (!reference) return false;
  const cleanRef = reference.trim().toUpperCase();
  return DEV_BYPASS_CODES.some(code => code.toUpperCase() === cleanRef);
}
