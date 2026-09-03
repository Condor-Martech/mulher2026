import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import eventsData from '../data/events.json';

const STATUS_CONFIG: Record<EventStatus, EventStatusConfig> =
  eventsData.statusConfig as Record<EventStatus, EventStatusConfig>;

export interface ComputeStatusOptions {
  source?: 'crm' | 'social';
  now?: Date;
  /**
   * Cierra las inscripciones cuando `data_limite_inscricao` ya pasó.
   *
   * Va DESACTIVADO por defecto a propósito. La columna existe en `palestras` y
   * los cuatro servicios la traen al objeto Event, pero hasta ahora ninguna
   * función de estado la evaluaba: se arrastraba y se tiraba. Encenderla para
   * todos cambiaría el estado de mulher, maes, pascoa y sabores —que están en
   * producción— en cuanto alguna de sus filas la tuviera poblada con una fecha
   * pasada, y eso no se puede comprobar sin consultar la base.
   *
   * Las campañas nuevas lo piden explícitamente. Si algún día se quiere para
   * todas, hay que revisar antes qué filas tienen la columna puesta.
   */
  enforceDeadline?: boolean;
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

  // Cierre por fecha límite de inscripción, distinto de la fecha del evento:
  // se puede dejar de admitir gente días antes de que el evento ocurra.
  // La fecha llega de Postgres con su huso, así que `new Date()` la resuelve
  // bien sin tocar nada: no hay que convertir a America/Sao_Paulo a mano.
  if (opts.enforceDeadline && event.data_limite_inscricao) {
    const deadline = new Date(event.data_limite_inscricao);
    if (!Number.isNaN(deadline.getTime()) && now > deadline) {
      return 'FINISHED';
    }
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
