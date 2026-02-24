-- Initial schema for new projects.
-- Creates core tables used by the frontend app.

begin;

create table if not exists public.apartments (
  id integer generated always as identity primary key,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  constraint apartments_name_not_empty check (char_length(trim(name)) >= 2)
);

create table if not exists public.stays (
  id integer generated always as identity primary key,
  guest_name text not null,
  guest_phone text not null,
  guest_email text not null,
  guest_address text not null,
  apartment_id integer not null references public.apartments(id) on delete restrict,
  people_count integer not null,
  nights_count integer not null,
  linen text,
  rating numeric(3, 1),
  notes text,
  check_in date,
  check_out date,
  year integer not null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  constraint stays_people_count_check check (people_count > 0),
  constraint stays_nights_count_check check (nights_count > 0),
  constraint stays_dates_check check (
    (check_in is null and check_out is null)
    or (check_in is not null and check_out is not null and check_out > check_in)
  ),
  constraint stays_year_check check (year between 2000 and 2100),
  constraint stays_rating_check check (rating is null or (rating >= 0 and rating <= 10))
);

commit;
