/** Collapse multiple whitespace/newlines into a single space. */
export function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
