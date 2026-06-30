import type { Event, EventStatus } from '../types/event';
import {
  computeEventStatus,
  getStatusConfig,
  resolveSourceFromUrl,
} from '../utils/eventStatus';

export { getStatusConfig };

// Campaña Sabores de Inverno 2026. Service self-contained (sin registry config-driven):
// el campanhaId vive acá, igual que eventService/maesEventService.
// Gate +18: regla global de la campaña — TODOS los eventos son para maiores de 18 anos,
// así que la confirmación se exige siempre en el form (no hay derivación por evento).
const CAMPAIGN_ID = 'sabores-de-inverno-2026';

export const getEventStatus = (
  event: Event,
  source?: 'social' | 'crm',
): EventStatus => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const forceStatus = urlParams.get('force_status') as EventStatus;
    if (forceStatus && ['OPEN', 'SOON', 'FULL', 'FINISHED'].includes(forceStatus)) {
      return forceStatus;
    }
  }

  const resolvedSource =
    source ??
    (typeof window !== 'undefined'
      ? resolveSourceFromUrl(window.location)
      : undefined);

  // El estado sale de data_abertura_inscricao (apertura escalonada por fecha de evento).
  return computeEventStatus(event, { source: resolvedSource });
};

export const fetchSaboresEvents = async (): Promise<Event[]> => {
  let events: Event[] = [];

  try {
    const { supabase } = await import('../lib/supabase');
    const [{ data: palestras, error }, { data: campanha }] = await Promise.all([
      supabase
        .from('palestras')
        .select('*')
        .eq('active', true)
        .eq('campanha_id', CAMPAIGN_ID),
      supabase
        .from('campanhas')
        .select('active')
        .eq('id', CAMPAIGN_ID)
        .maybeSingle(),
    ]);

    if (error) throw error;

    const campanhaActive = campanha?.active ?? true;

    events = (palestras || []).map((p: any) => ({
      id: p.id,
      tema: p.nome,
      palestrante: p.palestrante,
      data_evento: p.data_evento,
      data_abertura_inscricao: p.data_abertura_inscricao,
      data_limite_inscricao: p.data_limite_inscricao,
      link_inscripcion: `/sabores-de-inverno/palestra/${p.id}/`,
      tipo_evento: p.tipo_evento || 'Palestra',
      is_active: p.active,
      campanha_active: campanhaActive,
      qtd_crm: p.qtd_crm,
      qtd_social: p.qtd_social,
      current_crm: 0,
      current_social: 0,
      // Metadatos de sede/marca (JSONB `data`) + gate +18 derivado.
      data: p.data ?? null,
      region: p.data?.region,
      location: p.data?.location,
      brand: p.data?.brand,
      sponsor: p.data?.sponsor,
      time_label: p.data?.time_label,
    }));

    // Conteo vía RPC SECURITY DEFINER (no expone PII; mismo patrón RLS que mulher/maes).
    const { data: counts, error: countError } = await supabase.rpc(
      'contar_inscricoes',
      { p_campanha_id: CAMPAIGN_ID },
    );

    if (!countError && Array.isArray(counts)) {
      const totalFor = (eventId: string, pred: (s: string | null) => boolean) =>
        counts
          .filter((c: any) => c.event_id === eventId && pred(c.source))
          .reduce((sum: number, c: any) => sum + Number(c.total), 0);

      events = events.map((event) => ({
        ...event,
        current_crm: totalFor(event.id, (s) => s === 'crm'),
        current_social: totalFor(event.id, (s) => s === 'social' || !s),
      }));
    }
  } catch (error) {
    console.error('Failed to fetch Sabores events:', error);
  }

  return events.sort((a, b) => {
    const dateA = new Date(a.data_evento).getTime();
    const dateB = new Date(b.data_evento).getTime();
    return dateA - dateB;
  });
};
