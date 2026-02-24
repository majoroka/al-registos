begin;

alter table if exists public.stays
  add column if not exists check_in date;

alter table if exists public.stays
  add column if not exists check_out date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stays_dates_check'
      and conrelid = 'public.stays'::regclass
  ) then
    alter table public.stays
      add constraint stays_dates_check
      check (
        (check_in is null and check_out is null)
        or (check_in is not null and check_out is not null and check_out > check_in)
      );
  end if;
end
$$;

commit;
