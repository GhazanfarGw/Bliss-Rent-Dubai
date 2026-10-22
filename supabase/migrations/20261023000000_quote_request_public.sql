-- "Get a quote" form backend (2026-10-23).
--
-- Guest quote requests land in public.leads (admin-only RLS, unchanged).
-- Guests never write the table directly: the submit-quote-request Edge
-- Function validates the payload, then calls this SECURITY DEFINER
-- function with the service-role key. EXECUTE is granted to service_role
-- only, so the anon key in the browser cannot call it directly.
--
-- Server-side rate limits (the browser cannot bypass these):
--   * max 3 requests per phone number per hour
--   * max 40 requests site-wide per 10 minutes (bot flood guard)

create or replace function public.submit_quote_request_public(
  p_full_name          text,
  p_phone              text,
  p_email              text default null,
  p_car_interest       text default null,
  p_vehicle_id         uuid default null,
  p_pickup_location_id uuid default null,
  p_start_date         date default null,
  p_end_date           date default null,
  p_notes              text default null,
  p_utm_source         text default null,
  p_utm_medium         text default null,
  p_utm_campaign       text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := left(nullif(trim(p_full_name), ''), 80);
  v_phone  text := left(nullif(trim(p_phone), ''), 20);
  v_utm    text := lower(nullif(trim(p_utm_source), ''));
  v_source text;
  v_value  numeric(12,2);
  v_id     uuid;
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'Please enter your name.';
  end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Please enter a valid phone number with country code.';
  end if;
  if p_start_date is not null and p_start_date < current_date - 1 then
    raise exception 'Pickup date cannot be in the past.';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Return date must be after the pickup date.';
  end if;

  if (select count(*) from leads
        where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'We already have your request — our team will contact you shortly.';
  end if;
  if (select count(*) from leads
        where source_code = 'QUOTE' and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'We are receiving a lot of requests right now. Please message us on WhatsApp.';
  end if;

  v_source := case
    when v_utm in ('google','meta','instagram','facebook','tiktok','x') then v_utm
    when v_utm in ('ig') then 'instagram'
    when v_utm in ('fb') then 'facebook'
    else 'website'
  end;

  -- Rough value for the admin (daily client price × days), when a car and dates are given.
  if p_vehicle_id is not null and p_start_date is not null and p_end_date is not null then
    select pr.client_price * greatest(1, (p_end_date - p_start_date))
      into v_value
      from pricing pr
     where pr.vehicle_id = p_vehicle_id and pr.term = 'daily'
     limit 1;
  end if;

  insert into leads (
    source, source_code, full_name, phone, email, car_interest, vehicle_id,
    pickup_location_id, start_date, end_date, status, estimated_value,
    utm_source, utm_medium, utm_campaign, notes, created_by
  ) values (
    v_source, 'QUOTE', v_name, v_phone,
    left(nullif(trim(p_email), ''), 120),
    left(nullif(trim(p_car_interest), ''), 120),
    (select id from vehicles where id = p_vehicle_id),
    (select id from locations where id = p_pickup_location_id),
    p_start_date, p_end_date, 'new', v_value,
    left(nullif(trim(p_utm_source), ''), 100),
    left(nullif(trim(p_utm_medium), ''), 100),
    left(nullif(trim(p_utm_campaign), ''), 150),
    left(nullif(trim(p_notes), ''), 1000),
    null
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.submit_quote_request_public(text,text,text,text,uuid,uuid,date,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_quote_request_public(text,text,text,text,uuid,uuid,date,date,text,text,text,text) to service_role;

create index if not exists leads_phone_created_idx on public.leads (phone, created_at desc);
