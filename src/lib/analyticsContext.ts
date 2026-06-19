/**
 * Propiedades globales de analytics derivadas de la URL de la petición (SSR).
 *
 * Se pasan a `<OpenPanelComponent globalProperties={...}>` para que viajen con
 * CADA evento (incluido el `screen_view` automático). Computarlas en servidor
 * resuelve el timing: van en el `init` ANTES del screen_view.
 *
 * Catálogo y reglas: docs/tracking-plan.md (§2).
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Campañas que usan el canal de cuota crm/social (solo ellas llevan `source`). */
const QUOTA_CAMPAIGNS = new Set(["mulher", "maes"]);

export type AnalyticsGlobals = Record<string, string>;

/**
 * @param url     `Astro.url`
 * @param referer cabecera `Referer` (`Astro.request.headers.get("referer")`)
 */
export function getAnalyticsGlobals(
  url: URL,
  referer?: string | null,
): AnalyticsGlobals {
  const segments = url.pathname.split("/").filter(Boolean);
  const campaign = segments[0] ?? "unknown";

  const isPalestra = url.pathname.includes("/palestra/");
  // misma regla de canal que utils/formHandler.ts y los [id].astro
  const isRegistrationPath =
    isPalestra || url.pathname.includes("/programacao/");

  const page_type = isPalestra
    ? "palestra"
    : QUOTA_CAMPAIGNS.has(campaign)
      ? "home"
      : "landing";

  const globals: AnalyticsGlobals = {
    campaign,
    route: url.pathname,
    page_type,
  };

  // `source` solo es significativo para mulher/maes (canal de cuota).
  if (QUOTA_CAMPAIGNS.has(campaign)) {
    const srcParam = url.searchParams.get("src");
    globals.source = srcParam ?? (isRegistrationPath ? "crm" : "social");
  }

  // UTM presentes (atribución de campaña).
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value) globals[key] = value;
  }

  // Host de procedencia, solo si es externo al sitio.
  if (referer) {
    try {
      const refHost = new URL(referer).host;
      if (refHost && refHost !== url.host) globals.referrer_host = refHost;
    } catch {
      // Referer malformado: se ignora.
    }
  }

  return globals;
}
