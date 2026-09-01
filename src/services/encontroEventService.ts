/**
 * Encontro de Sabores Condor — estado do evento e das vagas.
 *
 * A campanha tem UM único evento, diferente de mulher/maes/sabores, que
 * têm uma grade. Por isso não existe rota [id]: busca-se a única linha ativa
 * de `palestras` com este campanha_id.
 *
 * Dois canais sobre o mesmo evento, como em maes:
 *   web (LP)  → source 'social' → cota qtd_social  → 15 vagas
 *   CRM       → source 'crm'    → cota qtd_crm     → 15 vagas
 *
 * A consulta acontece a cada requisição (SSR, sem cache): o briefing exige que
 * o estado das vagas não venha de cache nem seja calculado no build.
 */
import { supabase } from '../lib/supabase';
import { computeEventStatus } from '../utils/eventStatus';
import type { Event, EventStatus } from '../types/event';

export const CAMPANHA_ID = 'encontro-de-sabores';

export interface EstadoInscricao {
  /** null enquanto a linha do evento não existir em `palestras`. */
  event: Event | null;
  eventId: string;
  status: EventStatus;
  ocupadas: number;
  cupo: number;
}

export async function obterEstado(
  source: 'social' | 'crm',
): Promise<EstadoInscricao> {
  // Sem linha ainda → SOON. É o estado honesto antes de o evento existir,
  // e mantém a página de pé em vez de estourar com um 500.
  const vacio: EstadoInscricao = {
    event: null,
    eventId: '',
    status: 'SOON',
    ocupadas: 0,
    cupo: 0,
  };

  // As duas consultas em paralelo. `campanha_active` NÃO é coluna de
  // `palestras` — mora em `campanhas.active`, e é preciso buscá-la à parte.
  // Lê-la do select de palestras devolvia `undefined`, e como o eventStatus
  // compara `=== false`, desativar a campanha não fechava a LP: falhava aberto.
  // Mesmo desenho do saboresEventService.
  const [{ data: palestra, error }, { data: campanha }] = await Promise.all([
    supabase
      .from('palestras')
      .select('*')
      .eq('active', true)
      .eq('campanha_id', CAMPANHA_ID)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('campanhas')
      .select('active')
      .eq('id', CAMPANHA_ID)
      .maybeSingle(),
  ]);

  if (error || !palestra) return vacio;

  const cupo =
    source === 'crm' ? (palestra.qtd_crm ?? 0) : (palestra.qtd_social ?? 0);

  // A contagem exibida é só informativa. Quem DECIDE é a da RPC
  // `inscrever_participante`, que confere a cota dentro da transação:
  // sem isso, dois envios simultâneos com uma vaga livre entrariam os dois.
  let ocupadas = 0;
  if (cupo > 0) {
    const { count } = await supabase
      .from('inscricoes')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', palestra.id)
      .eq('source', source);
    ocupadas = count ?? 0;
  }

  const event: Event = {
    id: palestra.id,
    tema: palestra.nome,
    palestrante: palestra.palestrante,
    data_evento: palestra.data_evento,
    data_abertura_inscricao: palestra.data_abertura_inscricao,
    data_limite_inscricao: palestra.data_limite_inscricao,
    link_inscripcion: palestra.link_inscripcion ?? 'interno',
    tipo_evento: palestra.tipo_evento ?? 'Evento',
    is_active: palestra.active,
    // `?? true` deliberado: se a linha da campanha ainda não existir, não
    // é motivo para dar o evento por encerrado. Só um `active: false`
    // explícito fecha. É o mesmo critério do sabores.
    campanha_active: campanha?.active ?? true,
    qtd_crm: palestra.qtd_crm,
    qtd_social: palestra.qtd_social,
    current_crm: source === 'crm' ? ocupadas : (palestra.current_crm ?? 0),
    current_social: source === 'social' ? ocupadas : (palestra.current_social ?? 0),
  };

  return {
    event,
    eventId: palestra.id,
    // `enforceDeadline` SIM, e é por isso que a opção existe: esta campanha
    // fecha as inscrições em 07/09 às 23:59, dois dias antes do evento
    // (09/09). Sem isso o formulário continuaria aberto nesses dois dias.
    // As outras quatro campanhas não pedem a opção e seu comportamento não muda.
    status: computeEventStatus(event, { source, enforceDeadline: true }),
    ocupadas,
    cupo,
  };
}
