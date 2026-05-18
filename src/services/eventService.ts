import type { Event, EventStatus } from '../types/event';
import { registrationRepository } from '../repositories/registrationRepository';
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
    const forceEventId = urlParams.get('force_event');
    if (forceStatus && (!forceEventId || forceEventId === event.id)) {
      return forceStatus;
    }
  }

  const resolvedSource =
    source ?? (typeof window !== 'undefined' ? resolveSourceFromUrl(window.location) : undefined);

  return computeEventStatus(event, { source: resolvedSource });
};

export const fetchEvents = async (apiUrl?: string): Promise<Event[]> => {
  // 1. Get base event data from Supabase palestras table
  let events: Event[] = [];
  
  try {
    const { supabase } = await import('../lib/supabase');
    const { data: palestras, error } = await supabase
      .from('palestras')
      .select('*')
      .eq('active', true)
      .eq('campanha_id', 'mes-da-mulher-2026');

    if (error) {
      throw error;
    }

    events = (palestras || []).map((p: any) => ({
      id: p.id,
      tema: p.nome,
      palestrante: p.palestrante,
      data_evento: p.data_evento,
      data_abertura_inscricao: p.data_abertura_inscricao,
      data_limite_inscricao: p.data_limite_inscricao,
      link_inscripcion: p.link_inscripcion,
      tipo_evento: p.tipo_evento || 'Palestra',
      is_active: p.active,
      campanha_active: true, // Assuming true for now
      qtd_crm: p.qtd_crm,
      qtd_social: p.qtd_social,
      current_crm: 0,
      current_social: 0
    }));
  } catch (error) {
    console.error('Failed to fetch events from Supabase:', error);
  }

  // 2. Fetch real registration counts from Repository
  try {
    const counts = await registrationRepository.fetchRegistrationCounts();

    // Attach counts to events
    events = events.map(event => {
      const crmCount = counts.filter(c => c.event_id === event.id && c.source === 'crm').length;
      const socialCount = counts.filter(c => c.event_id === event.id && (c.source === 'social' || !c.source)).length;

      return {
        ...event,
        current_crm: crmCount,
        current_social: socialCount
      };
    });
  } catch (err) {
    console.error('Failed to fetch registration counts:', err);
    // Continue with events as is (counts will be undefined/0)
  }

  // 3. Sort and return
  const priority: Record<EventStatus, number> = {
    'OPEN': 0,
    'SOON': 1,
    'FULL': 2,
    'FINISHED': 3
  };

  return events.sort((a, b) => {
    const statusA = getEventStatus(a);
    const statusB = getEventStatus(b);
    
    // First, prioritize by status group (FINISHED should be last)
    if (statusA === 'FINISHED' && statusB !== 'FINISHED') return 1;
    if (statusA !== 'FINISHED' && statusB === 'FINISHED') return -1;
    
    // Then, sort by date (closest first)
    const dateA = new Date(a.data_evento).getTime();
    const dateB = new Date(b.data_evento).getTime();
    
    return dateA - dateB;
  });
};
