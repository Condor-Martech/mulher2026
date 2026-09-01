-- Fica em src/data/encontro-de-sabores/ e não em supabase/migrations/ porque as
-- quatro folhas de estilo em produção varrem o repositório inteiro atrás de
-- nomes de classe e só excluem as pastas `encontro-de-sabores`. Um .sql fora
-- delas acrescentava 37 bytes de CSS morto a maes, mulher, pascoa e sabores.
-- Medido. Enquanto essas folhas não usarem `source(none)`, tudo o que for desta
-- campanha mora debaixo de uma pasta com este nome.

-- Encontro de Sabores Condor — cadastro da campanha e do evento.
--
-- Duas linhas novas. Não toca nenhuma outra campanha.
-- Pode rodar mais de uma vez sem duplicar (on conflict).
--
-- Rodar isto hoje NÃO abre as inscrições: com abertura em 04/09, o
-- eventStatus.ts devolve 'SOON' até lá. Abre sozinho no dia 04 e fecha
-- sozinho em 07/09 às 23:59.
--
-- Fuso America/Sao_Paulo = UTC−03. Daí o sufixo -03 em cada data: sem ele o
-- Postgres usa o fuso da sessão (UTC no painel) e tudo anda 3 horas.

begin;

insert into campanhas (id, nome, active)
values ('encontro-de-sabores', 'Encontro de Sabores Condor', true)
on conflict (id) do update set active = excluded.active;

insert into palestras (
  id, campanha_id, nome, active, tipo_evento,
  data_evento, data_abertura_inscricao, data_limite_inscricao,
  qtd_social, qtd_crm
) values (
  'encontro-de-sabores-2026',
  'encontro-de-sabores',
  'Encontro de Sabores Condor',
  true,
  'Evento',
  '2026-09-09 19:30:00-03',   -- evento
  '2026-09-04 10:00:00-03',   -- abre inscrições (10h de Curitiba)
  '2026-09-07 23:59:59-03',   -- fecha inscrições
  15,                         -- cota da LP  (source = 'social')
  15                          -- cota do CRM (source = 'crm')
)
on conflict (id) do update
  set active                  = excluded.active,
      data_evento             = excluded.data_evento,
      data_abertura_inscricao = excluded.data_abertura_inscricao,
      data_limite_inscricao   = excluded.data_limite_inscricao,
      qtd_social              = excluded.qtd_social,
      qtd_crm                 = excluded.qtd_crm;

commit;

-- Conferência: uma linha, 'SOON' hoje e 'OPEN' a partir de 04/09.
select p.id, c.active as campanha_ativa, p.active as evento_ativo,
       p.qtd_social, p.qtd_crm,
       case
         when c.active is false or p.active is false then 'FINISHED'
         when now() > p.data_evento                  then 'FINISHED'
         when now() > p.data_limite_inscricao        then 'FINISHED'
         when now() < p.data_abertura_inscricao      then 'SOON'
         else 'OPEN'
       end as estado
from palestras p join campanhas c on c.id = p.campanha_id
where p.campanha_id = 'encontro-de-sabores';
