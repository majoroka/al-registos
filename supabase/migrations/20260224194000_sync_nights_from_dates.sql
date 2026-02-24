begin;

create or replace function public.stays_sync_derived_fields()
returns trigger
language plpgsql
as $$
begin
  if new.check_in is not null and new.check_out is not null then
    if new.check_out <= new.check_in then
      raise exception 'check_out must be after check_in';
    end if;

    new.nights_count := (new.check_out - new.check_in);
    new.year := extract(year from new.check_in)::int;
  end if;

  return new;
end;
$$;

drop trigger if exists stays_sync_derived_fields_trigger on public.stays;

create trigger stays_sync_derived_fields_trigger
before insert or update on public.stays
for each row
execute function public.stays_sync_derived_fields();

update public.stays
set
  nights_count = (check_out - check_in),
  year = extract(year from check_in)::int
where check_in is not null and check_out is not null and check_out > check_in;

commit;
