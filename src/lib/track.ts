/**
 * Wrapper client-side único para emitir eventos a OpenPanel.
 *
 * - Centraliza los nombres del catálogo (docs/tracking-plan.md §3) para evitar typos.
 * - Aplica un guard de PII: NUNCA deja salir CPF/email/teléfono/nombres (LGPD §6.3).
 * - Llama a `window.op` directamente (lo inyecta <OpenPanelComponent>); si aún no
 *   cargó, el optional-chaining lo vuelve un no-op. Analytics nunca rompe la UX.
 *
 * Decisión de arquitectura (Opción A): este helper NO empuja a `window.dataLayer`.
 * El contenedor GTM es de otro equipo/flujo; OpenPanel es fuente de verdad propia.
 */

/** Claves PII que jamás deben viajar en un evento. */
const PII_KEYS = new Set([
  "cpf",
  "cpf_filho",
  "email",
  "telefone",
  "phone",
  "nome",
  "name",
  "nome_filho",
  "nascimento_filho",
]);

type TrackValue = string | number | boolean | undefined | null;
type TrackProps = Record<string, TrackValue>;

/** Nombres de eventos del catálogo (docs/tracking-plan.md §3). */
export type AnalyticsEvent =
  | "cta_clicked"
  | "event_modal_opened"
  | "registration_started"
  | "registration_submitted"
  | "registration_succeeded"
  | "registration_failed"
  | "vagas_esgotadas_viewed"
  | "promo_banner_clicked"
  | "video_play"
  | "condor_em_casa_clicked"
  | "faq_opened"
  | "sponsor_clicked"
  | "social_link_clicked"
  | "scroll_depth";

function sanitize(props?: TrackProps): TrackProps {
  const clean: TrackProps = {};
  if (!props) return clean;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (PII_KEYS.has(key.toLowerCase())) {
      if (import.meta.env.DEV) {
        console.warn(`[analytics] clave PII "${key}" omitida del evento`);
      }
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export function track(event: AnalyticsEvent, props?: TrackProps): void {
  if (typeof window === "undefined") return;
  try {
    const op = (window as unknown as { op?: (...args: unknown[]) => void }).op;
    op?.("track", event, sanitize(props));
  } catch {
    // Silencioso a propósito: la analítica nunca debe romper la página.
  }
}
