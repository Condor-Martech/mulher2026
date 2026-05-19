-- =====================================================================
-- Test Supabase setup for SSR migration validation
-- =====================================================================
-- Replicates the minimal schema needed to validate the "change in DB → reflects
-- without rebuild" flow against a SEPARATE test Supabase account.
--
-- LGPD: contains ONLY mock data. Never copy real `inscricoes` rows here.
--
-- Run this once in the SQL Editor of a fresh Supabase project (test account).
-- After running, grab the Project URL and anon key and use them to rebuild
-- the local Docker container pointing at this DB.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.palestras (
  id                        text primary key,
  campanha_id               text not null,
  nome                      text,
  palestrante               text,
  tipo_evento               text,
  data_evento               timestamptz,
  data_abertura_inscricao   timestamptz,
  data_limite_inscricao     timestamptz,
  link_inscripcion          text,
  qtd_crm                   integer,
  qtd_social                integer,
  active                    boolean not null default true,
  created_at                timestamptz not null default now()
);

create index if not exists palestras_campanha_id_active_idx
  on public.palestras (campanha_id, active);

create table if not exists public.inscricoes (
  id                  uuid primary key default gen_random_uuid(),
  event_id            text not null references public.palestras(id) on delete cascade,
  campanha_id         text not null,
  source              text not null check (source in ('crm', 'social')),
  nome                text,
  email               text,
  cpf                 text,
  telefone            text,
  nome_filho          text,
  cpf_filho           text,
  maioridade_filho    boolean,
  created_at          timestamptz not null default now()
);

create index if not exists inscricoes_event_id_source_idx
  on public.inscricoes (event_id, source);

create index if not exists inscricoes_campanha_id_idx
  on public.inscricoes (campanha_id);

-- ---------------------------------------------------------------------
-- RLS — allow anon SELECT (read-only from the browser/server)
-- The real `inscrever_participante` RPC is NOT replicated here. If you
-- need to test the form submission flow, ask for the RPC SQL separately.
-- ---------------------------------------------------------------------

alter table public.palestras  enable row level security;
alter table public.inscricoes enable row level security;

drop policy if exists "anon read palestras"  on public.palestras;
drop policy if exists "anon read inscricoes" on public.inscricoes;

create policy "anon read palestras"
  on public.palestras
  for select
  to anon, authenticated
  using (true);

create policy "anon read inscricoes"
  on public.inscricoes
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Seed — 5 palestras covering every status the SSR has to render
-- ---------------------------------------------------------------------
-- Naming convention: `test-<status>`
-- `dia-das-maes-2026` to mirror the campaign id the maes page filters on.
-- Adjust dates if you re-run this later; the seed assumes "today" is around
-- the day you load it. The values use relative offsets via now().

delete from public.inscricoes where event_id like 'test-%';
delete from public.palestras  where id like 'test-%';

insert into public.palestras (id, campanha_id, nome, palestrante, tipo_evento,
                              data_evento, data_abertura_inscricao,
                              qtd_crm, qtd_social, active)
values
  -- 1) SOON: opens tomorrow at 10am, event in 7 days
  ('test-soon',
   'dia-das-maes-2026',
   'TEST · Em Breve',
   'Palestrante Soon',
   'Workshop',
   now() + interval '7 days',
   date_trunc('day', now() + interval '1 day') + interval '10 hours',
   10, 8, true),

  -- 2) OPEN: opened yesterday, event in 5 days, no inscriptions yet
  ('test-open',
   'dia-das-maes-2026',
   'TEST · Inscrições Abertas',
   'Palestrante Open',
   'Workshop',
   now() + interval '5 days',
   now() - interval '1 day',
   10, 8, true),

  -- 3) FULL: opened, event in 5 days, but quota=1 (we'll fill it below)
  ('test-full',
   'dia-das-maes-2026',
   'TEST · Vagas Esgotadas',
   'Palestrante Full',
   'Workshop',
   now() + interval '5 days',
   now() - interval '1 day',
   1, 1, true),

  -- 4) FINISHED by date: event date already passed
  ('test-finished-by-date',
   'dia-das-maes-2026',
   'TEST · Encerrado (data passou)',
   'Palestrante Past',
   'Workshop',
   now() - interval '1 day',
   now() - interval '30 days',
   10, 8, true),

  -- 5) FINISHED by flag: future date but admin disabled it
  ('test-finished-by-flag',
   'dia-das-maes-2026',
   'TEST · Encerrado (admin desativou)',
   'Palestrante Disabled',
   'Workshop',
   now() + interval '5 days',
   now() - interval '1 day',
   10, 8, false);

-- Fill the FULL palestra so quota is hit on both sources
insert into public.inscricoes (event_id, campanha_id, source, nome, email, cpf, telefone)
values
  ('test-full', 'dia-das-maes-2026', 'crm',    'MOCK CRM',    'mock-crm@test.local',    '00000000001', '11000000001'),
  ('test-full', 'dia-das-maes-2026', 'social', 'MOCK SOCIAL', 'mock-social@test.local', '00000000002', '11000000002');

-- =====================================================================
-- Verify
-- =====================================================================
-- After running, you can check with:
--
--   select id, nome, active, data_evento, qtd_social,
--          (select count(*) from inscricoes where event_id = palestras.id and source='social') as social_count
--   from palestras
--   where id like 'test-%';
--
-- Expected:
--   test-soon                  → SOON (apertura futura)
--   test-open                  → OPEN (cupos disponibles)
--   test-full                  → FULL (1/1 ya inscripto)
--   test-finished-by-date      → FINISHED (fecha pasada)
--   test-finished-by-flag      → FINISHED (active=false)
