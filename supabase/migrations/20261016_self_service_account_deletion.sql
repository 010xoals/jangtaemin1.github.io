-- RE:SONG user-initiated deletion. Applied to Supabase 2026-10-16.
-- The exposed RPC uses SECURITY INVOKER; privileged operation remains in a private schema.
create schema if not exists resong_internal;
revoke all on schema resong_internal from public, anon;
grant usage on schema resong_internal to authenticated;

create or replace function resong_internal.remove_current_auth_user()
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid;
begin
  actor := (select auth.uid());
  if actor is null or (select auth.role()) <> 'authenticated' then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = actor;
  if not found then raise exception 'User not found'; end if;
end;
$$;
revoke all on function resong_internal.remove_current_auth_user() from public, anon;
grant execute on function resong_internal.remove_current_auth_user() to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  perform resong_internal.remove_current_auth_user();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
