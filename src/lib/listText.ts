/** Drop empty / punctuation-only scraper leftovers (";", ".", ",", "|", …). */
export function isMeaningfulListText(value: string | null | undefined): value is string {
  if (!value) return false;
  const s = value.trim();
  if (!s) return false;
  return /[A-Za-z0-9]/.test(s);
}
