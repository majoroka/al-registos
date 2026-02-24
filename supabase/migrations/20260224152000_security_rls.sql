-- Ownership + RLS hardening for apartments/stays.
-- Apply with: supabase db push

begin;

alter table if exists public.apartments
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table if exists public.stays
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table if exists public.apartments
  alter column owner_id set default auth.uid();

alter table if exists public.stays
  alter column owner_id set default auth.uid();

create index if not exists idx_apartments_owner_name
  on public.apartments(owner_id, name);

create index if not exists idx_stays_owner_year_apartment
  on public.stays(owner_id, year, apartment_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stays_people_count_check'
      and conrelid = 'public.stays'::regclass
  ) then
    alter table public.stays
      add constraint stays_people_count_check
      check (people_count > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'stays_nights_count_check'
      and conrelid = 'public.stays'::regclass
  ) then
    alter table public.stays
      add constraint stays_nights_count_check
      check (nights_count > 0);
  end if;
end
$$;

alter table if exists public.apartments enable row level security;
alter table if exists public.stays enable row level security;

drop policy if exists apartments_select_own on public.apartments;
drop policy if exists apartments_insert_own on public.apartments;
drop policy if exists apartments_update_own on public.apartments;
drop policy if exists apartments_delete_own on public.apartments;

create policy apartments_select_own
on public.apartments
for select
to authenticated
using (owner_id = auth.uid());

create policy apartments_insert_own
on public.apartments
for insert
to authenticated
with check (owner_id = auth.uid());

create policy apartments_update_own
on public.apartments
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy apartments_delete_own
on public.apartments
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists stays_select_own on public.stays;
drop policy if exists stays_insert_own on public.stays;
drop policy if exists stays_update_own on public.stays;
drop policy if exists stays_delete_own on public.stays;

create policy stays_select_own
on public.stays
for select
to authenticated
using (owner_id = auth.uid());

create policy stays_insert_own
on public.stays
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.apartments a
    where a.id = apartment_id
      and a.owner_id = auth.uid()
  )
);

create policy stays_update_own
on public.stays
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.apartments a
    where a.id = apartment_id
      and a.owner_id = auth.uid()
  )
);

create policy stays_delete_own
on public.stays
for delete
to authenticated
using (owner_id = auth.uid());

revoke all on table public.apartments from anon;
revoke all on table public.stays from anon;

grant select, insert, update, delete on table public.apartments to authenticated;
grant select, insert, update, delete on table public.stays to authenticated;

commit;
