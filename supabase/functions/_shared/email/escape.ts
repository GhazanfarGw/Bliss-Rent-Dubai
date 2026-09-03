// Every value interpolated into an email template must go through this —
// customer name, vehicle model, a free-text complaint body, anything
// that ultimately came from user input — per the security requirement
// in the Phase 9 Pre-Implementation Report (Section 20): "no raw
// concatenation". Pure, no dependencies, Deno- and Vitest-safe.

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch])
}
