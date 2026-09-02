-- ═══════════════════════════════════════════════════════════════════════════
-- Encontro de Sabores Condor — comandos de operação
--
-- Isto NÃO é uma migração. São os comandos do dia a dia: limpar testes,
-- repor as datas boas e conferir o estado. Guardado aqui para não depender
-- de ninguém em particular saber de cor.
--
-- Evento: 09/09/2026, 19h30, Condor Nilo Peçanha.
-- Linha:  palestras.id = 'encontro-de-sabores-2026'
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1 · APAGAR AS INSCRIÇÕES DE TESTE ────────────────────────────────────
--
-- SEMPRE nesta ordem e SEMPRE as duas tabelas. Os aceites moram à parte de
-- `inscricoes`; apagar só uma deixa linhas órfãs na outra.

delete from encontro_consentimentos where event_id = 'encontro-de-sabores-2026';
delete from inscricoes              where event_id = 'encontro-de-sabores-2026';


-- ─── 2 · REPOR OS VALORES DEFINITIVOS ─────────────────────────────────────
--
-- Correr DEPOIS de apagar os testes. A partir daqui a LP fica em «em breve»
-- até 04/09 às 10h.
--
-- O sufixo -03 é obrigatório: sem ele o Postgres usa o fuso da sessão (UTC no
-- painel) e tudo fica três horas corrido.

update palestras set
  data_abertura_inscricao = '2026-09-04 10:00:00-03',   -- sexta, 10h Curitiba
  data_limite_inscricao   = '2026-09-07 23:59:59-03',   -- segunda, 23h59
  data_evento             = '2026-09-09 19:30:00-03',   -- quarta, 19h30
  qtd_social = 20,                                       -- cota da LP
  qtd_crm    = 10                                        -- cota do CRM
where id = 'encontro-de-sabores-2026';


-- ─── 3 · CONFERIR ─────────────────────────────────────────────────────────
--
-- Deve devolver uma linha. `estado` mostra o que a LP vai servir agora.
-- Repare que o LIMITE é avaliado ANTES da abertura: com o limite no passado a
-- página diz «encerradas» mesmo que a abertura esteja certa.

select
  p.qtd_social,
  p.qtd_crm,
  (select count(*) from inscricoes  where event_id = p.id and source = 'social') as inscritos_lp,
  (select count(*) from inscricoes  where event_id = p.id and source = 'crm')    as inscritos_crm,
  (select count(*) from encontro_consentimentos where event_id = p.id)           as aceites,
  p.data_abertura_inscricao at time zone 'America/Sao_Paulo' as abre,
  p.data_limite_inscricao   at time zone 'America/Sao_Paulo' as fecha,
  p.data_evento             at time zone 'America/Sao_Paulo' as evento,
  case
    when c.active is false or p.active is false then 'FINISHED'
    when now() > p.data_evento                  then 'FINISHED'
    when now() > p.data_limite_inscricao        then 'FINISHED'
    when now() < p.data_abertura_inscricao      then 'SOON'
    else 'OPEN'
  end as estado
from palestras p
join campanhas c on c.id = p.campanha_id
where p.id = 'encontro-de-sabores-2026';


-- ─── 4 · EXPORTAR PARA A PLANILHA (se o n8n estiver parado) ───────────────
--
-- As colunas saem já com os nomes da planilha de atendimento.
-- `restricao = true` significa SEM restrição alimentar — é uma declaração
-- negativa, cuidado ao ler.

select
  i.created_at  as data_da_inscricao,
  i.nome,
  i.cpf,
  i.email,
  i.telefone,
  case when i.source = 'crm' then 'CRM' else 'LP' end as canal,
  c.maioridade  as declarou_maior_18,
  c.restricao   as declarou_sem_restricao,
  c.lgpd        as aceitou_termos
from inscricoes i
left join encontro_consentimentos c
  on c.event_id = i.event_id and c.cpf = i.cpf
where i.event_id = 'encontro-de-sabores-2026'
order by i.created_at;


-- ─── 5 · PROLONGAR O PRAZO PARA TESTAR ────────────────────────────────────
--
-- Só durante os testes. Mexe apenas no limite; a abertura fica como está.

-- update palestras set data_limite_inscricao = now() + interval '2 days'
-- where id = 'encontro-de-sabores-2026';
