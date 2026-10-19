-- Bliss Rent — security hardening (run once in Supabase → SQL Editor)
-- 1) resolve_extension_conflict has no caller check and was callable without login.
--    It is only used internally by other SECURITY DEFINER functions, so remove API access.
revoke execute on function public.resolve_extension_conflict(uuid,uuid,uuid,date,uuid) from public, anon, authenticated;

-- 2) Admin RPCs already check the admin role inside; also remove anonymous (logged-out) access.
revoke execute on function public.admin_cancel_booking(uuid,text) from public, anon;
revoke execute on function public.admin_confirm_booking_payment(uuid,text) from public, anon;
revoke execute on function public.admin_confirm_booking_vehicle(uuid,text,text) from public, anon;
revoke execute on function public.admin_mark_returned(uuid,text) from public, anon;
revoke execute on function public.admin_start_rental(uuid,text) from public, anon;
revoke execute on function public.admin_reset_all_test_data() from public, anon;
revoke execute on function public.reject_extension_request(uuid,text) from public, anon;
revoke execute on function public.confirm_booking_extension_payment(uuid,payment_status,text) from public, anon;

-- Keep them working for signed-in admins (the admin dashboard).
grant execute on function public.admin_cancel_booking(uuid,text) to authenticated;
grant execute on function public.admin_confirm_booking_payment(uuid,text) to authenticated;
grant execute on function public.admin_confirm_booking_vehicle(uuid,text,text) to authenticated;
grant execute on function public.admin_mark_returned(uuid,text) to authenticated;
grant execute on function public.admin_start_rental(uuid,text) to authenticated;
grant execute on function public.admin_reset_all_test_data() to authenticated;
grant execute on function public.reject_extension_request(uuid,text) to authenticated;
grant execute on function public.confirm_booking_extension_payment(uuid,payment_status,text) to authenticated;

-- 3) Trigger functions are never called through the API.
revoke execute on function public.admin_profiles_guard_changes() from public, anon, authenticated;
revoke execute on function public.pricing_sync_derived_terms() from public, anon, authenticated;
