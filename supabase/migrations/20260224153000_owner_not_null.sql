-- Finalize owner_id as NOT NULL.
-- Run this migration only after backfilling existing rows.

begin;

do $$
begin
  if exists (select 1 from public.apartments where owner_id is null) then
    raise exception 'Cannot set apartments.owner_id NOT NULL: rows with NULL owner_id still exist.';
  end if;

  if exists (select 1 from public.stays where owner_id is null) then
    raise exception 'Cannot set stays.owner_id NOT NULL: rows with NULL owner_id still exist.';
  end if;
end
$$;

alter table public.apartments
  alter column owner_id set not null;

alter table public.stays
  alter column owner_id set not null;

commit;
