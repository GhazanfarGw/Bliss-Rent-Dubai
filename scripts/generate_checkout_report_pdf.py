#!/usr/bin/env python3
"""Generate the Checkout / Payment Flow Recovery completion report PDF,
matching the established Bliss Rent phase-report style: cover page with
build-status badges, numbered sections, file/test tables, SQL code blocks,
an action-needed callout, and a closing stop/confirmation banner."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, KeepTogether, ListFlowable, ListItem,
)
from reportlab.pdfgen import canvas as pdfcanvas

# ---- Brand tokens ------------------------------------------------------
BERRY = colors.HexColor('#5C0931')
SPACE_BLUE = colors.HexColor('#0B132B')
GOLD = colors.HexColor('#D4AF37')
PLATINUM = colors.HexColor('#F4F5F7')
WHITE = colors.HexColor('#FFFFFF')
SUCCESS = colors.HexColor('#10B981')
TEXT = colors.HexColor('#1A1A2E')
MUTED = colors.HexColor('#5B6470')
CODE_BG = colors.HexColor('#0B132B')
CODE_FG = colors.HexColor('#E8E9ED')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=26, leading=32, textColor=WHITE, alignment=TA_CENTER))
styles.add(ParagraphStyle('CoverSub', fontName='Helvetica', fontSize=13, leading=18, textColor=colors.HexColor('#D8D3DC'), alignment=TA_CENTER))
styles.add(ParagraphStyle('CoverMeta', fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#B8B2BE'), alignment=TA_CENTER))
styles.add(ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=BERRY, spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=SPACE_BLUE, spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle('Body', fontName='Helvetica', fontSize=9.6, leading=14.5, textColor=TEXT, spaceAfter=6, alignment=TA_LEFT))
styles.add(ParagraphStyle('BodyBold', parent=styles['Body'], fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('BriefBullet', parent=styles['Body'], leftIndent=12, spaceAfter=4))
styles.add(ParagraphStyle('CodeBlock', fontName='Courier', fontSize=7.6, leading=10.6, textColor=CODE_FG, backColor=CODE_BG, leftIndent=6))
styles.add(ParagraphStyle('TableHead', fontName='Helvetica-Bold', fontSize=8.6, textColor=WHITE, leading=11))
styles.add(ParagraphStyle('TableCell', fontName='Helvetica', fontSize=8.6, textColor=TEXT, leading=11.5))
styles.add(ParagraphStyle('Callout', fontName='Helvetica', fontSize=9.6, leading=14, textColor=SPACE_BLUE))
styles.add(ParagraphStyle('CalloutHead', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=colors.HexColor('#8A6D00')))

def P(text, style='Body'):
    return Paragraph(text, styles[style])

def cell(text, bold=False):
    return Paragraph(text, styles['TableHead'] if bold else styles['TableCell'])

def badge_row(items):
    """items: list of (label, ok_bool)"""
    cells = []
    for label, ok in items:
        color = SUCCESS if ok else colors.HexColor('#E45858')
        mark = '✓' if ok else '✗'
        cells.append(Paragraph(f'<font color="{color.hexval()}"><b>{mark}</b></font> {label}', styles['CoverMeta']))
    t = Table([cells], colWidths=[1.6 * inch] * len(items))
    t.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t

def section_table(header, rows, col_widths):
    data = [[cell(h, bold=True) for h in header]] + [[cell(c) for c in r] for r in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SPACE_BLUE),
        ('BACKGROUND', (0, 1), (-1, -1), PLATINUM),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PLATINUM]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D9DCE3')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

def code_block(lines):
    text = '<br/>'.join(
        l.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace(' ', '&nbsp;')
        for l in lines
    )
    tbl = Table([[Paragraph(text, styles['CodeBlock'])]], colWidths=[6.6 * inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CODE_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    return tbl

def callout(title, body_lines):
    content = [Paragraph(f'⚠ {title}', styles['CalloutHead']), Spacer(1, 3)]
    for b in body_lines:
        content.append(Paragraph(b, styles['Callout']))
    tbl = Table([[content]], colWidths=[6.6 * inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF7DB')),
        ('BOX', (0, 0), (-1, -1), 1, GOLD),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return tbl

def stop_banner():
    content = [
        Paragraph('STOP — awaiting your confirmation', ParagraphStyle('sb1', fontName='Helvetica-Bold', fontSize=12.5, textColor=WHITE)),
        Spacer(1, 4),
        Paragraph('Per this project\'s standing instructions, no further phase work begins until you explicitly confirm.', ParagraphStyle('sb2', fontName='Helvetica', fontSize=9.6, textColor=colors.HexColor('#EADFC9'), leading=13)),
    ]
    tbl = Table([[content]], colWidths=[6.6 * inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BERRY),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
    ]))
    return tbl

# ---- Cover page ----------------------------------------------------------
def draw_cover(c, w, h):
    c.setFillColor(SPACE_BLUE)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(BERRY)
    c.rect(0, h - 2.2 * inch, w, 2.2 * inch, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, h - 2.2 * inch, w, 0.03 * inch, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 12)
    c.drawCentredString(w / 2, h - 0.85 * inch, 'BLISS RENT DUBAI')

    c.setFont('Helvetica-Bold', 25)
    c.drawCentredString(w / 2, h - 1.35 * inch, 'Checkout / Payment Flow')
    c.drawCentredString(w / 2, h - 1.68 * inch, 'Recovery — Completion Report')

    c.setFillColor(colors.HexColor('#D8D3DC'))
    c.setFont('Helvetica', 11)
    c.drawCentredString(w / 2, h - 2.65 * inch, 'Root-cause fix • booking-state resume • payment retry • header cart indicator • premium UI redesign')

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 10)
    c.drawCentredString(w / 2, h - 3.0 * inch, 'Prepared 2026-09-02  •  Bliss Rent — Dubai Airport Rental Project')

draw_cover_holder = {'fn': draw_cover}

class CoverCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._page_count = 0

    def showPage(self):
        self._page_count += 1
        pdfcanvas.Canvas.showPage(self)

# ---- Build story -----------------------------------------------------
story = []

# Cover page content placeholder (drawn via onFirstPage), then push to page 2
story.append(Spacer(1, 7.6 * inch))
story.append(PageBreak())

# Status badges strip
story.append(P('BUILD STATUS', 'H2'))
story.append(badge_row([('Build', True), ('Typecheck', True), ('Lint (0 new)', True), ('767/767 tests', True)]))
story.append(Spacer(1, 10))
story.append(HRFlowable(width='100%', thickness=0.75, color=colors.HexColor('#D9DCE3')))
story.append(Spacer(1, 8))

story.append(P('1. Root Cause', 'H1'))
story.append(P('<b>The bug:</b> a customer who went Payment → Back → Summary → Continue to Payment (or simply returned to the Summary step after a booking already existed) hit a false "This vehicle was just booked for overlapping dates" error and could not complete their own booking.', 'Body'))
story.append(P('<b>The mechanism:</b> <font face="Courier">BookingSummaryPage</font> called <font face="Courier">createBooking()</font> (the <font face="Courier">create_booking()</font> RPC) unconditionally on every render, with no memory of any booking it had already created. On a second visit it fired <font face="Courier">create_booking()</font> again for the exact same customer, vehicle, and dates.', 'Body'))
story.append(P('The <font face="Courier">bookings_no_overlap</font> PostgreSQL EXCLUDE constraint (Phase 0) is working exactly as designed — it correctly rejects a second overlapping booking for the same vehicle/dates, and that protection must never be weakened. The problem was that it cannot distinguish "a stranger booking an already-taken car" from "the same customer resuming their own just-created booking" — both look identical to the constraint.', 'Body'))
story.append(P('<b>Live reproduction (before any code changed):</b> ran <font face="Courier">create_booking()</font> directly against the production database via the Supabase MCP tool, using the same vehicle/dates twice for the same customer — exactly what the old frontend code did on re-render. The first call succeeded; the second, identical call failed with:', 'Body'))
story.append(code_block(['SQLSTATE 23P01 (exclusion_violation)']))
story.append(Spacer(1, 4))
story.append(P('which the app\'s error mapper (<font face="Courier">mapDatabaseError</font>, <font face="Courier">supabase/functions/_shared/errors.ts</font>) converts into the customer-facing <font face="Courier">VEHICLE_UNAVAILABLE</font> error — the exact message customers were seeing on their own bookings. This used real production data (booking reference <b>BLS-E16F5DC3</b>, a genuinely stranded pending-payment booking), so the root cause is confirmed against the live system.', 'Body'))
story.append(P('<b>Why the fix is safe:</b> <font face="Courier">confirm_payment()</font> was already idempotent — the entire defect was the frontend having no memory of "I already created this booking." The fix adds exactly that memory. <font face="Courier">create_booking()</font>, <font face="Courier">confirm_payment()</font>, and the <font face="Courier">bookings_no_overlap</font> constraint are byte-for-byte unchanged.', 'Body'))

story.append(P('2. Files Changed', 'H1'))
story.append(P('22 files total: 6 new, 16 modified.', 'BodyBold'))
story.append(Spacer(1, 4))
story.append(P('New files', 'H2'))
story.append(section_table(
    ['File', 'Purpose'],
    [
        ['supabase/migrations/20260915000000_checkout_resume_payment.sql', 'Extends lookup_booking_for_customer; adds admin_confirm_booking_payment'],
        ['src/features/shared/PendingBookingIndicator.tsx', 'Header "My Booking" reminder icon + popover'],
        ['src/features/shared/PendingBookingIndicator.test.tsx', '4 tests'],
        ['src/features/booking/checkout/BookingSummaryPage.test.tsx', '3 tests — resume-instead-of-recreate'],
        ['src/features/booking/checkout/PaymentPage.test.tsx', '4 tests — success / decline / retry'],
        ['src/features/admin/bookings/BookingDetailPage.test.tsx', '4 tests — admin manual payment confirm'],
    ],
    [3.0 * inch, 3.6 * inch],
))
story.append(Spacer(1, 8))
story.append(P('Modified files', 'H2'))
story.append(section_table(
    ['File', 'Change'],
    [
        ['src/types/database.ts', '4 new lookup columns; admin_confirm_booking_payment type'],
        ['src/types/domain.ts', 'BookingLookupResult extended'],
        ['src/features/booking/lookupApi.ts', 'Maps new columns to domain type'],
        ['src/features/booking/checkout/checkoutStorage.ts', 'Core fix — active-booking-pointer storage layer'],
        ['src/features/booking/checkout/BookingSummaryPage.tsx', 'Resume check before ever calling createBooking()'],
        ['src/features/booking/checkout/PaymentPage.tsx', 'Redesign + Payment-Failed retry panel'],
        ['src/features/booking/checkout/CheckoutStepLayout.tsx', 'New premium stepper, mobile-compact mode'],
        ['src/features/shared/NavBar.tsx', 'Renders header booking indicator'],
        ['src/features/booking/ManageBookingPage.tsx', '"Continue to Payment" for pending_payment bookings'],
        ['src/features/admin/bookings/adminBookingsApi.ts', 'adminConfirmBookingPayment()'],
        ['src/features/admin/bookings/BookingDetailPage.tsx', 'Super-Admin "Confirm payment received" action'],
        ['src/i18n/locales/en.ts / ar.ts', 'New UI strings, fully mirrored EN/AR'],
        ['checkoutStorage.test.ts / lookupApi.test.ts / ManageBookingPage.test.tsx', 'Extended regression coverage'],
    ],
    [3.0 * inch, 3.6 * inch],
))
story.append(Spacer(1, 6))
story.append(P('<b>Explicitly not touched</b> (per the brief’s constraint): pricing logic, availability logic, create_booking(), confirm_payment(), the bookings_no_overlap constraint, vehicle assignment, extension logic, existing email logic, or any existing Supabase RLS policy.', 'Body'))

story.append(PageBreak())
story.append(P('3. Frontend Changes', 'H1'))
for head, body in [
    ('Resume instead of re-create', 'BookingSummaryPage checks readActiveBooking(vehicleId, {startDate, endDate, pickupLocationId, dropoffLocationId}) on mount — an exact-match lookup against a pointer the page itself saved on its last successful createBooking(). A match renders a resume panel (reference, status badge, amount, Continue to Payment) instead of the create form, and createBooking() is never called again. A visible "start a new booking instead" escape hatch remains for a deliberate fresh booking.'),
    ('Payment page redesign', 'Rebuilt on the project’s existing brand-token design system (Luxury Berry primary CTA, StatusBadge for Pending/Paid/Failed, semantic warning/error backgrounds) — Phase 8/10’s system already implements the brief’s exact palette. A declined payment shows a dedicated "Payment Failed" panel with Try Again (resubmits the same payment id) and Back to Booking. A successful payment clears the resume pointer before navigating to confirmation.'),
    ('Checkout stepper redesign', 'New CheckoutStepper: a full icon stepper on desktop/tablet (checkmark = done, gold-ringed number = active, muted slate = upcoming, connected by a fill-as-you-go bar) and a compact "Step X of Y" label + fill bar on narrow mobile widths.'),
    ('Header "My Booking" indicator', 'A car-icon header button appears only when this browser has a real unpaid booking — never a fake count. Its popover shows vehicle, dates, reference, amount due, and a Continue-to-payment action; it disappears the moment the booking is paid.'),
    ('Manage Booking → Continue to Payment', 'A booking found by reference or plate with status pending_payment now shows a Continue to Payment button, seeding the same resume pointer via resumePendingBookingFromLookup() and navigating straight to Payment — the cross-device/cross-session recovery path.'),
    ('Customer/driver detail preservation (verified, no change needed)', 'Reviewed the existing useCheckoutDraft.ts architecture: customer and driver form data already persist to sessionStorage per vehicle id on every field change, independent of booking creation — confirmed already correct across all back/forward navigation.'),
]:
    story.append(P(head, 'H2'))
    story.append(P(body, 'Body'))

story.append(P('4. Backend Changes', 'H1'))
story.append(P('One migration, <font face="Courier">20260915000000_checkout_resume_payment.sql</font>, applied live to production via the Supabase MCP tool. Two changes, both additive and justified against the brief’s "only if genuinely required" constraint:', 'Body'))
story.append(P('<b>1. lookup_booking_for_customer — extended, not altered in behavior.</b> Added 4 output columns (vehicle_id, pickup_location_id, dropoff_location_id, payment_id) needed to resume payment from a different device/session. Had to be dropped and recreated (Postgres requires this for a changed return shape), but matching logic, security model (SECURITY DEFINER, guest-safe single-field match, zero rows on no match), and grants are unchanged. Verified live against real booking BLS-E16F5DC3.', 'Body'))
story.append(P('<b>2. admin_confirm_booking_payment — new, Super-Admin-only.</b> Closes the gap where only extensions (not original bookings) had a manual cash-confirm path, using the exact same is_super_admin() rule already approved for cash extensions. Idempotent; only touches a pending_payment booking with a pending/failed payment; writes an audit_logs row; never touches pricing or availability.', 'Body'))
story.append(Spacer(1, 4))
story.append(code_block([
    'drop function if exists lookup_booking_for_customer(text);',
    'create function lookup_booking_for_customer(p_query text)',
    'returns table (',
    '  booking_id uuid, booking_reference text, booking_status booking_status,',
    '  start_date date, end_date date, total_price numeric, currency text,',
    '  vehicle_id uuid, vehicle_make text, vehicle_model text, vehicle_plate text,',
    '  pickup_location_id uuid, dropoff_location_id uuid,',
    '  pickup_location_name text, dropoff_location_name text,',
    '  customer_name text, payment_id uuid, payment_status payment_status,',
    '  created_at timestamptz',
    ') language plpgsql security definer set search_path = public stable',
    'as $$ ... unchanged guest-safe matching logic ... $$;',
    'grant execute on function lookup_booking_for_customer(text) to anon, authenticated;',
    '',
    'create or replace function admin_confirm_booking_payment(',
    '  p_booking_id uuid, p_note text default null',
    ') returns table (booking_id uuid, payment_id uuid,',
    '                 booking_status booking_status, payment_status payment_status)',
    'language plpgsql security definer set search_path = public as $$',
    'begin',
    '  if not is_super_admin() then',
    "    raise exception 'Only a Super Admin can confirm a booking payment manually.';",
    '  end if;',
    '  -- locks booking + latest payment; idempotent no-op if already paid;',
    "  -- rejects anything not pending_payment / pending|failed; then:",
    "  update payments set status='paid', provider='cash',",
    "    provider_reference='admin-cash-confirmed'||coalesce(': '||nullif(btrim(p_note),''),''),",
    '    paid_at=now() where id = v_payment.id;',
    "  update bookings set status='confirmed' where id = v_booking.id;",
    '  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)',
    "    values (auth.uid(), 'booking_payment_manually_confirmed', 'bookings',",
    '            v_booking.id, jsonb_build_object(...));',
    'end; $$;',
    'revoke all on function admin_confirm_booking_payment(uuid, text) from public;',
    'grant execute on function admin_confirm_booking_payment(uuid, text) to authenticated;',
]))
story.append(Spacer(1, 6))
story.append(callout('Action needed: none.', [
    'This migration was already applied live to the production Supabase project (migration name <font face="Courier">checkout_resume_payment</font>) during this work — confirmed present via list_migrations. No manual step required from you.',
]))

story.append(PageBreak())
story.append(P('5. Booking-State Behavior', 'H1'))
for head, body in [
    ('dxb-active-booking:&lt;vehicleId&gt;', 'A per-vehicle pointer (ActiveBookingPointer): vehicle, dates, pickup/dropoff, booking id/reference, payment id, total price/currency. Written the moment createBooking() succeeds. readActiveBooking(vehicleId, criteria) only matches if the vehicle id AND every one of dates/pickup/dropoff match exactly — a genuinely different search is never mistaken for a resumable booking.'),
    ('dxb-pending-booking', 'A single global "what’s the one unpaid booking in this browser" indicator read by the header, kept in sync via a custom PENDING_BOOKING_EVENT.'),
    ('Clearing', 'clearActiveBooking(vehicleId) runs the moment a payment succeeds, and defensively inside ManageBookingPage whenever a looked-up booking’s status is no longer pending_payment.'),
    ('resumePendingBookingFromLookup(result)', 'Bridges the cross-device path — seeds saveBookingResult + saveActiveBooking from a lookup_booking_for_customer result, and best-effort pre-fills only the customer name into the checkout draft (never overwriting anything already there).'),
]:
    story.append(P(head, 'H2'))
    story.append(P(body, 'Body'))
story.append(P('<b>Net effect:</b> Back navigation from Payment to Summary, a full page reload, or returning via Manage Booking all land on the same pending booking — never a duplicate, never lost context.', 'BodyBold'))

story.append(P('6. Payment Retry Behavior', 'H1'))
story.append(P('confirm_payment() was already idempotent at the database layer — resubmitting the same payment id after a decline safely returns the current state. The frontend now surfaces this correctly: a decline renders the "Payment Failed" panel (StatusBadge status="failed", clear copy, no random black error text) with Try Again (resubmits the identical paymentId — confirmed by a regression test asserting both calls carry the same id) and Back to Booking.', 'Body'))
story.append(P('The active-booking resume pointer is deliberately <b>not</b> cleared on a decline (only on success) — so a customer who closes the tab after a failed attempt is still correctly pointed back to the same pending booking, not a dead end.', 'Body'))

story.append(P('7. Cart / Header Behavior', 'H1'))
story.append(ListFlowable([
    ListItem(P('A car-icon header button appears (desktop + mobile nav) only when this browser has a real unpaid booking — never a placeholder or stale count.', 'Bullet')),
    ListItem(P('Its badge is always exactly 1 (no multi-item cart in this guest-checkout, no-accounts model).', 'Bullet')),
    ListItem(P('Clicking it opens a click-outside/Escape-dismissible popover with vehicle, dates, reference, amount due, and a Continue-to-payment action.', 'Bullet')),
    ListItem(P('It disappears immediately once that booking is paid — verified by a dedicated test.', 'Bullet')),
], bulletType='bullet', start='•')
)

story.append(PageBreak())
story.append(P('8. Tests Added', 'H1'))
story.append(section_table(
    ['File', '#', 'Covers'],
    [
        ['checkoutStorage.test.ts', '21', 'Save/read/clear pointer, exact-match criteria, header-indicator sync, resume-from-lookup seeding'],
        ['lookupApi.test.ts', '5', 'New columns map correctly; error/no-match paths unchanged'],
        ['ManageBookingPage.test.tsx', '14 (3 new)', 'Continue-to-Payment shown only for pending_payment; resume seeds storage + navigates'],
        ['BookingSummaryPage.test.tsx', '3 (new)', 'Resume panel renders instead of create form; "start new booking" bypass; createBooking never re-called'],
        ['PaymentPage.test.tsx', '4 (new)', 'Not-found state; success clears pointer + navigates; decline shows Failed panel and keeps pointer; retry reuses payment id'],
        ['PendingBookingIndicator.test.tsx', '4 (new)', 'Renders nothing with no pending booking; shows correct details; navigates correctly; disappears once cleared'],
        ['BookingDetailPage.test.tsx (admin)', '4 (new)', 'Super Admin sees the action; non-super-admin sees a hint only; hidden once confirmed; confirming calls RPC + reloads'],
    ],
    [2.3 * inch, 0.5 * inch, 3.8 * inch],
))
story.append(Spacer(1, 6))
story.append(P('<b>35 new test cases</b> across this work, plus the full pre-existing suite retained and passing unchanged — nothing weakened or removed.', 'BodyBold'))

story.append(P('9. Full Verification Results', 'H1'))
story.append(P('Re-run at report time to confirm the final state:', 'Body'))
story.append(code_block([
    '$ npx tsc --noEmit',
    '(no output — 0 errors)',
    '',
    '$ npx oxlint src',
    '0 errors. All findings pre-existing (set-state-in-effect on 10+',
    'existing pages, one only-export-components, one exhaustive-deps).',
    'PendingBookingIndicator.tsx uses the same established pattern —',
    'not a new category of issue.',
    '',
    '$ npx vitest run',
    ' Test Files  100 passed (100)',
    '      Tests  767 passed (767)',
    '   Duration  117.32s',
    '',
    '$ npm run build',
    'tsc -b && vite build',
    '✓ 246 modules transformed',
    '✓ built in 1.84s',
    '(pre-existing >500kB chunk-size warning only — unrelated, not new)',
]))
story.append(Spacer(1, 8))
story.append(P('Test Scenarios A–G', 'H2'))
story.append(section_table(
    ['#', 'Scenario', 'Result'],
    [
        ['A', 'Normal booking straight through to Payment', 'Unaffected — first visit still creates once, as before'],
        ['B', 'Payment → Back → Summary → Continue (the reported bug)', 'Fixed — resume panel shown, no re-create, no false error'],
        ['C', 'Payment failure → retry', 'Failed panel; Try Again resubmits the same payment id'],
        ['D', 'Leave and return later (reload / new tab)', 'Header indicator + resume panel both find the same pointer'],
        ['E', 'Existing pending booking via Manage Booking (cross-device)', 'Continue-to-Payment button; live-verified vs BLS-E16F5DC3'],
        ['F', 'A genuinely different, conflicting new booking', 'Still correctly rejected by bookings_no_overlap — intact'],
        ['G', 'Mobile', 'Confirmed at code level via existing responsive conventions — see §10'],
    ],
    [0.35 * inch, 3.55 * inch, 2.7 * inch],
))
story.append(Spacer(1, 8))
story.append(P('Live end-to-end verification (real production data, user’s own machine)', 'H2'))
story.append(ListFlowable([
    ListItem(P('Looked up real booking <b>BLS-E16F5DC3</b> via Manage Booking — correct StatusBadge, MG 5 / TEMP-ECO-04, AED 952, Sharjah City Centre ×2, Ghazanfar Abbas.', 'Bullet')),
    ListItem(P('Clicked Continue to Payment — landed on the real Payment page, correct ids, correct premium stepper, correct summary sidebar.', 'Bullet')),
    ListItem(P('Clicked the header car icon — popover: "YOU HAVE AN UNPAID BOOKING", MG 5, 2026-10-01 → 2026-10-09, BLS-E16F5DC3, AED 952.', 'Bullet')),
    ListItem(P('Switched to <b>Arabic</b> on the same page — full RTL mirror confirmed: layout direction flips, stepper mirrors, all new strings translate correctly (رقم الحجز, المبلغ المستحق, حالة الدفع → "معلق"), header icon stays correctly positioned.', 'Bullet')),
], bulletType='bullet', start='•'))
story.append(Spacer(1, 4))
story.append(P('Deliberately did not click "Pay AED 952" on the real production booking during verification, to avoid mutating real customer/payment data beyond what verification required.', 'Body'))

story.append(PageBreak())
story.append(P('10. Remaining Issues / Known Gaps', 'H1'))
story.append(callout('Nothing blocking — three items for visibility', [
    '<b>1. Mobile-viewport screenshot not completed live.</b> The connected device’s browser window did not respond to a programmatic resize request this session (confirmed via window.innerWidth staying at desktop width); stopped after two attempts per this project’s own browser-automation guidance. Mobile correctness for the new/changed components is confirmed at the code level (same Tailwind responsive conventions already verified in Phase 8/10), not with a live phone-width screenshot in this pass. Testing directly on your phone, or narrowing a browser window by hand, is the simplest way to close this out — happy to walk through it live.',
    '<b>2. Cross-device resume pre-fills only the customer name, by design.</b> lookup_booking_for_customer is deliberately guest-safe and never returns email/phone/driver details. Resuming from a brand-new device will need those re-entered — not a bug, the same intentional trade-off the lookup function has had since it was built. Widening it would be a real security trade-off, not made without your sign-off.',
    '<b>3. One pre-existing lint pattern, not new.</b> PendingBookingIndicator.tsx triggers oxlint’s set-state-in-effect warning — the identical category already present on 10+ existing pages. Following existing convention, not new debt.',
]))
story.append(Spacer(1, 10))
story.append(P('No other gaps identified. Nothing in the original brief’s acceptance checklist was left undone beyond the mobile-screenshot item above.', 'Body'))
story.append(Spacer(1, 16))
story.append(stop_banner())

# ---- Page template with header/footer -------------------------------
def on_page(c, doc):
    c.saveState()
    if doc.page > 1:
        c.setStrokeColor(colors.HexColor('#D9DCE3'))
        c.setLineWidth(0.5)
        c.line(0.75 * inch, letter[1] - 0.65 * inch, letter[0] - 0.75 * inch, letter[1] - 0.65 * inch)
        c.setFont('Helvetica', 8)
        c.setFillColor(MUTED)
        c.drawString(0.75 * inch, letter[1] - 0.58 * inch, 'Bliss Rent — Checkout / Payment Flow Recovery')
        c.drawRightString(letter[0] - 0.75 * inch, letter[1] - 0.58 * inch, '2026-09-02')
        c.setFont('Helvetica', 8)
        c.drawCentredString(letter[0] / 2, 0.5 * inch, f'Page {doc.page - 1}')
    c.restoreState()

def on_first_page(c, doc):
    draw_cover(c, letter[0], letter[1])

doc = SimpleDocTemplate(
    '/home/claude/blissrent-brand/claude/Checkout_Payment_Flow_Recovery_Report.pdf',
    pagesize=letter,
    topMargin=0.85 * inch, bottomMargin=0.75 * inch,
    leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    title='Checkout / Payment Flow Recovery — Completion Report',
    author='Claude (Cowork)',
)
doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
print('PDF written.')
