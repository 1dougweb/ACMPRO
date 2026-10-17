-- Renomeia as tabelas comerciais antigas sem copiar ou apagar dados.
-- Chaves estrangeiras, índices, políticas RLS e grants permanecem ligados às relações.
do $$
declare
  item record;
  definition text;
  fn record;
begin
  for item in
    select * from (values
      ('acm360_accounts', 'license_accounts'),
      ('acm360_members', 'license_members'),
      ('acm360_subscriptions', 'license_subscriptions'),
      ('acm360_orders', 'license_orders'),
      ('acm360_devices', 'license_devices'),
      ('acm360_webhook_events', 'license_webhook_events'),
      ('acm360_payments', 'license_payments')
    ) as table_names(old_name, new_name)
  loop
    if to_regclass('public.' || item.old_name) is not null then
      if to_regclass('public.' || item.new_name) is not null then
        raise exception 'Migração interrompida: public.% e public.% existem ao mesmo tempo; reconcilie os dados antes de continuar', item.old_name, item.new_name;
      end if;

      execute format('alter table public.%I rename to %I', item.old_name, item.new_name);
    end if;
  end loop;

  -- Funções PL/pgSQL guardam o corpo como texto; ajusta referências internas.
  for fn in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosrc ~ 'acm360_(accounts|members|subscriptions|orders|devices|webhook_events|payments)'
  loop
    definition := pg_get_functiondef(fn.oid);
    for item in
      select * from (values
        ('acm360_accounts', 'license_accounts'),
        ('acm360_members', 'license_members'),
        ('acm360_subscriptions', 'license_subscriptions'),
        ('acm360_orders', 'license_orders'),
        ('acm360_devices', 'license_devices'),
        ('acm360_webhook_events', 'license_webhook_events'),
        ('acm360_payments', 'license_payments')
      ) as table_names(old_name, new_name)
    loop
      definition := replace(definition, item.old_name, item.new_name);
    end loop;
    execute definition;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
