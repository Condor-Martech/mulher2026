import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import eventsData from '../data/events.json';

const STATUS_CONFIG: Record<EventStatus, EventStatusConfig> =
  eventsData.statusConfig as Record<EventStatus, EventStatusConfig>;

export interface ComputeStatusOptions {
  source?: 'crm' | 'social';
  now?: Date;
}

export function computeEventStatus(
  event: Event,
  opts: ComputeStatusOptions = {},
): EventStatus {
  const now = opts.now ?? new Date();
  const eventDate = new Date(event.data_evento);
  const openingDate = event.data_abertura_inscricao
    ? new Date(event.data_abertura_inscricao)
    : null;

  if (event.is_active === false || event.campanha_active === false || now > eventDate) {
    return 'FINISHED';
  }

  if (!openingDate || now < openingDate) {
    return 'SOON';
  }

  const source = opts.source;
  if (source === 'crm' && event.qtd_crm != null && event.qtd_crm > 0) {
    if ((event.current_crm ?? 0) >= event.qtd_crm) return 'FULL';
  } else if (source === 'social' && event.qtd_social != null && event.qtd_social > 0) {
    if ((event.current_social ?? 0) >= event.qtd_social) return 'FULL';
  }

  return event.link_inscripcion ? 'OPEN' : 'SOON';
}

export function getStatusConfig(status: EventStatus): EventStatusConfig {
  return STATUS_CONFIG[status];
}

export function resolveSourceFromUrl(url: URL | Location): 'crm' | 'social' {
  const params = new URLSearchParams(url.search);
  const src = params.get('src');
  if (src === 'crm' || src === 'social') return src;
  return url.pathname.includes('/palestra/') ? 'crm' : 'social';
}
