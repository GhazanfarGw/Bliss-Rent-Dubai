// Phase 9I — the two independent safeguards for the preview/test-send
// tool's "send" mode, exactly as recorded in
// phase-9-business-decisions-confirmed-2026-08-31.md: "two independent
// safeguards: TEST_MODE flag + server-side recipient allowlist." Both
// must pass before a real Resend call is made — neither one alone is
// sufficient, so a misconfigured allowlist can't be papered over by
// TEST_MODE, and forgetting to flip TEST_MODE off can't be papered over
// by an accidentally-broad allowlist either.
//
// Both are read from Edge Function secrets by the caller (index.ts) and
// passed in here as plain values — same dependency-injection convention
// as every other `_shared/email` module (see resendProvider.ts's header)
// — so this file has zero Deno.env access and is fully unit-testable.
//
// This module governs ONLY the "send" mode of the preview/test-send
// tool. It has no bearing on, and does not gate, any of the real
// customer/admin send pipelines (9D/9F/9G/9H) — those are unaffected by
// TEST_MODE and always send for real, exactly as before.

export interface TestSendGuardConfig {
  /** The raw TEST_MODE Edge Function secret value — must be exactly 'true' (case-insensitive) to pass. Anything else (unset, 'false', empty, a typo) fails closed. */
  testModeRaw: string | undefined
  /** The raw TEST_EMAIL_ALLOWLIST secret value — a comma-separated list of email addresses. Unset or empty fails closed (an unconfigured allowlist permits nothing, not everything). */
  allowlistRaw: string | undefined
}

export type TestSendGuardFailureReason = 'TEST_MODE_DISABLED' | 'RECIPIENT_NOT_ALLOWLISTED'

export type TestSendGuardResult = { allowed: true } | { allowed: false; reason: TestSendGuardFailureReason }

function isTestModeEnabled(testModeRaw: string | undefined): boolean {
  return (testModeRaw ?? '').trim().toLowerCase() === 'true'
}

function parseAllowlist(allowlistRaw: string | undefined): string[] {
  return (allowlistRaw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

function isAllowlistedRecipient(recipientEmail: string, allowlistRaw: string | undefined): boolean {
  const allowlist = parseAllowlist(allowlistRaw)
  if (allowlist.length === 0) return false
  return allowlist.includes(recipientEmail.trim().toLowerCase())
}

/**
 * Checks both safeguards for a real "send" attempt to `recipientEmail`.
 * Checks TEST_MODE first so a disabled flag reports as the reason even
 * when the recipient also happens to not be allowlisted — the caller
 * only needs one reason to show, and TEST_MODE is the more fundamental
 * of the two gates.
 */
export function checkTestSendAllowed(recipientEmail: string, config: TestSendGuardConfig): TestSendGuardResult {
  if (!isTestModeEnabled(config.testModeRaw)) {
    return { allowed: false, reason: 'TEST_MODE_DISABLED' }
  }
  if (!isAllowlistedRecipient(recipientEmail, config.allowlistRaw)) {
    return { allowed: false, reason: 'RECIPIENT_NOT_ALLOWLISTED' }
  }
  return { allowed: true }
}
