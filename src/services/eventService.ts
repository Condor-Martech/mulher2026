import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import { registrationRepository } from '../repositories/registrationRepository';
import eventsData from '../data/events.json';

const STATUS_CONFIG: Record<EventStatus, EventStatusConfig> = eventsData.statusConfig as Record<EventStatus, EventStatusConfig>;


export const getEventStatus = (event: Event): EventStatus => {
  // --- DEBUG OVERRIDES (Only for local testing) ---
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const forceStatus = urlParams.get('force_status') as EventStatus;
    const forceEventId = urlParams.get('force_event');

    if (forceStatus) {
      if (!forceEventId || forceEventId === event.id) {
        return forceStatus;
      }
    }
  }
  // ------------------------------------------------

  const now = new Date();
  const eventDate = new Date(event.data_evento);
  const openingDate = event.data_abertura_inscricao ? new Date(event.data_abertura_inscricao) : null;

  // 1. Check if event is finished explicitly or by date
  if (event.is_active === false || event.campanha_active === false || now > eventDate) {
    return 'FINISHED';
  }

  // 2. Check if registration is not yet open or opening date is not defined
  if (!event.data_abertura_inscricao || (openingDate && now < openingDate)) {
    return 'SOON';
  }

  // 3. Check for quotas (Mock implementation detects from URL if in browser)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const srcParam = urlParams.get('src');
    const isPalestraPath = window.location.pathname.includes('/palestra/');
    const source = srcParam ?? (isPalestraPath ? 'crm' : 'social');
    
    if (source === 'crm' && event.current_crm !== undefined && event.qtd_crm && event.qtd_crm > 0) {
      if (event.current_crm >= event.qtd_crm) return 'FULL';
    } else if (source === 'social' && event.current_social !== undefined && event.qtd_social && event.qtd_social > 0) {
      if (event.current_social >= event.qtd_social) return 'FULL';
    }
  }
  
  return event.link_inscripcion ? 'OPEN' : 'SOON';
};

export const getStatusConfig = (status: EventStatus): EventStatusConfig => {
  return STATUS_CONFIG[status];
};

export const fetchEvents = async (apiUrl?: string): Promise<Event[]> => {
  // 1. Get base event data from Supabase palestras table
  let events: Event[] = [];
  
  try {
    const { supabase } = await import('../lib/supabase');
    const { data: palestras, error } = await supabase
      .from('palestras')
      .select('*')
      .eq('active', true);

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
