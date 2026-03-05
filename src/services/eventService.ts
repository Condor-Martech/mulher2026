import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import { registrationRepository } from '../repositories/registrationRepository';
import eventsData from '../data/events.json';
import mockEventsList from '../data/mock_events.json';

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
  const eventDate = new Date(event.fecha_iso);
  const openingDate = event.opening_date_iso ? new Date(event.opening_date_iso) : null;

  // 1. Check if event is finished explicitly or by date
  if (event.is_active === false || event.campanha_active === false || now > eventDate) {
    return 'FINISHED';
  }

  // 2. Check if registration is not yet open or opening date is not defined
  if (!event.opening_date_iso || (openingDate && now < openingDate)) {
    return 'SOON';
  }

  // 3. Check for quotas (Mock implementation detects from URL if in browser)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('src') || 'social';
    
    if (source === 'crm' && event.current_crm !== undefined && event.qtd_crm !== undefined) {
      if (event.current_crm >= event.qtd_crm) return 'FULL';
    } else if (source === 'social' && event.current_social !== undefined && event.qtd_social !== undefined) {
      if (event.current_social >= event.qtd_social) return 'FULL';
    }
  }
  
  return event.link_inscripcion ? 'OPEN' : 'SOON';
};

export const getStatusConfig = (status: EventStatus): EventStatusConfig => {
  return STATUS_CONFIG[status];
};

export const fetchEvents = async (apiUrl: string): Promise<Event[]> => {
  // 1. Get base event data (from mock or API)
  let events: Event[] = [];
  
  if (import.meta.env.PUBLIC_USE_MOCK_API === 'true') {
    events = [...(mockEventsList as Event[])];
  } else {
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      events = data.events || [];
    } catch (error) {
      console.error('Failed to fetch events from API, falling back to mock data:', error);
      events = [...(mockEventsList as Event[])];
    }
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
    const dateA = new Date(a.fecha_iso).getTime();
    const dateB = new Date(b.fecha_iso).getTime();
    
    return dateA - dateB;
  });
};
