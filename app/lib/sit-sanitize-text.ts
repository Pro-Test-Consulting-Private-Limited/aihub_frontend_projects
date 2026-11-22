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

/** R7-08: collapse doubled OPEN error replacements (display/export/generation). */
export function cleanErrorSentences(text: string | undefined | null): string {
  if (!text) return text || "";
  let s = text;
  if (/Error message\s+['"][^'"]+['"]/i.test(s) && !/An error message is shown/i.test(s)) {
    return s;
  }
  const rules: [RegExp, string][] = [
    [/Error message\s+An error message is shown\s+is shown/gi, "An error message is shown"],
    [/Error message\s+An error message is shown\s+is displayed/gi, "An error message is shown"],
    [
      /Error message\s+An error message is shown\s+and\s+(?:the\s+)?document is not uploaded/gi,
      "An error message is shown and the document is not uploaded",
    ],
    [
      /Verify that login screen displays\s+An error message is shown/gi,
      "Verify that the login screen shows an error message",
    ],
    [
      /Verify that redirect to the Login screen with error message\s+An error message is shown/gi,
      "Verify that the user is redirected to the Login screen and an error message is shown",
    ],
  ];
  for (const [re, rep] of rules) s = s.replace(re, rep);
  return s;
}

export function sanitizeUserText(text: string | undefined | null): string {
  if (!text) return text || "";
  let s = text;
  s = scrubQuotedArrows(s);
  s = s.replace(/\u2014/g, ", ").replace(/\u2013/g, " to ");
  s = s.replace(ANY_ARROW, " ");
  s = scrubDanglingConnectors(s);
  s = cleanErrorSentences(s);
  return s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",");
}

export function findForbiddenDashChars(text: string): string[] {
  const found: string[] = [];
  if (/\u2014/.test(text)) found.push("U+2014");
  if (/\u2013/.test(text)) found.push("U+2013");
  if (/\u2192/.test(text)) found.push("U+2192");
  return found;
}
