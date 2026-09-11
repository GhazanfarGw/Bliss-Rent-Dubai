// Admin login verification-code email (2026-09-05).
//
// Deliberately its OWN small template rather than a new required field
// bolted onto CustomerEmailProps (which requires a BookingSummary) or
// AdminEmailProps (which is shaped around a booking-related operational
// alert with a customerName/dashboardUrl) — this email has no booking at
// all, so forcing it through either shared shape would mean widening a
// type every existing customer/admin email call site depends on, for one
// email that doesn't fit the mold. It still reuses the same shared
// building blocks (renderHeader/renderFooter, BRAND_COLORS, escapeHtml)
// so it matches the rest of the email system visually.
//
// Pure render(...) -> { subject, html } — no Deno API, no Resend, no
// database — exactly like extensionNotificationContent.ts.

import { BRAND_COLORS } from './brand.ts'
import { escapeHtml } from './escape.ts'
import { renderHeader, renderFooter } from './components.ts'
import type { EmailLanguage } from './strings.ts'

export interface AdminLoginCodeEmail {
  subject: string
  html: string
}

/** `code` must already be validated as a 6-digit string by the caller — this only renders it, never generates or checks it (see admin-login-start/logic.ts). */
export function renderAdminLoginCodeEmail(
  language: EmailLanguage,
  code: string,
  expiresInMinutes: number,
): AdminLoginCodeEmail {
  const rtl = language === 'ar'
  const dir = rtl ? 'rtl' : 'ltr'
  const align = rtl ? 'right' : 'left'

  const strings =
    language === 'ar'
      ? {
          subject: 'رمز تسجيل الدخول للوحة التحكم — بليس رنت',
          title: 'رمز تسجيل الدخول',
          intro: 'أدخل هذا الرمز لإكمال تسجيل الدخول إلى لوحة تحكم بليس رنت.',
          expiry: `ينتهي صلاحية هذا الرمز خلال ${expiresInMinutes} دقائق.`,
          security: 'إذا لم تحاول تسجيل الدخول، يمكنك تجاهل هذه الرسالة — لا يمكن لأحد الوصول إلى لوحة التحكم بدون هذا الرمز.',
        }
      : {
          subject: 'Your admin dashboard sign-in code — Bliss Rent',
          title: 'Your sign-in code',
          intro: 'Enter this code to finish signing in to the Bliss Rent admin dashboard.',
          expiry: `This code expires in ${expiresInMinutes} minutes.`,
          security: "If you didn't try to sign in, you can safely ignore this email — no one can access the dashboard without this code.",
        }

  const body = `
${renderHeader(language)}
<tr>
  <td style="padding:24px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td dir="${dir}" align="${align}" style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${BRAND_COLORS.text};">
          ${escapeHtml(strings.title)}
        </td>
      </tr>
      <tr>
        <td dir="${dir}" align="${align}" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.intro)}
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:20px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.subtleBg};border-radius:8px;">
      <tr>
        <td align="center" style="padding:20px 16px;">
          <span style="direction:ltr;unicode-bidi:embed;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:${BRAND_COLORS.structural};">
            ${escapeHtml(code)}
          </span>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:12px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td dir="${dir}" align="${align}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.expiry)}
        </td>
      </tr>
      <tr>
        <td dir="${dir}" align="${align}" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.security)}
        </td>
      </tr>
    </table>
  </td>
</tr>
${renderFooter(language)}`

  return { subject: strings.subject, html: renderDocument(language, strings.title, body) }
}

function renderDocument(language: EmailLanguage, title: string, bodyContent: string): string {
  const rtl = language === 'ar'
  return `<!doctype html>
<html lang="${language}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_COLORS.subtleBg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.subtleBg};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${BRAND_COLORS.surface};border-radius:8px;overflow:hidden;">
        ${bodyContent}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
