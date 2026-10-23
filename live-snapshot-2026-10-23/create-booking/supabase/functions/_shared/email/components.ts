import { BRAND_COLORS, BRAND_NAME, PLACEHOLDER_CONTACT } from './brand.ts'
import { escapeHtml } from './escape.ts'
import { EMAIL_STRINGS, type EmailLanguage } from './strings.ts'
import type { BookingSummary, StatusTone, AdminPriority } from './types.ts'

const STATUS_TONE_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  info: { bg: BRAND_COLORS.subtleBg, fg: BRAND_COLORS.structural },
  success: { bg: BRAND_COLORS.successBg, fg: BRAND_COLORS.successText },
  warning: { bg: BRAND_COLORS.accentBg, fg: BRAND_COLORS.accentText },
  danger: { bg: BRAND_COLORS.dangerBg, fg: BRAND_COLORS.danger },
}

const ADMIN_PRIORITY_COLORS: Record<AdminPriority, { bg: string; fg: string; label: { en: string; ar: string } }> = {
  normal: { bg: BRAND_COLORS.subtleBg, fg: BRAND_COLORS.structural, label: { en: 'Normal', ar: 'عادية' } },
  attention: { bg: BRAND_COLORS.accentBg, fg: BRAND_COLORS.accentText, label: { en: 'Needs attention', ar: 'يتطلب الانتباه' } },
  urgent: { bg: BRAND_COLORS.dangerBg, fg: BRAND_COLORS.danger, label: { en: 'Urgent', ar: 'عاجل' } },
}

export function wrapLtr(value: string): string {
  return `<span style="direction:ltr;unicode-bidi:isolate;display:inline-block;">${escapeHtml(value)}</span>`
}

function isRtl(language: EmailLanguage): boolean {
  return language === 'ar'
}

export function renderHeader(language: EmailLanguage): string {
  const rtl = isRtl(language)
  const strings = EMAIL_STRINGS[language]
  return `
<tr>
  <td align="center" style="background-color:${BRAND_COLORS.structural};padding:28px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="${rtl ? 'right' : 'left'}" dir="${rtl ? 'rtl' : 'ltr'}" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;letter-spacing:0.5px;color:${BRAND_COLORS.surface};">
          ${escapeHtml(strings.brandName)}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderStatusBanner(tone: StatusTone, message: string, language: EmailLanguage): string {
  const rtl = isRtl(language)
  const colors = STATUS_TONE_COLORS[tone]
  return `
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:${colors.bg};border-radius:6px;">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${colors.fg};">
          ${escapeHtml(message)}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

function summaryRow(label: string, value: string, language: EmailLanguage, ltrValue = false): string {
  const rtl = isRtl(language)
  const renderedValue = ltrValue ? wrapLtr(value) : escapeHtml(value)
  return `
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_COLORS.textMuted};width:42%;">
          ${escapeHtml(label)}
        </td>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${BRAND_COLORS.text};">
          ${renderedValue}
        </td>
      </tr>`
}

export function renderBookingSummaryCard(summary: BookingSummary, language: EmailLanguage): string {
  const strings = EMAIL_STRINGS[language]
  const rows = [
    summaryRow(strings.reference, summary.reference, language, true),
    summaryRow(strings.vehicle, summary.vehicleName, language),
    summaryRow(strings.rentalDates, summary.rentalDatesLabel, language, true),
    summaryRow(strings.pickup, summary.pickupLabel, language),
    summaryRow(strings.dropoff, summary.dropoffLabel, language),
    summaryRow(strings.amount, summary.amountLabel, language, true),
  ]
  if (summary.paymentStatusLabel) rows.push(summaryRow(strings.paymentStatus, summary.paymentStatusLabel, language))
  if (summary.bookingStatusLabel) rows.push(summaryRow(strings.bookingStatus, summary.bookingStatusLabel, language))

  return `
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border:1px solid ${BRAND_COLORS.border};border-radius:6px;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rows.join('')}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderDetailsCard(rows: { label: string; value: string; ltrValue?: boolean }[], language: EmailLanguage): string {
  const rtl = isRtl(language)
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_COLORS.textMuted};width:30%;vertical-align:top;">
          ${escapeHtml(row.label)}
        </td>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${BRAND_COLORS.text};white-space:pre-wrap;">
          ${row.ltrValue ? wrapLtr(row.value) : escapeHtml(row.value)}
        </td>
      </tr>`,
    )
    .join('')

  return `
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border:1px solid ${BRAND_COLORS.border};border-radius:6px;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderCtaButton(url: string, label: string, language: EmailLanguage): string {
  const rtl = isRtl(language)
  return `
<tr>
  <td align="center" style="padding:28px 24px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="border-radius:6px;background-color:${BRAND_COLORS.primary};">
          <a href="${escapeHtml(url)}" dir="${rtl ? 'rtl' : 'ltr'}" style="display:inline-block;padding:13px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${BRAND_COLORS.surface};text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderFooter(language: EmailLanguage): string {
  const rtl = isRtl(language)
  const strings = EMAIL_STRINGS[language]
  const year = new Date().getFullYear()
  return `
<tr>
  <td style="padding:28px 24px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.supportIntro)}
        </td>
      </tr>
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.whatsappLabel)}: ${wrapLtr(PLACEHOLDER_CONTACT.whatsapp)}<br />
          ${escapeHtml(strings.emailLabel)}: ${wrapLtr(PLACEHOLDER_CONTACT.email)}<br />
          ${escapeHtml(strings.officeLabel)}: ${escapeHtml(PLACEHOLDER_CONTACT.address)}<br />
          ${escapeHtml(strings.hoursLabel)}: ${escapeHtml(PLACEHOLDER_CONTACT.hours)}
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:16px 24px 28px;border-top:1px solid ${BRAND_COLORS.border};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND_COLORS.textMuted};">
          © ${year} ${escapeHtml(BRAND_NAME)}. ${escapeHtml(strings.footerRights)}<br />
          ${escapeHtml(strings.automatedNotice)}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderAdminBar(alertType: string, priority: AdminPriority, language: EmailLanguage): string {
  const rtl = isRtl(language)
  const colors = ADMIN_PRIORITY_COLORS[priority]
  const priorityLabel = colors.label[language]
  const strings = EMAIL_STRINGS[language]
  return `
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${BRAND_COLORS.text};">
          ${escapeHtml(alertType)}
        </td>
        <td align="${rtl ? 'left' : 'right'}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:4px 10px;border-radius:12px;background-color:${colors.bg};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:${colors.fg};">
                ${escapeHtml(strings.admin.priority)}: ${escapeHtml(priorityLabel)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`
}

export function renderRequiredAction(action: string, language: EmailLanguage): string {
  const rtl = isRtl(language)
  const strings = EMAIL_STRINGS[language]
  return `
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:${BRAND_COLORS.subtleBg};border:1px solid ${BRAND_COLORS.border};border-radius:6px;">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_COLORS.text};">
          <strong>${escapeHtml(strings.admin.requiredAction)}:</strong> ${escapeHtml(action)}
        </td>
      </tr>
    </table>
  </td>
</tr>`
}
