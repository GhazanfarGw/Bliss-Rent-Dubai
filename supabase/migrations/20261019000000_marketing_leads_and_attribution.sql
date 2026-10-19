-- Oct 2026 lead-gen sprint: booking attribution (UTM) + WhatsApp/social leads table.
-- Additive only: new nullable columns, a new table, a write-once RPC and a view.

-- 1) Attribution columns on bookings
alter table public.bookings
  add column if not exists utm_source    text,
  add column if not exists utm_medium    text,
  add column if not exists utm_campaign  text,
  add column if not exists utm_content   text,
  add column if not exists utm_term      text,
  add column if not exists referrer      text,
  add column if not exists landing_page  text,
  add column if not exists attributed_at timestamptz;

create index if not exists bookings_utm_source_idx on public.bookings (utm_source) where utm_source is not null;

-- Write-once: only bookings created in the last 2 hours, only if not yet attributed.
-- Called by the frontend (src/lib/tracking.ts) right after create-booking succeeds.
create or replace function public.set_booking_attribution(
  p_booking_id uuid,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_referrer text default null,
  p_landing_page text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated int;
begin
  update public.bookings b
     set utm_source    = left(nullif(trim(p_utm_source), ''), 100),
         utm_medium    = left(nullif(trim(p_utm_medium), ''), 100),
         utm_campaign  = left(nullif(trim(p_utm_campaign), ''), 150),
         utm_content   = left(nullif(trim(p_utm_content), ''), 150),
         utm_term      = left(nullif(trim(p_utm_term), ''), 150),
         referrer      = left(nullif(trim(p_referrer), ''), 500),
         landing_page  = left(nullif(trim(p_landing_page), ''), 500),
         attributed_at = now()
   where b.id = p_booking_id
     and b.attributed_at is null
     and b.created_at > now() - interval '2 hours';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end $$;

grant execute on function public.set_booking_attribution(uuid,text,text,text,text,text,text,text) to anon, authenticated;

-- 2) Leads (WhatsApp / social / ads enquiries), admin-only
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'whatsapp'
    check (source in ('google','meta','instagram','facebook','tiktok','x','website','whatsapp','referral','other')),
  source_code text,                 -- GG / FB / IG / TT / X from the pre-filled WhatsApp text
  full_name text,
  phone text,
  email text,
  car_interest text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  pickup_location_id uuid references public.locations(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'new' check (status in ('new','quoted','booked','lost')),
  lost_reason text,
  booking_id uuid references public.bookings(id) on delete set null,
  estimated_value numeric(12,2),
  currency text not null default 'AED',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  created_by uuid default auth.uid(),
  next_follow_up_at timestamptz
);

create index if not exists leads_created_at_idx         on public.leads (created_at desc);
create index if not exists leads_status_idx             on public.leads (status);
create index if not exists leads_source_idx             on public.leads (source);
create index if not exists leads_vehicle_id_idx         on public.leads (vehicle_id);
create index if not exists leads_pickup_location_id_idx on public.leads (pickup_location_id);
create index if not exists leads_booking_id_idx         on public.leads (booking_id);

create or replace function public.leads_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger leads_set_updated_at before update on public.leads
for each row execute function public.leads_set_updated_at();

alter table public.leads enable row level security;

create policy leads_admin_all on public.leads
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 3) Daily lead summary (security_invoker → same admin-only RLS as leads)
create or replace view public.marketing_daily_summary
with (security_invoker = true) as
select d::date as day,
       coalesce(l.source, 'none') as source,
       count(l.id) as leads,
       count(l.id) filter (where l.status = 'booked') as booked_leads,
       coalesce(sum(l.estimated_value) filter (where l.status = 'booked'), 0) as booked_value
from generate_series(date '2026-10-19', current_date, interval '1 day') d
left join public.leads l on l.created_at::date = d::date
group by 1, 2
order by 1 desc, 2;
