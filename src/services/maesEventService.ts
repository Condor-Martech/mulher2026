import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import { registrationRepository } from '../repositories/registrationRepository';
import eventsData from '../data/events.json';

const STATUS_CONFIG: Record<EventStatus, EventStatusConfig> = eventsData.statusConfig as Record<EventStatus, EventStatusConfig>;

export const getEventStatus = (event: Event, source?: 'social' | 'crm'): EventStatus => {
  const now = new Date();
  const eventDate = new Date(event.data_evento);
  const openingDate = event.data_abertura_inscricao ? new Date(event.data_abertura_inscricao) : null;

  if (event.is_active === false || event.campanha_active === false || now > eventDate) {
    return 'FINISHED';
  }

  if (!event.data_abertura_inscricao || (openingDate && now < openingDate)) {
    return 'SOON';
  }

  let currentSource = source;
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    
    // For testing purposes
    const forceStatus = urlParams.get('force_status') as EventStatus | null;
    if (forceStatus && ['OPEN', 'SOON', 'FULL', 'FINISHED'].includes(forceStatus)) {
      return forceStatus;
    }

    if (!currentSource) {
      const srcParam = urlParams.get('src');
      const isPalestraPath = window.location.pathname.includes('/palestra/');
      currentSource = (srcParam as 'social' | 'crm') ?? (isPalestraPath ? 'crm' : 'social');
    }
  }
    
  if (currentSource === 'crm' && event.current_crm !== undefined && event.qtd_crm !== undefined && event.qtd_crm !== null) {
      if (event.current_crm >= event.qtd_crm) return 'FULL';
  } else if (currentSource === 'social' && event.current_social !== undefined && event.qtd_social !== undefined && event.qtd_social !== null) {
      if (event.current_social >= event.qtd_social) return 'FULL';
  }
  
  return 'OPEN';
};

export const getStatusConfig = (status: EventStatus): EventStatusConfig => {
  return STATUS_CONFIG[status];
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
