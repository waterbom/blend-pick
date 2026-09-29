/** Display/export only. Never rewrite stored phone numbers or payment/SMS inputs. */
export function formatPhone(value: string | number | null | undefined): string {
  const original = String(value ?? "").trim();
  // Leave masked numbers, extensions and foreign numbers intact instead of guessing.
  if (!original || !/^\+?[\d\s().-]+$/.test(original)) return original;
  let digits = original.replace(/\D/g, "");
  if (original.startsWith("+82")) digits = "0" + digits.slice(2).replace(/^0/, "");
  else if (original.startsWith("+")) return original;
  // Excel sometimes converted a Korean 010 mobile to a 10-digit numeric cell.
  if (/^10\d{8}$/.test(digits)) digits = "0" + digits;
  if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
  if (/^(?:01[016789]|0[3-6][1-5]|070|080)\d{7,8}$/.test(digits)) {
    return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
  }
  if (/^050\d{8,9}$/.test(digits)) return digits.replace(/^(\d{4})(\d{3,4})(\d{4})$/, "$1-$2-$3");
  if (/^1[568]\d{6}$/.test(digits)) return digits.replace(/^(\d{4})(\d{4})$/, "$1-$2");
  return original;
}
