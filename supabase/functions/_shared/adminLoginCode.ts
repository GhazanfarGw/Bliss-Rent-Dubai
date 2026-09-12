// Shared, framework-free helpers for the admin dashboard's mandatory
// emailed login-verification code (2026-09-05) — code generation,
// hashing, constant-time comparison, and the error contract both
// admin-login-start and admin-login-verify throw. Pure Web Crypto
// (crypto.getRandomValues / crypto.subtle), available identically under
// Deno and Vitest, so this is testable without mocking, same convention
// as validation.ts.

export const CODE_LENGTH = 6
export const CODE_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5

export type AdminLoginErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'NOT_AUTHORIZED'
  | 'SUSPENDED'
  | 'EMAIL_FAILED'
  | 'CODE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'INVALID_CODE'
  | 'SERVER_ERROR'

export class AdminLoginError extends Error {
  code: AdminLoginErrorCode
  httpStatus: number
  /** Only set for INVALID_CODE — how many more tries are left before the whole pending login is discarded. */
  remainingAttempts?: number

  constructor(code: AdminLoginErrorCode, message: string, httpStatus: number, remainingAttempts?: number) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.remainingAttempts = remainingAttempts
  }
}

/** A cryptographically random CODE_LENGTH-digit numeric code, e.g. "042917". Leading zeros are intentional and preserved — this is always compared/rendered as a fixed-length string, never parsed as a number. */
export function generateNumericCode(length: number = CODE_LENGTH): string {
  const digits = new Uint32Array(length)
  crypto.getRandomValues(digits)
  return Array.from(digits, (n) => (n % 10).toString()).join('')
}

/** Random per-row salt so two challenges with the same code (extremely unlikely, but possible) never produce the same stored hash. */
export function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** sha256(salt:code) — the plaintext code is never stored, only this. */
export async function hashCode(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(digest))
}

/** Constant-time string comparison — avoids leaking, via response timing, how many leading hex characters of a guessed code's hash happened to match (defense in depth; MAX_ATTEMPTS + short expiry are the primary defenses). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
