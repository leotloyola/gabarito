-- Gabarito · configuração do banco (Supabase → SQL Editor → New query → colar → Run)
-- 1) Troque o e-mail abaixo pelo SEU e-mail (o mesmo que usará para entrar no app).
create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'leotloyola@gmail.com'
$$;

create table if not exists public.catalog (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.questions (
  id text primary key,
  discipline text not null,
  topic text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists questions_disc_topic on public.questions (discipline, topic);
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.catalog enable row level security;
alter table public.questions enable row level security;
alter table public.progress enable row level security;

-- conteúdo: qualquer usuário logado lê; só o admin escreve
drop policy if exists catalog_read on public.catalog;
create policy catalog_read on public.catalog for select to authenticated using (true);
drop policy if exists catalog_write on public.catalog;
create policy catalog_write on public.catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select to authenticated using (true);
drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- progresso: cada um só vê e grava o próprio
drop policy if exists progress_own on public.progress;
create policy progress_own on public.progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
