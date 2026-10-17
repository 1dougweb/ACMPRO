-- Histórico e controle de releases do plugin SketchUp (GOACM)
create table if not exists public.license_plugin_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  notes text not null default '',
  file_url text not null,
  file_name text not null default '',
  file_size_bytes bigint not null default 0,
  sha256 text not null default '',
  min_sketchup_version text not null default '2021',
  is_mandatory boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists license_plugin_releases_active_created_idx
  on public.license_plugin_releases (is_active, created_at desc);

alter table public.license_plugin_releases enable row level security;

create policy "Allow public read plugin releases"
  on public.license_plugin_releases for select
  using (true);
