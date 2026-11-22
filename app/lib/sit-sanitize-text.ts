/** Round 5 A4 / Round 6 A6: display/export dash and arrow scrub (no DB rewrite). */

const ANY_ARROW = /[\u2190-\u2199\u21D0-\u21D5]/g;

export function scrubQuotedArrows(text: string): string {
  return text.replace(/(['"])([^'"\n]*?)\1/g, (_m, q: string, inner: string) => {
    let s = inner.replace(ANY_ARROW, " ");
    s = s.replace(/\s+(to|and|then)\s*$/i, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    return `${q}${s}${q}`;
  });
}

export function scrubDanglingConnectors(text: string): string {
  return text
    .replace(/(['"])([^'"\n]*?)\s+to\s*\1/gi, (_m, q: string, inner: string) => `${q}${inner.trim()}${q}`)
    .replace(/\s+to\s*$/gm, "")
    .replace(/\s+to\s+([.,;:!?)])/g, " $1");
}

export function sanitizeUserText(text: string | undefined | null): string {
  if (!text) return text || "";
  let s = text;
  s = scrubQuotedArrows(s);
  s = s.replace(/\u2014/g, ", ").replace(/\u2013/g, " to ");
  s = s.replace(ANY_ARROW, " ");
  s = scrubDanglingConnectors(s);
  return s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",");
}

export function findForbiddenDashChars(text: string): string[] {
  const found: string[] = [];
  if (/\u2014/.test(text)) found.push("U+2014");
  if (/\u2013/.test(text)) found.push("U+2013");
  if (/\u2192/.test(text)) found.push("U+2192");
  return found;
}
