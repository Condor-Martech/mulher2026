# Plan de Tracking — Campañas Condor LP (mulher2026)

> Estrategia de medición por **ruta = landing page = campaña**.
> Cada ruta es una LP independiente; este plan permite **métricas por LP** y **comparación cross‑LP** sobre un único dataset.
> Convención de nombres: `object_action`, en inglés, `snake_case`.
> Herramienta principal: **OpenPanel** (`@openpanel/astro`, instalado · aún sin cablear).
>
> _Última actualización: 2026-06-19_

---

## 1. Visión general

### Estado actual de la instrumentación

| Herramienta | Estado | Dónde | Observación |
|---|---|---|---|
| **OpenPanel** (`@openpanel/astro@1.4.1`) | 🟡 Instalado, **sin usar** | — (pendiente partial `<Analytics>`) | A montar **una vez** en un partial compartido por las dos layouts. `clientId` y `apiUrl` por configurar (probable backend self‑hosted Condor, confirmar). |
| **Google Tag Manager** | ✅ **Activo** | `Layout.astro` + `LayoutMaes.astro` | `GTM-N96J7ZRF`, inyectado vía `dataLayer` **sin gate de consentimiento**. |
| GA4 (gtag directo) | ❔ No verificado | (entraría vía GTM) | Sin `G-XXXX` en el código. |

> A diferencia del sitio Hiper Mais, aquí **GTM ya está vivo** (no dormido) y **no hay banner de consentimiento**.

### Alcance — las 4 LPs NO se miden igual

| Ruta | Campaña | Tipo de medición | Conversión dura | KPI primario |
|---|---|---|---|---|
| `/mulher/` (+ `/mulher/palestra/[id]`) | Mês da Mulher 2026 | **Conversión** (funnel inscripción) | ✅ Form → RPC | Inscripciones |
| `/maes/` (+ `/maes/palestra/[id]`) | Dia das Mães 2026 | **Conversión** + dual‑channel + promo | ✅ Form → RPC | Inscripciones por canal |
| `/pascoa/` | Páscoa Condor | **Contenido / awareness** | 🟡 Blanda | Reproducción video + salida a tienda |
| `/passeio-ciclistico/` | Passeio Ciclístico 2026 | **Informacional / estática** | ❌ Ninguna (*"gratuita e sem inscrição prévia"*) | Engagement (FAQ, scroll, patrocinadores) |

**Principio rector:** no aplicar el mismo KPI a las 4. PC no tiene a qué convertir; su éxito es consumo de información, no inscripciones.

### Arquitectura de medición

**Un solo proyecto OpenPanel** + propiedad global **`campaign`** derivada del primer segmento de la ruta.

- **Métricas por LP** → filtrar/segmentar por `campaign`.
- **Comparación cross‑LP** → mismo evento, distinta `campaign`.
- **Un dashboard por campaña** sobre el mismo dataset.

> Proyectos separados (uno por campaña) darían métricas por LP pero matarían la comparación y duplicarían el funnel mulher/maes, que es casi idéntico. Por eso: **un proyecto**.

### Convención de nomenclatura

- Formato **`object_action`**: `event_modal_opened`, `registration_succeeded`.
- **Minúsculas + underscore**, sin espacios/acentos.
- El **contexto va en las propiedades**, no en el nombre del evento (`placement`, `source`, `event_id`).
- Sustantivos de dominio consistentes: `event_` (palestra), `registration_`. Documentar `palestra → event` para que mulher y maes no deriven.

---

## 2. Propiedades globales

Fijadas una vez por carga (Astro es MPA), **antes** del `screen_view` automático (ver §6, regla 5).

| Propiedad | Descripción | Ejemplo | Aplica a |
|---|---|---|---|
| `campaign` | 1er segmento de la ruta | `mulher` \| `maes` \| `pascoa` \| `passeio-ciclistico` | todas |
| `route` | Pathname completo | `/maes/palestra/degustacao-vinhos` | todas |
| `page_type` | Tipo de página | `home` \| `palestra` \| `landing` | todas |
| `event_id` | ID de palestra (solo en `[id]`) | `degustacao-vinhos` | mulher, maes (palestra) |
| `source` | **Canal de cuota** (NO origen UI) | `crm` \| `social` | mulher, maes |
| `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term` | Atribución | `instagram` / `social` / `maes2026` | todas |
| `referrer_host` | Host de procedencia | `instagram.com` | todas |

