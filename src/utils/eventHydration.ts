import type { Event, EventStatus, EventStatusConfig } from '../types/event';
import {
  computeEventStatus,
  getStatusConfig,
  resolveSourceFromUrl,
} from './eventStatus';

interface PalestraRow {
  id: string;
  nome?: string;
  palestrante?: string;
  data_evento: string;
  data_abertura_inscricao?: string | null;
  data_limite_inscricao?: string | null;
  link_inscripcion?: string | null;
  tipo_evento?: string | null;
  active: boolean;
  qtd_crm?: number | null;
  qtd_social?: number | null;
}

interface InscricaoRow {
  event_id: string;
  source?: string | null;
}

export interface HydrateCardsOptions {
  campanhaId: string;
  containerSelector: string;
  source?: 'crm' | 'social';
  badgeColors?: Partial<Record<EventStatus, string>>;
  buttonColors?: Partial<Record<EventStatus, string>>;
  onCardUpdate?: (card: HTMLElement, status: EventStatus, event: Event) => void;
}

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

async function fetchPalestras(campanhaId: string): Promise<PalestraRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/palestras?active=eq.true&campanha_id=eq.${encodeURIComponent(campanhaId)}&select=*`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`palestras fetch ${res.status}`);
  return res.json();
}

async function fetchInscricoes(campanhaId: string): Promise<InscricaoRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/inscricoes?campanha_id=eq.${encodeURIComponent(campanhaId)}&select=event_id,source`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`inscricoes fetch ${res.status}`);
  return res.json();
}

function rowToEvent(row: PalestraRow, counts: InscricaoRow[]): Event {
  const eventCounts = counts.filter((c) => c.event_id === row.id);
  return {
    id: row.id,
    tema: row.nome ?? '',
    palestrante: row.palestrante ?? '',
    data_evento: row.data_evento,
    data_abertura_inscricao: row.data_abertura_inscricao ?? undefined,
    data_limite_inscricao: row.data_limite_inscricao ?? undefined,
    link_inscripcion: row.link_inscripcion ?? '',
    tipo_evento: row.tipo_evento ?? '',
    is_active: row.active,
    campanha_active: true,
    qtd_crm: row.qtd_crm ?? undefined,
    qtd_social: row.qtd_social ?? undefined,
    current_crm: eventCounts.filter((c) => c.source === 'crm').length,
    current_social: eventCounts.filter((c) => c.source === 'social' || !c.source).length,
  };
}

function applyStatusToCard(
  card: HTMLElement,
  status: EventStatus,
  config: EventStatusConfig,
  opts: HydrateCardsOptions,
  event: Event,
) {
  const badge = card.querySelector<HTMLElement>('[data-event-badge]');
  if (badge) {
    badge.textContent = config.label;
    const colorClass = opts.badgeColors?.[status];
    if (colorClass) {
      const prevColors = badge.dataset.appliedBadgeColors;
      if (prevColors) {
        prevColors.split(' ').forEach((c) => c && badge.classList.remove(c));
      }
      colorClass.split(' ').forEach((c) => c && badge.classList.add(c));
      badge.dataset.appliedBadgeColors = colorClass;
    }
  }

  const button = card.querySelector<HTMLElement>('[data-event-button]');
  if (button) {
    const textEl = button.querySelector<HTMLElement>('[data-event-button-text]') ?? button;
    textEl.textContent = config.button;

    if (button instanceof HTMLButtonElement) {
      button.disabled = config.disabled;
    } else {
      if (config.disabled) {
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.removeAttribute('aria-disabled');
      }
    }

    const colorClass = opts.buttonColors?.[status];
    if (colorClass) {
      const prevColors = button.dataset.appliedButtonColors;
      if (prevColors) {
        prevColors.split(' ').forEach((c) => c && button.classList.remove(c));
      }
      colorClass.split(' ').forEach((c) => c && button.classList.add(c));
      button.dataset.appliedButtonColors = colorClass;
    }

    if (config.disabled) {
      button.classList.add('cursor-not-allowed');
      button.classList.remove('cursor-pointer');
    } else {
      button.classList.add('cursor-pointer');
      button.classList.remove('cursor-not-allowed');
    }
  }

  card.dataset.eventStatus = status;
  opts.onCardUpdate?.(card, status, event);
}

function scheduleOpeningTransition(
  card: HTMLElement,
  event: Event,
  source: 'crm' | 'social' | undefined,
  opts: HydrateCardsOptions,
) {
  if (!event.data_abertura_inscricao) return;
  const opening = new Date(event.data_abertura_inscricao).getTime();
  const delay = opening - Date.now();
  if (delay <= 0 || delay > 2_147_000_000) return;

  window.setTimeout(() => {
    const next = computeEventStatus(event, { source });
    const config = getStatusConfig(next);
    applyStatusToCard(card, next, config, opts, event);
  }, delay + 250);
}

export async function hydrateEventCards(opts: HydrateCardsOptions): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[hydrateEventCards] Missing PUBLIC_SUPABASE_* env vars');
    return;
  }

  const container = document.querySelector<HTMLElement>(opts.containerSelector);
  if (!container) return;

  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-event-id]'));
  if (!cards.length) return;

  const source = opts.source ?? resolveSourceFromUrl(window.location);

  let palestras: PalestraRow[];
  let inscricoes: InscricaoRow[];
  try {
    [palestras, inscricoes] = await Promise.all([
      fetchPalestras(opts.campanhaId),
      fetchInscricoes(opts.campanhaId),
    ]);
  } catch (err) {
    console.warn('[hydrateEventCards] fetch failed, keeping server-rendered state', err);
    return;
  }

  const palestraById = new Map(palestras.map((p) => [p.id, p]));

  for (const card of cards) {
    const id = card.dataset.eventId;
    if (!id) continue;
    const row = palestraById.get(id);
    if (!row) {
      const event: Event = {
        id,
        tema: '',
        palestrante: '',
        data_evento: new Date(0).toISOString(),
        link_inscripcion: '',
        tipo_evento: '',
        is_active: false,
        campanha_active: false,
      };
      const config = getStatusConfig('FINISHED');
      applyStatusToCard(card, 'FINISHED', config, opts, event);
      continue;
    }

    const event = rowToEvent(row, inscricoes);
    const status = computeEventStatus(event, { source });
    applyStatusToCard(card, status, getStatusConfig(status), opts, event);

    if (status === 'SOON') {
      scheduleOpeningTransition(card, event, source, opts);
    }
  }
}

export function initEventHydration(opts: HydrateCardsOptions): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void hydrateEventCards(opts);
    });
  } else {
    void hydrateEventCards(opts);
  }
}
