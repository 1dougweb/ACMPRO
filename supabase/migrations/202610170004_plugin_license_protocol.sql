-- Compatibilidade do protocolo de login/licença exigido pelo plugin SketchUp.
-- Segredos de dispositivo são armazenados somente como SHA-256.

alter table public.license_devices
  add column if not exists secret_hash text;

alter table public.license_members
  add column if not exists preferred_locale text not null default 'pt-BR'
  check (preferred_locale in ('pt-BR', 'en', 'es'));

create or replace function public.license_activate_device_with_secret(
  target_account_id uuid,
  target_member_id uuid,
  target_machine_id text,
  target_name text,
  target_secret_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.license_devices%rowtype;
  active_count integer;
  activated_id uuid;
  device_found boolean;
begin
  if target_machine_id is null or length(target_machine_id) < 16 or length(target_machine_id) > 255 then
    raise exception 'invalid_machine_id' using errcode = '22023';
  end if;
  if target_secret_hash is null or target_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_device_secret_hash' using errcode = '22023';
  end if;

  -- Serializa ativações da mesma pessoa, mantendo o limite de um computador.
  perform pg_advisory_xact_lock(hashtextextended(target_account_id::text || ':' || target_member_id::text, 1));

  select * into current_device
    from public.license_devices d
   where d.account_id = target_account_id
     and d.machine_id = target_machine_id
   for update;
  device_found := found;

  if device_found
     and current_device.member_id = target_member_id
     and current_device.revoked_at is null then
    update public.license_devices
       set name = left(coalesce(nullif(target_name, ''), 'SketchUp'), 100),
           last_seen_at = now(),
           secret_hash = target_secret_hash
     where id = current_device.id
     returning id into activated_id;
    return activated_id;
  end if;

  select count(*) into active_count
    from public.license_devices d
   where d.account_id = target_account_id
     and d.member_id = target_member_id
     and d.revoked_at is null
     and (not device_found or d.id <> current_device.id);
  if active_count >= 1 then
    raise exception 'device_limit_reached' using errcode = '23514';
  end if;

  if device_found then
    update public.license_devices
       set member_id = target_member_id,
           name = left(coalesce(nullif(target_name, ''), 'SketchUp'), 100),
           first_seen_at = now(),
           last_seen_at = now(),
           revoked_at = null,
           secret_hash = target_secret_hash
     where id = current_device.id
     returning id into activated_id;
  else
    insert into public.license_devices (account_id, member_id, machine_id, name, secret_hash)
    values (target_account_id, target_member_id, target_machine_id,
            left(coalesce(nullif(target_name, ''), 'SketchUp'), 100), target_secret_hash)
    returning id into activated_id;
  end if;
  return activated_id;
end;
$$;

revoke all on function public.license_activate_device_with_secret(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.license_activate_device_with_secret(uuid, uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
