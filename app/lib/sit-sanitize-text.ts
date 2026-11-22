/** Round 5 A4: display/export dash and arrow scrub (no DB rewrite). */
export function sanitizeUserText(text: string | undefined | null): string {
  if (!text) return text || "";
  return text
    .replace(/\u2014/g, ", ")
    .replace(/\u2013/g, " to ")
    .replace(/\u2192/g, " to ")
    .replace(/[\u2190-\u2199\u21D0-\u21D5]/g, " to ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",");
}

export function findForbiddenDashChars(text: string): string[] {
  const found: string[] = [];
  if (/\u2014/.test(text)) found.push("U+2014");
  if (/\u2013/.test(text)) found.push("U+2013");
  if (/\u2192/.test(text)) found.push("U+2192");
  return found;
}
