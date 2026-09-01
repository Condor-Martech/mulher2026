-- Encontro de Sabores Condor — tabela dos três aceites do formulário.
--
-- Vive aqui e não em supabase/migrations/ pelo mesmo motivo do outro arquivo:
-- as quatro folhas de estilo em produção varrem o repositório inteiro e só
-- excluem as pastas `encontro-de-sabores`.
--
-- POR QUE UMA TABELA PRÓPRIA, e não um parâmetro novo na RPC:
--
-- `inscrever_participante` é usada pelas cinco campanhas. O Postgres não deixa
-- acrescentar um parâmetro a uma função existente — `create or replace` só
-- substitui se os tipos dos argumentos baterem, e um argumento a mais cria uma
-- SOBRECARGA, o que faz o PostgREST devolver PGRST203 («could not choose the
-- best candidate function») e derruba a inscrição das cinco de uma vez. O
-- caminho seria drop + create, e a definição dessa função não está versionada
-- em lado nenhum: a única cópia está dentro do banco. Enquanto isso não se
-- resolver, mexer nela é risco sem rede.
--
-- Esta tabela é aditiva: não toca a RPC, não toca `inscricoes`, e nenhuma das
-- outras campanhas sabe que ela existe.
--
-- A GRAVAÇÃO ACONTECE ANTES DA INSCRIÇÃO (ver utils/encontroRegistration.ts).
-- A declaração de restrição alimentar é a prova que protege num evento com
-- degustação; não pode existir inscrição sem ela. Gravando primeiro, o pior
-- caso é uma linha órfã de quem não terminou — inofensiva.

create table encontro_consentimentos (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  cpf         text not null,
  source      text not null,          -- 'social' (LP) ou 'crm'
  maioridade  boolean not null,       -- declara ser maior de 18
  restricao   boolean not null,       -- declara não ter restrição alimentar
  lgpd        boolean not null,       -- aceita os termos e a política
  criado_em   timestamptz not null default now(),
  -- Evita duplicados quando a pessoa tenta de novo depois de a RPC recusar.
  -- O cliente trata o erro 23505 como sucesso: a declaração já está guardada.
  unique (event_id, cpf)
);

alter table encontro_consentimentos enable row level security;

-- SÓ insert, de propósito: sem policy de select, o navegador não consegue ler
-- a lista de CPFs. Quem precisa de a ler (n8n → planilha) usa a service key.
create policy "inscricao pode gravar consentimento"
  on encontro_consentimentos for insert to anon with check (true);

-- Para a planilha: cruza-se com as inscrições por event_id + cpf.
--
--   select i.nome, i.email, i.telefone, i.source,
--          c.maioridade, c.restricao, c.lgpd, i.created_at
--     from inscricoes i
--     left join encontro_consentimentos c
--       on c.event_id = i.event_id and c.cpf = i.cpf
--    where i.event_id = 'encontro-de-sabores-2026'
--    order by i.created_at;
