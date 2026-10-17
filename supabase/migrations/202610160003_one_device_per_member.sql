-- Cada pessoa ativa da equipe pode autorizar um computador.
-- O argumento device_limit é mantido para compatibilidade RPC e recebe sempre 1.
with ranked_devices as (
  select d.id,
         row_number() over (
           partition by d.member_id
           order by d.last_seen_at desc, d.first_seen_at desc, d.id desc
         ) as device_rank
    from public.acm360_devices d
   where d.revoked_at is null
)
update public.acm360_devices d
   set revoked_at = now()
  from ranked_devices r
 where d.id = r.id
   and r.device_rank > 1;

create unique index if not exists acm360_devices_member_one_active_key
  on public.acm360_devices (member_id)
  where revoked_at is null;

create or replace function public.acm360_activate_device(
  target_account_id uuid,
  target_member_id uuid,
  target_machine_id text,
  target_name text,
  device_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.acm360_devices%rowtype;
  active_count integer;
  activated_id uuid;
  device_found boolean;
begin
  if device_limit is null or device_limit <> 1 then
    raise exception 'device_limit_must_be_one_per_member' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_account_id::text, 1));

  select * into current_device
    from public.acm360_devices d
   where d.account_id = target_account_id
     and d.machine_id = target_machine_id
   for update;
  device_found := found;

  if device_found
     and current_device.member_id = target_member_id
     and current_device.revoked_at is null then
    update public.acm360_devices
       set name = target_name,
           last_seen_at = now()
     where id = current_device.id
     returning id into activated_id;
    return activated_id;
  end if;

  select count(*) into active_count
    from public.acm360_devices d
   where d.account_id = target_account_id
     and d.member_id = target_member_id
     and d.revoked_at is null
     and (not device_found or d.id <> current_device.id);
  if active_count >= device_limit then
    raise exception 'device_limit_reached' using errcode = '23514';
  end if;

  if device_found then
    update public.acm360_devices
       set member_id = target_member_id,
           name = target_name,
           first_seen_at = now(),
           last_seen_at = now(),
           revoked_at = null
     where id = current_device.id
     returning id into activated_id;
  else
    insert into public.acm360_devices (account_id, member_id, machine_id, name)
    values (target_account_id, target_member_id, target_machine_id, target_name)
    returning id into activated_id;
  end if;
  return activated_id;
end;
$$;

revoke all on function public.acm360_activate_device(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.acm360_activate_device(uuid, uuid, text, text, integer) to service_role;
