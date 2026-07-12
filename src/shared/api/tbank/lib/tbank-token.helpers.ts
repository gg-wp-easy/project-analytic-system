export function normalizeTBankToken(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}