**Mapa `campaign` / `page_type` / `source` por ruta:**

| Ruta | `campaign` | `page_type` | `source` (default) |
|---|---|---|---|
| `/mulher/` | `mulher` | `home` | `social` |
| `/mulher/palestra/[id]` | `mulher` | `palestra` | `crm` |
| `/maes/` | `maes` | `home` | `social` |
| `/maes/palestra/[id]` | `maes` | `palestra` | `crm` |
| `/pascoa/` | `pascoa` | `landing` | — |
| `/passeio-ciclistico/` | `passeio-ciclistico` | `landing` | — |

> **`source`** sigue la resolución que ya existe en el código: `?src=crm|social`; si falta, `crm` cuando el path incluye `/palestra/`, si no `social`. Para pascoa/PC no aplica (queda nulo).

---

## 3. Catálogo de eventos

`✅` = conversión. Anclados a componentes reales del repo.

### 3.1 Automáticos (OpenPanel dispara solo)

| Evento | Descripción | Propiedades | Notas |
|---|---|---|---|
| `screen_view` | Pageview en cada navegación | (globales) | Enriquecer con `campaign`/`page_type`/`utm_*` antes del disparo (§6.5) |
| `link_out` | Clic en enlace externo | `href` | `trackOutgoingLinks`. Cubre la **cola larga** (socials del footer). **No** instrumentar evento nombrado sobre el mismo elemento (§6.2) |

### 3.2 Comunes a todas las LPs

| Evento | Descripción | Propiedades | Gatilho (archivo) | Mecanismo |
|---|---|---|---|---|
| `cta_clicked` | Clic en CTA / ancla de negocio | `placement`, `label`, `target_url` | Hero (`heroCta`), navs de ancla | `data-track` o `op()` |
| `scroll_depth` | Marca de profundidad de scroll | `percent` (`25`\|`50`\|`75`\|`100`) | listener global | programático (más útil en pascoa/PC) |

### 3.3 Funnel de inscripción — `mulher` + `maes`

| Evento | Descripción | Propiedades | Gatilho |
|---|---|---|---|
| `event_modal_opened` | Abre detalle de palestra | `event_id`, `event_status`, `source` | [EventModal.astro](../src/components/EventModal.astro) (mulher) / carga de `[id].astro` (ambos) |
| `registration_started` | Empieza a llenar el form | `event_id`, `source` | primer `focus` en [EventRegistrationForm.astro](../src/components/EventRegistrationForm.astro) |
| `registration_submitted` | Envía el form | `event_id`, `source` | submit ([formHandler.ts](../src/utils/formHandler.ts)) |
| ✅ `registration_succeeded` | RPC OK | `event_id`, `source` | [FeedbackModal.astro](../src/components/FeedbackModal.astro) éxito |
| `registration_failed` | RPC falla / retry agotado | `event_id`, `error_type`, `source` | tras agotar retry en [registrationService.ts](../src/services/registrationService.ts) |
| `vagas_esgotadas_viewed` | Ve estado FULL | `event_id`, `source` | render bloqueado (estado `FULL`) |

> `maes` no necesita eventos extra de funnel: su naturaleza **dual‑channel** queda capturada por la propiedad `source` (`crm`/`social`), que ya resuelves en servidor.

### 3.4 Solo `maes` — promos / partners

| Evento | Descripción | Propiedades | Gatilho |
|---|---|---|---|
| ✅ `promo_banner_clicked` | Clic en banner promo (salida externa) | `destination` (`premia`\|`clube_condor`), `placement` | [PromoBannerMaes.astro](../src/components/maes/PromoBannerMaes.astro) (`premia.condor.com.br`) · [AppBannerMaes.astro](../src/components/maes/AppBannerMaes.astro) (`clubecondor.com`) |

### 3.5 Solo `pascoa` — contenido

