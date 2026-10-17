-- Workspace persistente de projetos, publicações e listas de peças do plugin.
create table if not exists public.license_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  customer_name text not null default '',
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_producao', 'concluido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_publication_at timestamptz
);

create index if not exists license_projects_account_updated_idx
  on public.license_projects (account_id, updated_at desc);

create table if not exists public.license_project_publications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete cascade,
  project_id uuid not null references public.license_projects(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  revision integer not null check (revision > 0),
  message text not null default '',
  model_name text not null default '',
  plugin_version text,
  sketchup_version text,
  parts_summary jsonb not null default '{}'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  datasets jsonb not null default '[]'::jsonb,
  artifacts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (project_id, revision)
);

create index if not exists license_project_publications_project_idx
  on public.license_project_publications (project_id, revision desc);

create table if not exists public.license_project_parts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.license_accounts(id) on delete cascade,
  project_id uuid not null references public.license_projects(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  name text not null,
  width_mm numeric(12,3) not null check (width_mm > 0),
  height_mm numeric(12,3) not null check (height_mm > 0),
  quantity integer not null default 1 check (quantity > 0),
  cut_lines jsonb not null default '[]'::jsonb,
  fold_lines jsonb not null default '[]'::jsonb,
  dxf_content text,
  created_at timestamptz not null default now()
);

create index if not exists license_project_parts_project_idx
  on public.license_project_parts (project_id, created_at desc);

alter table public.license_projects enable row level security;
alter table public.license_project_publications enable row level security;
alter table public.license_project_parts enable row level security;
revoke all on public.license_projects, public.license_project_publications, public.license_project_parts
  from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('goacm-project-artifacts', 'goacm-project-artifacts', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

notify pgrst, 'reload schema';
