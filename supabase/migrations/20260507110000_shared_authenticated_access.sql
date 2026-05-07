-- Shared access model for all authenticated users.
-- Keeps RLS enabled, but removes owner-based isolation.

begin;

drop policy if exists apartments_select_own on public.apartments;
drop policy if exists apartments_insert_own on public.apartments;
drop policy if exists apartments_update_own on public.apartments;
drop policy if exists apartments_delete_own on public.apartments;

drop policy if exists stays_select_own on public.stays;
drop policy if exists stays_insert_own on public.stays;
drop policy if exists stays_update_own on public.stays;
drop policy if exists stays_delete_own on public.stays;

drop policy if exists apartments_select_shared on public.apartments;
drop policy if exists apartments_insert_shared on public.apartments;
drop policy if exists apartments_update_shared on public.apartments;
drop policy if exists apartments_delete_shared on public.apartments;

drop policy if exists stays_select_shared on public.stays;
drop policy if exists stays_insert_shared on public.stays;
drop policy if exists stays_update_shared on public.stays;
drop policy if exists stays_delete_shared on public.stays;

create policy apartments_select_shared
on public.apartments
for select
to authenticated
using (true);

create policy apartments_insert_shared
on public.apartments
for insert
to authenticated
with check (true);

create policy apartments_update_shared
on public.apartments
for update
to authenticated
using (true)
with check (true);

create policy apartments_delete_shared
on public.apartments
for delete
to authenticated
using (true);

create policy stays_select_shared
on public.stays
for select
to authenticated
using (true);

create policy stays_insert_shared
on public.stays
for insert
to authenticated
with check (true);

create policy stays_update_shared
on public.stays
for update
to authenticated
using (true)
with check (true);

create policy stays_delete_shared
on public.stays
for delete
to authenticated
using (true);

commit;
