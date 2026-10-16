-- Executed on RESONG project after security advisor reported publicly callable trigger functions.
revoke execute on function public.handle_new_user() from PUBLIC, anon, authenticated;
revoke execute on function public.touch_updated_at() from PUBLIC, anon, authenticated;
