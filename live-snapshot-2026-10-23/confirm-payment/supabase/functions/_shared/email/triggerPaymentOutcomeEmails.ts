import { triggerCustomerBookingEmail } from './triggerCustomerBookingEmail.ts'
import { createSupabaseEmailLogStore } from './supabaseEmailLogStore.ts'
import { triggerAdminOperationalEmail } from './triggerAdminOperationalEmail.ts'
import { createSupabaseAdminEmailLogStore } from './supabaseAdminEmailLogStore.ts'
import { getResendSenderConfig } from './emailSenderConfig.ts'
import type { BookingEmailDataSource } from './bookingEmailData.ts'
import type { DeliverAdminOperationalEmailsDataSource } from './deliverAdminOperationalEmails.ts'
import type { EmailLanguage } from './strings.ts'

export interface PaymentOutcomeEmailClient extends BookingEmailDataSource, DeliverAdminOperationalEmailsDataSource {
  auth: {
    admin: {
      getUserById(id: string): Promise<{ data: { user: { email?: string | null } | null }; error: { message: string } | null }>
    }
  }
}

export interface PaymentOutcomeEmailArgs {
  supabaseAdmin: PaymentOutcomeEmailClient
  bookingId: string
  paymentStatus: 'paid' | 'failed'
  language: EmailLanguage
}

export async function sendPaymentOutcomeEmails({
  supabaseAdmin,
  bookingId,
  paymentStatus,
  language,
}: PaymentOutcomeEmailArgs): Promise<void> {
  await triggerCustomerBookingEmail({
    dataSource: supabaseAdmin,
    emailLog: createSupabaseEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: getResendSenderConfig('customer', Deno.env).fromAddress,
      replyTo: getResendSenderConfig('customer', Deno.env).replyTo,
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
    bookingId,
    eventType: paymentStatus === 'paid' ? 'booking_confirmed' : 'payment_failed',
    language,
  })

  await triggerAdminOperationalEmail({
    dataSource: supabaseAdmin,
    async getAdminEmail(id: string) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
      if (error || !data.user) return null
      return data.user.email ?? null
    },
    emailLog: createSupabaseAdminEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: getResendSenderConfig('admin', Deno.env).fromAddress,
      replyTo: getResendSenderConfig('admin', Deno.env).replyTo,
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
    bookingId,
    eventType: paymentStatus === 'paid' ? 'admin_booking_confirmed' : 'admin_payment_failed',
    language,
    dashboardPath: `/admin/bookings/${bookingId}`,
  })
}
