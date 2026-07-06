-- ============================================================
-- Alliance Polysacks — RP Plant Reporting App
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Free tier, no card needed.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Daily entry tables (open to the anon key — internal tool) ----------

create table if not exists wastage_entries (
  id text primary key,              -- `${plant}_${date}`, e.g. oldRp_2026-06-30
  plant text not null check (plant in ('oldRp', 'newRp')),
  date date not null,
  values jsonb not null default '{}',
  notes text not null default '',
  saved boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists production_entries (
  id text primary key,
  plant text not null check (plant in ('oldRp', 'newRp')),
  date date not null,
  shift_a jsonb not null default '{"rows":[],"lumps":0,"stopped":false}',
  shift_b jsonb not null default '{"rows":[],"lumps":0,"stopped":false}',
  notes text not null default '',
  saved boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists granule_issues (
  date date primary key,
  rows jsonb not null default '[]',
  notes text not null default '',
  saved boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists wastage_entries_plant_date_idx on wastage_entries (plant, date desc);
create index if not exists production_entries_plant_date_idx on production_entries (plant, date desc);

alter table wastage_entries enable row level security;
alter table production_entries enable row level security;
alter table granule_issues enable row level security;

-- Open read/write for the anon key on the three operational tables — this is
-- an internal plant tool, not public-facing, so a simple "true" policy is a
-- reasonable trade-off for zero-auth simplicity. Tighten later with real
-- operator logins if you ever need to know *who* logged an entry.
create policy "anon read wastage" on wastage_entries for select using (true);
create policy "anon write wastage" on wastage_entries for insert with check (true);
create policy "anon update wastage" on wastage_entries for update using (true);

create policy "anon read production" on production_entries for select using (true);
create policy "anon write production" on production_entries for insert with check (true);
create policy "anon update production" on production_entries for update using (true);

create policy "anon read granules" on granule_issues for select using (true);
create policy "anon write granules" on granule_issues for insert with check (true);
create policy "anon update granules" on granule_issues for update using (true);

-- ---------- Admin settings (passcode + money rules) — LOCKED from the anon key ----------

create table if not exists admin_settings (
  id int primary key default 1,
  passcode_hash text not null,
  old_rate numeric not null default 2.10,
  old_ded_both numeric not null default 4025,
  new_rate numeric not null default 2.75,
  new_ded_both numeric not null default 3760,
  updated_at timestamptz not null default now(),
  constraint admin_settings_singleton check (id = 1)
);

alter table admin_settings enable row level security;
-- Deliberately NO policies here → anon/authenticated get zero direct access.
-- The RPC functions below are SECURITY DEFINER, so they can still read/write
-- this table on the client's behalf, but only after checking the passcode.

insert into admin_settings (id, passcode_hash, old_rate, old_ded_both, new_rate, new_ded_both)
values (1, encode(digest('232003', 'sha256'), 'hex'), 2.10, 4025, 2.75, 3760)
on conflict (id) do nothing;

-- ---------- RPC functions (these are the "backend") ----------

create or replace function verify_admin_passcode(passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare stored text;
begin
  select passcode_hash into stored from admin_settings where id = 1;
  return stored is not null and stored = encode(digest(passcode, 'sha256'), 'hex');
end;
$$;

-- Returns the rate + both-shift deduction for one plant, ONLY if the passcode
-- is correct. One-shift deduction is always half of dedBoth (your rule) —
-- computed client-side, never stored separately.
create or replace function get_admin_rates(passcode text, plant_key text)
returns table(rate numeric, ded_both numeric)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare stored text;
begin
  select passcode_hash into stored from admin_settings where id = 1;
  if stored is null or stored <> encode(digest(passcode, 'sha256'), 'hex') then
    raise exception 'Incorrect passcode';
  end if;
  if plant_key = 'oldRp' then
    return query select old_rate, old_ded_both from admin_settings where id = 1;
  else
    return query select new_rate, new_ded_both from admin_settings where id = 1;
  end if;
end;
$$;

-- Verifies the CURRENT passcode, then updates whichever fields are passed in.
-- Pass new_passcode = null to leave the password unchanged.
create or replace function update_admin_settings(
  current_passcode text,
  new_passcode text default null,
  p_old_rate numeric default null,
  p_old_ded_both numeric default null,
  p_new_rate numeric default null,
  p_new_ded_both numeric default null
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare stored text;
begin
  select passcode_hash into stored from admin_settings where id = 1;
  if stored is null or stored <> encode(digest(current_passcode, 'sha256'), 'hex') then
    raise exception 'Current password is incorrect';
  end if;

  if new_passcode is not null and new_passcode !~ '^[0-9]{6}$' then
    raise exception 'New password must be exactly 6 digits';
  end if;

  update admin_settings set
    passcode_hash = case when new_passcode is not null then encode(digest(new_passcode, 'sha256'), 'hex') else passcode_hash end,
    old_rate = coalesce(p_old_rate, old_rate),
    old_ded_both = coalesce(p_old_ded_both, old_ded_both),
    new_rate = coalesce(p_new_rate, new_rate),
    new_ded_both = coalesce(p_new_ded_both, new_ded_both),
    updated_at = now()
  where id = 1;

  return true;
end;
$$;

-- Let the anon (public) key call these three functions — this is what makes
-- them reachable from the browser via supabase.rpc(...). The functions
-- themselves still gate everything on the passcode.
grant execute on function verify_admin_passcode(text) to anon, authenticated;
grant execute on function get_admin_rates(text, text) to anon, authenticated;
grant execute on function update_admin_settings(text, text, numeric, numeric, numeric, numeric) to anon, authenticated;

-- Explicitly make sure the table itself stays unreachable directly.
revoke all on admin_settings from anon, authenticated;
