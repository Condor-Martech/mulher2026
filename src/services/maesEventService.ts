import type { Event, EventStatus } from '../types/event';
import {
  computeEventStatus,
  getStatusConfig,
  resolveSourceFromUrl,
} from '../utils/eventStatus';

export { getStatusConfig };

export const getEventStatus = (event: Event, source?: 'social' | 'crm'): EventStatus => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const forceStatus = urlParams.get('force_status') as EventStatus;
    if (forceStatus && ['OPEN', 'SOON', 'FULL', 'FINISHED'].includes(forceStatus)) {
      return forceStatus;
    }
  }

  const resolvedSource =
    source ?? (typeof window !== 'undefined' ? resolveSourceFromUrl(window.location) : undefined);

  return computeEventStatus(event, { source: resolvedSource });
};

export const fetchMaesEvents = async (): Promise<Event[]> => {
  let events: Event[] = [];
  const CAMPAIGN_ID = 'dia-das-maes-2026';
  
  try {
    const { supabase } = await import('../lib/supabase');
    const { data: palestras, error } = await supabase
      .from('palestras')
      .select('*')
      .eq('active', true)
      .eq('campanha_id', CAMPAIGN_ID);

    if (error) throw error;

    events = (palestras || []).map((p: any) => ({
      id: p.id,
      tema: p.nome,
      palestrante: p.palestrante,
      data_evento: p.data_evento,
      data_abertura_inscricao: p.data_abertura_inscricao,
      data_limite_inscricao: p.data_limite_inscricao,
      link_inscripcion: `/maes/palestra/${p.id}/`,
      tipo_evento: p.tipo_evento || 'Workshop',
      is_active: p.active,
      campanha_active: true,
      qtd_crm: p.qtd_crm,
      qtd_social: p.qtd_social,
      current_crm: 0,
      current_social: 0
    }));

    // Fetch registration counts for these specific events
    const { data: counts, error: countError } = await supabase
      .from('inscricoes')
      .select('event_id, source')
      .eq('campanha_id', CAMPAIGN_ID);

    if (!countError && counts) {
      events = events.map(event => {
        const crmCount = counts.filter(c => c.event_id === event.id && c.source === 'crm').length;
        const socialCount = counts.filter(c => c.event_id === event.id && (c.source === 'social' || !c.source)).length;

        return {
          ...event,
          current_crm: crmCount,
          current_social: socialCount
        };
      });
    }

  } catch (error) {
    console.error('Failed to fetch Maes events:', error);
  }

  return events.sort((a, b) => {
    const dateA = new Date(a.data_evento).getTime();
    const dateB = new Date(b.data_evento).getTime();
    return dateA - dateB;
  });
};
