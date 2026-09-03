/**
 * Encontro de Sabores Condor — estado do evento e das vagas.
 *
 * A campanha tem UM único evento, diferente de mulher/maes/sabores, que
 * têm uma grade. Por isso não existe rota [id]: busca-se a única linha ativa
 * de `palestras` com este campanha_id.
 *
 * Dois canais sobre o mesmo evento, como em maes:
 *   web (LP)  → source 'social' → cota qtd_social  → 20 vagas
 *   CRM       → source 'crm'    → cota qtd_crm     → 10 vagas
 *
 * (O briefing dividia 15/15; a regra de negócio em vigor é 20/10, com o
 * mesmo total de 30. Os números vivem na linha de `palestras`, não aqui.)
 *
 * A consulta acontece a cada requisição (SSR, sem cache): o briefing exige que
 * o estado das vagas não venha de cache nem seja calculado no build.
 */
import { supabase } from '../lib/supabase';
import { computeEventStatus } from '../utils/eventStatus';
import type { Event, EventStatus } from '../types/event';

export const CAMPANHA_ID = 'encontro-de-sabores';

/**
 * Prazo para o Supabase responder.
 *
 * Sem isto a página fica pendurada. Medido: contra um servidor que ACEITA a
 * ligação e nunca responde, a rota não devolveu nada em 30 segundos — e como o
 * SSR corre sem cache isso repetir-se-ia a cada visita, as ligações
 * acumulavam-se e caía o site inteiro, não só o formulário. É o mesmo buraco
 * que o encontroContentService já tapou para o Minio.
 *
 * O Supabase INALCANÇÁVEL nunca foi problema: falha em 0,15s e a página serve
 * SOON. O perigo é o Supabase lento, não o Supabase morto.
 *
 * 8 segundos e não 2: normalmente responde em menos de 300ms, mas na sexta às
 * 10h, quando o CRM dispara os e-mails, uma ponta de lentidão não pode fazer
 * com que toda a gente veja «em breve».
 */
const TEMPO_LIMITE_MS = 8000;

const ESTADOS_VALIDOS = ['OPEN', 'SOON', 'FULL', 'FINISHED'] as const;

/**
 * Override de estado para desenvolvimento: `?force_status=OPEN|SOON|FULL|FINISHED`.
 *
 * SÓ em `pnpm dev`. `import.meta.env.DEV` é substituído por `false` no build,
 * então em produção esta função inteira vira `return null` e o parâmetro é
 * simplesmente ignorado. É deliberado: são 30 vagas, e um parâmetro de URL que
 * abrisse o formulário antes de 04/09 seria uma porta para se inscrever fora do
 * prazo — e para furar a cota, já que quem decide de verdade é a RPC.
 *
 * POR QUE ESTÁ AQUI E NÃO NO NAVEGADOR: as outras quatro campanhas têm um bloco
 * parecido nos seus serviços (eventService.ts:14, maesEventService.ts:13,
 * saboresEventService.ts:22), mas envolvido em `typeof window !== 'undefined'`,
 * que é FALSO em SSR. Como todas calculam o estado no frontmatter, esse bloco
 * nunca roda: é código morto nas quatro, verificado comparando o HTML servido
 * com e sem o parâmetro. Aqui o override é aplicado onde o estado é de facto
 * decidido — no servidor, antes de montar o HTML.
 */
function estadoForcado(url?: URL): EventStatus | null {
  if (!import.meta.env.DEV || !url) return null;
  const valor = url.searchParams.get('force_status')?.toUpperCase();
  return ESTADOS_VALIDOS.includes(valor as any) ? (valor as EventStatus) : null;
}

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
  /** `Astro.url` da requisição. Só serve ao override de dev; em produção é ignorada. */
  url?: URL,
): Promise<EstadoInscricao> {
  const forcado = estadoForcado(url);

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
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS))
      .maybeSingle(),
    supabase
      .from('campanhas')
      .select('active')
      .eq('id', CAMPANHA_ID)
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS))
      .maybeSingle(),
  ]);

  // O override vale TAMBÉM aqui, e é o caso mais útil: enquanto a fila não
  // existir em `palestras`, é a única maneira de ver o formulário. Nesse
  // estado o `eventId` fica vazio de propósito — a RPC recusa, então dá para
  // testar render, máscaras e validação sem poder gravar nada no banco.
  if (error || !palestra) return { ...vacio, status: forcado ?? vacio.status };

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
      .eq('source', source)
      .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
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
    status: forcado ?? computeEventStatus(event, { source, enforceDeadline: true }),
    ocupadas,
    cupo,
  };
}
