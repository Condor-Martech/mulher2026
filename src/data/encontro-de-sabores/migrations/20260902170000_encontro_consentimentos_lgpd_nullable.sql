-- Encontro de Sabores Condor — `lgpd` passa a aceitar null.
--
-- Mora aqui, e não em supabase/migrations/, pelo mesmo motivo dos outros dois
-- arquivos desta pasta: as quatro folhas de estilo em produção varrem o
-- repositório inteiro e só excluem as pastas `encontro-de-sabores`.
--
-- POR QUÊ
--
-- O aceite da Política de Privacidade saiu do formulário a pedido do cliente:
-- não há checkbox nem aviso. Com a coluna `not null` só havia duas saídas, e
-- as duas mentem:
--
--   true   inventa um aceite que ninguém deu — e é justamente esta coluna que
--          se apresentaria se alguém a pedisse;
--   false  lê-se como recusa, quando na verdade nunca foi perguntado.
--
-- `null` é o valor honesto: não foi pedido. Na planilha o n8n já o converte em
-- célula vazia (`$json.lgpd == null ? '' : …`), então nada muda no fluxo.
--
-- As outras duas declarações continuam `not null`: essas são pedidas, são
-- obrigatórias, e a de restrição alimentar é a que protege num evento com
-- degustação.
--
-- Se o aceite voltar ao formulário, nada precisa ser desfeito aqui: volta a
-- chegar true e a coluna aceita-o na mesma.

alter table encontro_consentimentos
  alter column lgpd drop not null;
