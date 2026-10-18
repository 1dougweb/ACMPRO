-- Tabela de configuração dinâmica de preços do portal ACMGO
create table if not exists public.license_pricing_config (
  id integer primary key default 1,
  monthly_amount_cents integer not null default 9700 check (monthly_amount_cents > 0),
  annual_amount_cents integer not null default 97000 check (annual_amount_cents > 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Inserir valor padrão se a tabela estiver vazia
insert into public.license_pricing_config (id, monthly_amount_cents, annual_amount_cents, updated_by)
values (1, 9700, 97000, 'system_init')
on conflict (id) do nothing;

alter table public.license_pricing_config enable row level security;

-- Política de leitura pública (necessária para exibir ofertas mesmo deslogado)
create policy "Pricing config is viewable by everyone"
  on public.license_pricing_config for select
  using (true);

-- Política de escrita apenas por service_role
create policy "Pricing config is manageable by service role only"
  on public.license_pricing_config for all
  using (auth.role() = 'service_role');
