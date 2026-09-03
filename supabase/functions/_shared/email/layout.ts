// The two reusable base layouts (Section 10 of the Phase 9 report):
// renderCustomerLayout and renderAdminLayout. Both produce a complete,
// self-contained HTML document — table-based structure, inline CSS
// throughout, a max-width of 600px (the long-standing email-safe width),
// and a small <style> block containing ONLY additive, non-critical
// responsive tweaks (clients that strip <style>, like older Outlook,
// still render a perfectly usable single-column email from the inline
// styles and table structure alone).
//
// Neither function sends anything or knows about Resend, event
// triggers, or the database — they are pure render(props) -> html
// functions, so 9D–9J's actual event handlers can call them without any
// of this file needing to change.

import { BRAND_COLORS } from './brand.ts'
import { escapeHtml } from './escape.ts'
import { EMAIL_STRINGS } from './strings.ts'
import {
  renderHeader,
  renderStatusBanner,
  renderBookingSummaryCard,
  renderCtaButton,
  renderFooter,
  renderAdminBar,
  renderRequiredAction,
} from './components.ts'
import type { CustomerEmailProps, AdminEmailProps } from './types.ts'

function documentShell(language: 'en' | 'ar', title: string, bodyContent: string): string {
  const rtl = language === 'ar'
  return `<!doctype html>
<html lang="${language}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(title)}</title>
<style>
  /* Additive only — a client that ignores <style> (e.g. older Outlook)
     still renders correctly from the inline styles and table widths
     below on its own. */
  @media only screen and (max-width: 600px) {
    .bliss-email-container { width: 100% !important; }
    .bliss-email-padded { padding-left: 16px !important; padding-right: 16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_COLORS.subtleBg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.subtleBg};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="bliss-email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${BRAND_COLORS.surface};border-radius:8px;overflow:hidden;">
        ${bodyContent}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function renderCustomerLayout(props: CustomerEmailProps): string {
  const strings = EMAIL_STRINGS[props.language]
  const rtl = props.language === 'ar'
  const ctaLabel = props.ctaLabel ?? strings.manageBooking

  const body = `
${renderHeader(props.language)}
<tr>
  <td style="padding:24px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${BRAND_COLORS.text};">
          ${escapeHtml(props.title)}
        </td>
      </tr>
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(props.message)}
        </td>
      </tr>
    </table>
  </td>
</tr>
${renderStatusBanner(props.statusTone, props.statusMessage, props.language)}
${renderBookingSummaryCard(props.summary, props.language)}
${props.extraContentHtml ?? ''}
${renderCtaButton(props.ctaUrl, ctaLabel, props.language)}
${renderFooter(props.language)}`

  return documentShell(props.language, props.title, body)
}

export function renderAdminLayout(props: AdminEmailProps): string {
  const strings = EMAIL_STRINGS[props.language]
  const rtl = props.language === 'ar'

  const body = `
${renderHeader(props.language)}
${renderAdminBar(props.alertType, props.priority, props.language)}
<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
      <tr>
        <td dir="${rtl ? 'rtl' : 'ltr'}" align="${rtl ? 'right' : 'left'}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND_COLORS.textMuted};">
          ${escapeHtml(strings.admin.customer)}: <strong style="color:${BRAND_COLORS.text};">${escapeHtml(props.customerName)}</strong>
        </td>
      </tr>
    </table>
  </td>
</tr>
${props.summary ? renderBookingSummaryCard(props.summary, props.language) : ''}
${props.detailsHtml ?? ''}
${props.requiredAction ? renderRequiredAction(props.requiredAction, props.language) : ''}
${renderCtaButton(props.dashboardUrl, strings.admin.openDashboard, props.language)}
${renderFooter(props.language)}`

  return documentShell(props.language, props.alertType, body)
}
