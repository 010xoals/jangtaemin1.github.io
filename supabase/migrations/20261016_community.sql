-- RE:SONG community schema v1
-- Apply in Supabase SQL Editor as project owner.
-- No email, access token or Google credential is stored in public tables.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '음악 친구',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check
    check (char_length(btrim(display_name)) between 1 and 40)
);

create table if not exists public.songs (
  id uuid primary key,
  title text not null,
  artist text not null,
  country_code text not null check (country_code in ('KR','JP','US','OTHER')),
  country_name text,
  first_release_date date not null,
  musicbrainz_url text,
  video_id text check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint songs_title_length check (char_length(title) between 1 and 240),
  constraint songs_artist_length check (char_length(artist) between 1 and 240)
);

create index if not exists songs_release_date_idx
  on public.songs (first_release_date desc);
create index if not exists songs_country_date_idx
  on public.songs (country_code, first_release_date desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete restrict,
  user_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_body_length check (char_length(body) <= 1500),
  constraint reviews_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade,
  constraint reviews_one_per_user_song unique (user_id, song_id)
);

create index if not exists reviews_song_date_idx
  on public.reviews (song_id, created_at desc);
create index if not exists reviews_user_date_idx
  on public.reviews (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles for each row
  execute function public.touch_updated_at();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews for each row
  execute function public.touch_updated_at();

-- Google OAuth and email signups both create a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposed_name text;
begin
  proposed_name := left(btrim(coalesce(nullif(new.raw_user_meta_data->>'name',''), '음악 친구')), 40);
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(proposed_name,''),'음악 친구'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists resong_auth_user_created on auth.users;
create trigger resong_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional one-time backfill for already-signed-in users.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data->>'name'),40),''),'음악 친구')
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.reviews enable row level security;

-- Only the catalog collector's service-role key may insert/update songs.
revoke all on public.songs from anon, authenticated;
grant select on public.songs to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (song_id, user_id, rating, body) on public.reviews to authenticated;
grant update (rating, body) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select to anon,authenticated using (true);

drop policy if exists "members edit their profile" on public.profiles;
create policy "members edit their profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "catalog is readable" on public.songs;
create policy "catalog is readable" on public.songs
  for select to anon,authenticated using (true);

drop policy if exists "reviews are readable" on public.reviews;
create policy "reviews are readable" on public.reviews
  for select to anon,authenticated using (true);

drop policy if exists "members write their own reviews" on public.reviews;
create policy "members write their own reviews" on public.reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "members update their own reviews" on public.reviews;
create policy "members update their own reviews" on public.reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "members delete their own reviews" on public.reviews;
create policy "members delete their own reviews" on public.reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Invoker view ensures RLS of underlying songs/reviews applies.
create or replace view public.song_rating_summary
with (security_invoker = true)
as
select s.id as song_id,
       count(r.id)::integer as rating_count,
       round(avg(r.rating)::numeric, 2) as average_rating
  from public.songs s
  left join public.reviews r on r.song_id = s.id
 group by s.id;

grant select on public.song_rating_summary to anon,authenticated;
commit;
