alter table if exists public.stays
  add column if not exists amount_paid numeric(10, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stays_amount_paid_check'
      and conrelid = 'public.stays'::regclass
  ) then
    alter table public.stays
      add constraint stays_amount_paid_check
      check (amount_paid is null or amount_paid >= 0);
  end if;
end $$;
