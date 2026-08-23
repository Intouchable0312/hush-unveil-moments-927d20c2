create or replace function public.has_purchased_post(_user_id uuid, _post_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.post_purchases where post_id = _post_id and buyer_id = _user_id)
$$;

create or replace function public.is_post_creator(_user_id uuid, _post_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.posts where id = _post_id and creator_id = _user_id)
$$;

revoke all on function public.has_purchased_post(uuid, uuid) from public, anon;
revoke all on function public.is_post_creator(uuid, uuid) from public, anon;
grant execute on function public.has_purchased_post(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_post_creator(uuid, uuid) to authenticated, service_role;

drop policy if exists "posts read entitled" on public.posts;
create policy "posts read entitled" on public.posts for select to authenticated
using (
  creator_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'subscribers' and public.is_subscribed(auth.uid(), creator_id))
  or (visibility = 'ppv' and public.has_purchased_post(auth.uid(), id))
);

drop policy if exists "pp read creator" on public.post_purchases;
create policy "pp read creator" on public.post_purchases for select to authenticated
using (public.is_post_creator(auth.uid(), post_id));