| Evento | Descripción | Propiedades | Gatilho |
|---|---|---|---|
| ✅ `video_play` | Reproduce el video (click‑to‑play) | `video_id` | [VideoSection.astro](../src/components/pascoa/sections/VideoSection.astro) (click que inyecta el iframe) |
| ✅ `condor_em_casa_clicked` | Salida a condor.com.br | `target_url` | [BannerEmCasa.astro](../src/components/pascoa/sections/BannerEmCasa.astro) |
| `content_card_clicked` | Interacción con tarjeta de contenido | `card_title` | [ContentCards.astro](../src/components/pascoa/sections/ContentCards.astro) _(opcional)_ |

> **Limitación:** el video es `<iframe>` de YouTube → play/complete reales no son captables por DOM. `video_play` mide solo el **play inicial** (el clic). Para completion habría que usar la YouTube IFrame API.

### 3.6 Solo `passeio-ciclistico` — engagement

| Evento | Descripción | Propiedades | Gatilho |
|---|---|---|---|
| `faq_opened` | Abre una pregunta del FAQ | `question` (o `faq_index`) | [FAQ.astro](../src/components/pc/FAQ.astro) / [Accordion.astro](../src/components/pc/Accordion.astro) |
| `sponsor_clicked` | Clic en patrocinador | `sponsor_name`, `target_url` | [Sponsors.astro](../src/components/pc/Sponsors.astro) |
| `cta_clicked` | Nav de ancla (#kit, #regulamento) | `placement: "header_nav"`, `label` | [Header.astro](../src/components/pc/Header.astro) |

---

## 4. Conversiones por LP

Marcar en el panel de OpenPanel. (El espejo en GA4 queda como **decisión abierta** — §8.)

| LP | Conversión | Evento | Prioridad | Conteo |
|---|---|---|---|---|
| mulher | Inscripción completada | `registration_succeeded` | 🔴 Primaria | 1× por evento+usuario |
| mulher | Intención de inscripción | `registration_submitted` | 🟠 Secundaria | por sesión |
| maes | Inscripción completada (por canal) | `registration_succeeded` | 🔴 Primaria | 1× por evento+usuario |
| maes | Clic a Prêmia / Clube Condor | `promo_banner_clicked` | 🟠 Secundaria | cada ocurrencia |
| pascoa | Reproducción de video | `video_play` | 🔴 Primaria | 1× por sesión |
| pascoa | Salida a tienda | `condor_em_casa_clicked` | 🟠 Secundaria | cada ocurrencia |
| passeio-ciclistico | (sin conversión dura) | — | — | mide engagement (§7) |

---

## 5. Segmentación / dimensiones

| Dimensión | Para qué |
|---|---|
| `campaign` | Aislar cada LP / comparar entre LPs |
| `source` | mulher/maes: rendimiento **CRM vs social** |
| `event_id` | Qué palestra convierte más / pierde más por cupo |
| `page_type` | `home` (grid) vs `palestra` (landing directa) |
| `utm_source` / `utm_campaign` | Atribución de inscripciones por canal de campaña |

---

## 6. Reglas globales (correcciones del plan anterior ya aplicadas)

1. **`source` es sagrado = canal `crm`/`social`** (lo usa el código para cuotas). Para origen de UI usar **`placement`**, nunca `source`. _(En el plan Hiper, `source` y `location` se solapaban.)_
2. **Anti‑doble‑conteo con `trackOutgoingLinks`:** todos los `target="_blank"` disparan `link_out` automático. Poner evento **nombrado solo en salidas de negocio** (`promo_banner_clicked`, `condor_em_casa_clicked`); dejar `link_out` para la cola larga (socials del footer). **Nunca ambos en el mismo elemento.** Para conversiones, contar el nombrado — jamás `link_out`.
3. **PII = cero.** Nunca enviar `cpf`, `cpf_filho`, `email`, `telefone`, `nome`, `nome_filho` como propiedad ni en `identify`. Si se requiere deduplicar, `profileId` = hash, nunca el valor crudo. `event_id`/`tema` sí. `error_type` = etiqueta corta (`quota_full`, `network`, `rpc_error`), no el mensaje crudo del backend.
4. **UTM + referrer desde el día 1** como propiedades globales — son LPs de campaña paga/social; sin esto no se atribuye `registration_succeeded` a su canal.
5. **`screen_view`: fijar `campaign`/`source`/`page_type`/`utm_*` como global property ANTES del screen_view automático** (en el init por página). Si se setea después, el único screen_view de esa carga va sin contexto de campaña.
6. **GA4/GTM sin "ficción de equivalencia":** OpenPanel = fuente de verdad del funnel. **No** mapear a eventos ecommerce (`view_item`, `select_promotion`, …) — no hay ecommerce. Si se refleja en GA4, empujar el **mismo nombre** por `dataLayer` y remapear en GTM, explícito. Un único dueño por conversión.
7. **Naming consistente:** `object_action`, snake_case, verbos en inglés, sustantivos de dominio estables (`event_`, `registration_`).

---

## 7. Métricas por LP (lo que verás en cada dashboard)

| LP | Conversión primaria | Métricas clave | Segmentación |
|---|---|---|---|
| **mulher** | `registration_succeeded` | tasa de inscripción (`succeeded / event_modal_opened`), demanda perdida (`vagas_esgotadas_viewed / event_modal_opened`), palestra top | `event_id` |
| **maes** | `registration_succeeded` | inscripción **por canal** (crm vs social), clics promo/app | `source`, `event_id` |
| **pascoa** | `video_play` + `condor_em_casa_clicked` | % que reproduce video, salida a tienda, profundidad de scroll | — |
| **passeio-ciclistico** | (ninguna dura) | FAQ abiertas, secciones alcanzadas (kit/regulamento), clics patrocinador, scroll | sección |

---

## 8. Pendencias y decisiones abiertas

1. **GA4/GTM ownership — DECISIÓN PENDIENTE.** Dos caminos:
   - **(A) OpenPanel fuente de verdad** — OpenPanel mide todo el funnel; GTM solo para marketing/pixels. Más simple, sin doble mantenimiento.
   - **(B) Espejo en GA4** — mismos nombres a `dataLayer`, remapeados en GTM. Datos también en GA4, a costa de doble sistema.
   - Mientras se decide: instrumentar en OpenPanel (regla §6.6 evita el error de Hiper de prometer equivalencias ecommerce inexistentes).
2. **LGPD / consentimiento.** Hoy GTM carga **sin gate**; OpenPanel cargaría igual. Decidir base legal (analítica anónima / interés legítimo) o introducir gate. **PII = cero es obligatorio** sea cual sea la decisión (§6.3).
3. **Video completion no medible** (`<iframe>` YouTube en pascoa): solo `video_play` (clic). Para `video_complete` real, migrar a la YouTube IFrame API.
4. **Configurar OpenPanel:** `clientId` y `apiUrl` (probable backend self‑hosted Condor — confirmar). Aún sin cablear.
5. **Componentes duplicados:** existen [EventCard.astro](../src/components/EventCard.astro) **y** [EventCard.tsx](../src/components/EventCard.tsx). Instrumentar **solo el que esté en uso** en el grid para no duplicar/omitir eventos.
6. **Coherencia mulher ↔ maes:** los servicios han derivado (`eventService` vs `maesEventService`). Al instrumentar uno, replicar en el otro para mantener el mismo funnel.

---

## 9. Validación / QA

| Herramienta | Para qué |
|---|---|
| Panel OpenPanel | Eventos en tiempo real y propiedades |
| GA4 DebugView | (si se activa el espejo) validar eventos/parámetros |
| GTM Preview Mode | Probar tags/triggers antes de publicar |
| DevTools → Network | Inspeccionar el payload a OpenPanel (verificar **cero PII**) |

**Checklist por evento:**

- [ ] Dispara en el gatilho correcto y **una sola vez**
- [ ] `campaign` / `page_type` / `source` correctos por ruta (probar `/maes/palestra/[id]?src=social`)
- [ ] El funnel completo dispara en orden, sin duplicados
- [ ] **Cero PII** en el payload (CPF, email, teléfono, nombres)
- [ ] `registration_failed` dispara tras agotar el retry de `registrationService`
- [ ] Salidas externas: o `link_out` o evento nombrado — **no ambos** (§6.2)
- [ ] UTM y `referrer_host` presentes cuando la sesión viene de campaña
