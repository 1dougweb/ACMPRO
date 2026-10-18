-- Sistema de Treinamentos e Aulas GOACM
-- Módulos, aulas com vídeo, materiais de apoio e controle de progresso dos alunos

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  duration_minutes integer default 0,
  attachments jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.training_lessons(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists training_modules_order_idx on public.training_modules (order_index asc);
create index if not exists training_lessons_module_order_idx on public.training_lessons (module_id, order_index asc);
create index if not exists training_progress_user_idx on public.training_progress (user_id);

alter table public.training_modules enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_progress enable row level security;

-- Políticas de Leitura: Usuários autenticados podem ver módulos e aulas
create policy training_modules_select_authenticated
  on public.training_modules for select to authenticated
  using (true);

create policy training_lessons_select_authenticated
  on public.training_lessons for select to authenticated
  using (true);

-- Políticas de Progresso do Aluno
create policy training_progress_select_owner
  on public.training_progress for select to authenticated
  using (auth.uid() = user_id);

create policy training_progress_insert_owner
  on public.training_progress for insert to authenticated
  with check (auth.uid() = user_id);

create policy training_progress_update_owner
  on public.training_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy training_progress_delete_owner
  on public.training_progress for delete to authenticated
  using (auth.uid() = user_id);

-- Carga inicial de módulos e aulas para estrutura inicial
do $$
declare
  mod1_id uuid;
  mod2_id uuid;
  mod3_id uuid;
begin
  if not exists (select 1 from public.training_modules limit 1) then
    -- Módulo 1
    insert into public.training_modules (title, description, order_index)
    values ('Tutorial GOACM', 'Conceitos essenciais, novidades, estruturas e planificação no plugin GOACM.', 1)
    returning id into mod1_id;

    insert into public.training_lessons (module_id, title, description, duration_minutes, order_index)
    values
      (mod1_id, 'Novidades e Visão Geral do GOACM', 'Apresentação das novidades mais recentes da extensão e interface.', 15, 1),
      (mod1_id, 'Estruturas e Componentes', 'Como criar e manipular estruturas paramétricas com facilidade.', 27, 2),
      (mod1_id, 'Planificação e Otimização de Chapas', 'Extração de medidas e planificação automática para corte.', 11, 3);

    -- Módulo 2
    insert into public.training_modules (title, description, order_index)
    values ('Live de Lançamento & Demonstração', 'Gravação completa da apresentação e demonstração ao vivo da ferramenta.', 2)
    returning id into mod2_id;

    insert into public.training_lessons (module_id, title, description, duration_minutes, order_index)
    values
      (mod2_id, 'Apresentação Oficial GOACM ao Vivo', 'Visão geral das funcionalidades e casos de uso reais.', 50, 1);

    -- Módulo 3
    insert into public.training_modules (title, description, order_index)
    values ('Modelagem 3D — SketchUp', 'Aprenda as ferramentas do SketchUp e pratique a modelagem de fachadas e elementos em ACM.', 3)
    returning id into mod3_id;

    insert into public.training_lessons (module_id, title, description, duration_minutes, order_index)
    values
      (mod3_id, 'Interface do SketchUp', 'Conhecendo a interface, menus e barras de ferramentas.', 12, 1),
      (mod3_id, 'Navegação e Câmera', 'Órbita, zoom, pan e visualizações padrão do projeto.', 4, 2),
      (mod3_id, 'Ferramentas Fundamentais', 'Linhas, retângulos, push/pull, fitas métricas e grupos.', 28, 3),
      (mod3_id, 'Modelagem Base de Fachadas', 'Passo a passo para estruturar paredes e vãos para receber ACM.', 19, 4),
      (mod3_id, 'Atalhos de Produtividade', 'Os atalhos de teclado mais importantes para acelerar seu fluxo de trabalho.', 4, 5),
      (mod3_id, 'Criando Aberturas de Portas e Janelas', 'Técnicas de recorte e alinhamento de vãos.', 9, 6),
      (mod3_id, 'Uso do 3D Warehouse', 'Como importar e otimizar componentes externos no SketchUp.', 8, 7),
      (mod3_id, 'Modelagem Sobre Foto Real', 'Técnica de Photo Match para modelar sobre fachadas existentes.', 14, 8);
  end if;
end $$;
