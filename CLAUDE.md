# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (http://localhost:4321)
pnpm build      # Production build (SSR → ./dist/client + ./dist/server)
pnpm preview    # Preview the production build
```

Package manager is **pnpm**. There is no `test` script: `e2e.spec.ts` at the repo root is a Playwright spec that must be invoked manually (e.g. `npx playwright test e2e.spec.ts` against a running `pnpm dev`). It is not part of any CI step.

## Environment Variables

Required in `.env` and as Docker build args + runtime env vars (they are used both at build time for client-side code and at runtime for server-side SSR queries):

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

`src/lib/supabase.ts` throws at module load if either is missing. Under SSR, dynamic routes (`[id].astro`) query Supabase on every request — there is no `getStaticPaths`.

Optional (analytics — see below). When `PUBLIC_OPENPANEL_CLIENT_ID` is unset the `<Analytics>` partial renders nothing, so analytics degrades gracefully:

```
PUBLIC_OPENPANEL_CLIENT_ID=     # required to enable OpenPanel; absent ⇒ no-op
PUBLIC_OPENPANEL_API_URL=       # defaults to https://opapi.cndr.me (self-hosted)
PUBLIC_OPENPANEL_SCRIPT_URL=    # optional override
```

## Deployment

- `Dockerfile` is a 2-stage build: **Node 22 alpine** builds Astro → **Node 22 alpine** runner serves the SSR application via `node ./dist/server/entry.mjs` on port 4321.
- Supabase env vars are injected as `--build-arg` during `docker build` AND as `ENV` in the runner stage for runtime SSR access.
- `.github/workflows/ci_cd.yml` triggers on **tag push** matching `v*.*.*` (or manual dispatch). It builds and pushes the image to GHCR with semver, sha, and `latest` tags.
- Release flow is: bump `package.json` version → commit → tag `vX.Y.Z` → push tag.
- **Vercel**: Automatic deployment via Git integration. The `astro.config.mjs` auto-detects Vercel via `process.env.VERCEL` and uses `@astrojs/vercel` adapter.

## Architecture

Astro 5 + React (islands) + Tailwind v4 + Supabase. Output is **SSR** (`output: 'server'` in `astro.config.mjs`). The adapter is selected dynamically:

- **Vercel**: `@astrojs/vercel` (serverless functions)
- **Docker/Local**: `@astrojs/node` in `standalone` mode (port 4321)

### Multi-campaign routing

Root `/` **redirects to `https://www.condor.com.br`** (see `astro.config.mjs`). There is no `src/pages/index.astro` — the site is a collection of independent campaign sub-sites:

| Route                    | Campaign                      | Type                          | Composition entry                          | Backing service                                                         |
| ------------------------ | ----------------------------- | ----------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `/mulher/`               | Mês da Mulher 2026            | Events + Registration         | `src/pages/mulher/index.astro`             | `services/eventService.ts` (Supabase)                                   |
| `/mulher/palestra/[id]/` | Per-talk CRM landing          | Dynamic SSR                   | `src/pages/mulher/palestra/[id].astro`     | Direct Supabase query at request time                                   |
| `/maes/`                 | Dia das Mães 2026             | Events + Registration + Promo | `src/pages/maes/index.astro`               | `services/maesEventService.ts` (Supabase) + `maesService.ts` (Minio S3) |
| `/maes/palestra/[id]/`   | Per-talk dual-channel landing | Dynamic SSR                   | `src/pages/maes/palestra/[id].astro`       | Direct Supabase query at request time                                   |
| `/pascoa/`               | Páscoa Condor                 | Informational                 | `src/pages/pascoa/index.astro`             | `services/pascoaService.ts` (Minio S3 + local fallback)                 |
| `/passeio-ciclistico/`   | Passeio Ciclístico 2026       | Informational / Static        | `src/pages/passeio-ciclistico/index.astro` | Static (no service / no DB)                                             |
| `/sabordoveraokellanova/`| Sabor do Verão (Kellanova)    | Informational / **prerender** | `src/pages/sabordoveraokellanova/index.astro` | Static (JSON only — see below)                                       |

Each campaign has its own component folder (`src/components/{maes,pascoa,pc,kellanova}/`) and (where applicable) its own JSON data folder (`src/data/{maes,pascoa,kellanova}/`). The `src/components/` root and `src/data/*.json` files at the top level belong to the **Mulher** campaign — they are not shared.

The two campaigns that share Supabase (`mulher` and `maes`) both query the same `palestras` table but filter by `campanha_id` (`mes-da-mulher-2026` vs `dia-das-maes-2026`) and have parallel-but-separate event services. When fixing one campaign's logic, check whether the other needs the same change — they have drifted (e.g. `maesEventService.getEventStatus` is a slightly newer fork of `eventService.getEventStatus`).

### Event data flow (mulher + maes)

1. The grid component (`EventGrid.astro` / `IntroMaes.astro`) calls its service's `fetchEvents()` / `fetchMaesEvents()` at SSR time (on every request).
2. The service queries `palestras` filtered by `active=true` and the campaign's `campanha_id`, maps rows to the `Event` shape, then enriches with registration counts from the `inscricoes` table.
3. The dynamic palestra pages (`[id].astro`) query Supabase directly in the frontmatter on each request, checking quota in real-time.

**`getEventStatus()` / `computeEventStatus()` precedence** (`utils/eventStatus.ts`):

- `FINISHED` — `is_active=false`, `campanha_active=false`, or event date has passed.
- `SOON` — registration opening date is missing or in the future.
- `FULL` — registration count for the user's source has reached its quota.
- `OPEN` — otherwise (mulher additionally requires `link_inscripcion`).

**Source resolution** (used for quota checks): `?src=crm` or `?src=social` URL param; if absent, defaults to `crm` when the path includes `/palestra/`, otherwise `social`. CRM is the channel used by direct landings; social is the public grid.

**Debug overrides** (browser only): `?force_status=OPEN|SOON|FULL|FINISHED` and optional `?force_event=<id>` override the computed status.

### Sabor do Verão / Kellanova (`/sabordoveraokellanova/`)

The odd one out, and deliberately so. It is a **literal migration of a WordPress/Elementor page**, ported from
the standalone repo `Sites/sabores-kellanova` (whose `MIGRATION-MAP.md` and `CLAUDE.md` are the blueprint and
stay there). Fidelity to the original render is the acceptance criterion, so it does **not** follow this repo's
conventions and should not be "aligned" with them:

- **No layout, no React, no Supabase.** Its CSS is the WordPress CSS, pruned, in
  `src/styles/kellanova/{fuentes,origem,mejoras}.css` — imported in that order, because the cascade *is* the
  order. All of it is namespaced under the `sv-` prefix.
- **Tailwind is available here, but only through the `tw:` prefix** (`src/styles/kellanova/tailwind.css`).
  Write `tw:flex`, `tw:gap-4`. Three constraints hold it in place, each of them measured, and none is
  cosmetic — the file's own comment carries the details and the exact class names:
  - **No preflight.** Only `theme.css` and `utilities.css` are imported. Preflight sets defaults on elements
    the ported CSS never touches, and there the "unlayered beats layered" rule protects nothing. With the full
    `@import "tailwindcss"`, the page goes from 3454px to 3516px and 5,000,098 pixels change.
  - **`prefix(tw)`.** Unprefixed, Tailwind emits a utility whose name matches one WordPress left on 8 images
    here, and the origin CSS never declares that property on them, so the utility wins by default — the podium
    image grew 62px and dragged the whole page down with it. The prefix makes any future WordPress/Tailwind
    name collision impossible.
  - **`source(none)` + explicit `@source`.** Every sheet with a Tailwind import scans the whole project by
    default; without this, this sheet would carry the other four campaigns' utilities, which this page never
    uses.

  Net cost with nothing using it yet: **237 bytes**. Verified at 0 pixels of difference against the origin.
- **Every static file lives under `public/assets/sabordoveraokellanova/`** — the repo convention, and with
  *everything* inside it: images, fonts, the regulation PDF, the favicon and the OG image. Nothing of this
  campaign sits anywhere else under `public/`.

  ```
  public/assets/sabordoveraokellanova/
  ├── condor.png · Logo-Condor-cestas-de-natal@2x.png   favicon + og:image
  ├── documents/   the regulation PDF
  ├── fonts/       13 self-hosted faces
  └── images/      14 webp + 2 CSS backgrounds + 1 svg
  ```

  This is the one place the migration departs from the origin's literal output, and it costs an edit to two
  generated files: `fuentes.css` (13 `@font-face` sources) and `origem.css` (backgrounds + two `torus-bold`
  faces) now point at `/assets/sabordoveraokellanova/…`. If those files are ever regenerated from the origin
  workspace, that prefix has to be reapplied. **Careful with search-and-replace**: `/sabordoveraokellanova/`
  is also the page's own route, and the canonical, `og:url` and JSON-LD `@id`s must keep it *without* the
  `assets/` prefix.

  Images are referenced as plain `<img src="/assets/sabordoveraokellanova/images/…">`. The origin imported
  them through `astro:assets`; the `.webp` committed here are exactly what that pipeline produced, so the
  render is unchanged — verified at 0 pixels of difference against the origin's build, full page at 1920px.
  Keeping them out of `src/assets/` also stops `output: 'server'` from shipping 1.16 MB of unreferenced source
  PNGs into `_astro`. **Do not reintroduce `<Image>` here**: the markup replicates what it emitted, attribute
  for attribute, `fetchpriority` included.
- **`export const prerender = true`.** It has no request-time input, so it is built once to static HTML inside
  an otherwise SSR project. That is also why it can't set its own `Cache-Control` (see below).
- **Content lives in `src/data/kellanova/*.json`; the sibling `*.ts` files only type and validate it.** Those
  validators assert exact counts (`cuantos()`), so trimming an array in the JSON fails the build on purpose.
- **Two assets carry a legal obligation**: the winners list (`ganhadores.json`) and the regulation PDF at
  `public/sabordoveraokellanova/documents/`. The PDF is served from our own copy, referenced through the single
  `URL_REGULAMENTO` export — if that path stops resolving, the regulation stops being public.
- **Three things that look decorative and are not**: `data-sv-id` on the page wrapper (the root `max-width`
  hangs off it; without the attribute the page overflows horizontally), `data-settings` (read by
  `efectos.ts` to pick the entry animation), and the Swiper classes (`.swiper`, `.swiper-wrapper`,
  `.swiper-slide`). `scripts/kellanova/efectos.ts` also hooks `.faq-acordeon` and `.marcas-carrusel`.
- **Analytics is the origin's GTM container (`GTM-PCC7ZXX`), inline in the page, and no OpenPanel** — the
  campaign's historical data lives in that container. It does not mount `<Analytics>`.
- **Swiper is pinned to 8.4.7** and only this campaign uses it. Its package declares no `types` entry, hence
  the `paths` override in `tsconfig.json`.
- **Tailwind must not scan it from the *other* sheets.** Its WordPress markup carries class names that collide with Tailwind utility
  names; left alone, Tailwind emits those rules into *the other four campaigns'* stylesheets, which this
  campaign does not even load. The four Tailwind entry files (`global.css`, `maes.css`, `globalPascoa.css`,
  `saboresInverno.css`) each carry three `@source not` lines for this, with a comment naming the exact classes.
  Removing them silently changes the CSS of the live LPs.

  The wider trap, worth knowing before you write docs: **Tailwind v4 scans every file in the project, `.md`
  included.** Naming one of those colliding classes in prose — in this file, in the README, in a commit
  message that lands in a doc — is enough to generate the rule in all four production stylesheets. It has
  happened three times while writing this very section.

  So the rule is: **the literal class names live in the comment inside `src/styles/kellanova/tailwind.css` and
  in the four `@source not` blocks, never in markdown.** CSS files are not scanned, so those comments are
  safe. Markdown describes the collision; it does not spell it. To check before committing a doc change:

  ```bash
  grep -rn "size-" --include="*.md" . | grep -v node_modules   # must not name a real utility
  pnpm build && ls -la dist/client/_astro/index.*.css          # the four live sheets must not change size
  ```

### Cache strategy

Each page sets its own `Cache-Control` header for CDN/browser caching:

- `/mulher`, `/maes`: `max-age=30, stale-while-revalidate=60` (dynamic Supabase data)
- `/pascoa`: `max-age=60, stale-while-revalidate=120` (semi-static S3 content)
- `/passeio-ciclistico`: `max-age=300, stale-while-revalidate=600` (static content)
- `/sabordoveraokellanova`: none of its own. Being prerendered, it is a static file and the adapter serves it
  with `max-age=0`; the hashed `_astro` assets are immutable-cached as usual. Set the HTML TTL at the CDN if
  you want one.

### Registration flow

- **Grid path**: `EventCard.astro` opens `EventModal.astro` (native `<dialog>`). Form submission flows through `utils/formHandler.ts` → `services/registrationService.ts` → `repositories/registrationRepository.ts` → Supabase RPC `inscrever_participante`. On result, the modal closes and `FeedbackModal.astro` opens.
- **Direct-landing path** (`/{campaign}/palestra/[id]/`): The SSR server queries Supabase on each request, calculates quota, and renders the form or "Vagas Esgotadas" block server-side. An inline script provides client-side form validation and submission.
- **Maes-specific fields**: the form is campaign-aware (`EventRegistrationForm` takes a `campaign: "maes" | "mulher"` prop). For Maes, `formHandler.ts` requires `nome_filho`, `cpf_filho`, `nascimento_filho`; CPF and CPF-do-filho must differ. These extra fields are passed through to the RPC as `p_nome_filho` / `p_cpf_filho` / `p_maioridade_filho`.
- **Dual-channel quotas (Maes only)**: The `/maes/palestra/[id]` page reads `?src=social` or `?src=crm` (default: `crm`) and checks the corresponding quota (`qtd_social` or `qtd_crm`).

### Content sources

| Source                                    | Used by      | Description                                             |
| ----------------------------------------- | ------------ | ------------------------------------------------------- |
| **Supabase** (`palestras` + `inscricoes`) | Mulher, Maes | Event data and registration counts, queried at SSR time |
| **Minio S3** (`s3.cndr.me/lp-content/`)   | Maes, Pascoa | Editorial content (JSON + images) with local fallback   |
| **Local JSON** (`src/data/`)              | All          | Static config, fallback content, status labels          |

All copy, links, and config live in JSON files in `src/data/`. `settings.json` holds GTM ID and CTA overrides (Mulher). `events.json` holds status badge/button labels and the `statusConfig` map — **not** event data, which comes from Supabase. Maes and Pascoa have their own `content.json` files in their respective subfolders.

### Analytics

Two independent stacks run side by side and do **not** share state: **GTM** (`GTM-N96J7ZRF`, owned by another team, injected via both layouts) and **OpenPanel** (`@openpanel/astro`, the product team's source of truth). `track.ts` deliberately does **not** push to `window.dataLayer` — keep the two separate. The canonical event catalog, rules, and rationale live in [docs/tracking-plan.md](docs/tracking-plan.md) (Spanish); this section is the code-side summary.

- **`src/components/Analytics.astro`** — single partial mounted once in `<head>` of **both** layouts (`Layout.astro` + `LayoutMaes.astro`). Renders `<OpenPanelComponent>` only when `PUBLIC_OPENPANEL_CLIENT_ID` is set. `trackScreenViews` and `trackAttributes` are on; `trackOutgoingLinks` is **off** (business outbounds are tracked as named events to avoid double-counting). Also boots `scrollDepth.ts`.
- **`src/lib/analyticsContext.ts`** — `getAnalyticsGlobals(Astro.url, referer)` computes `globalProperties` **server-side** so they ride every event (including the auto `screen_view`). Derives `campaign`, `route`, `page_type`, UTM params, and external `referrer_host`. Adds `source` (crm/social) only for the quota campaigns (`mulher`, `maes`) — using the **same channel-resolution rule** as `utils/formHandler.ts` and the `[id].astro` pages. Keep these three in sync.
- **`src/lib/track.ts`** — the only way to emit a custom event: `track(event, props)`. `event` is typed against the `AnalyticsEvent` union (the catalog) so typos fail the build. **PII guard**: keys in `PII_KEYS` (cpf, email, telefone, nome, nascimento_filho, …) are stripped before sending (LGPD). Calls `window.op` via optional chaining and swallows all errors — analytics must never break the page. When adding an event, add its name to the `AnalyticsEvent` union.
- **Declarative tracking**: `data-track` attributes on elements (consumed by OpenPanel's `trackAttributes`) are used across campaign components (`Hero`, `Footer`, banners, FAQ, `[id].astro`, etc.) for click events without inline JS.
- **One exception, on purpose**: `/sabordoveraokellanova/` uses neither of these stacks. It carries the origin campaign's own GTM container (`GTM-PCC7ZXX`, inline in the page, id in `data/kellanova/seo.json`) and no OpenPanel, so its historical data stays continuous. It has no layout, so nothing mounts `<Analytics>` for it.

### Layouts

Both layouts mount the shared `<Analytics>` partial (OpenPanel) in `<head>` alongside GTM — see the Analytics section.

- `src/layouts/Layout.astro` — Base layout used by Mulher, Pascoa, and Passeio Ciclístico. Fonts: Inter, Outfit, Pacifico. Includes GTM + `<Analytics>`.
- `src/layouts/LayoutMaes.astro` — Exclusive Mães layout. Fonts: Montserrat, Pacifico, Pinyon Script. Includes Open Graph / Twitter Card meta tags, dedicated theme-color (#713334), GTM + `<Analytics>`.

### Styling

Tailwind v4 configured via `@tailwindcss/vite` plugin — there is no `tailwind.config.js`. Design tokens are declared in `@theme` blocks inside CSS files:

- `src/styles/global.css` — Mulher tokens (primary `#f43f5e` rose, accent `#1e293b`), shared utilities (`.glass`, `.glass-white`, `.glass-dark`, `.bg-grain`).
- `src/styles/maes.css` — Maes-specific tokens (e.g. `maes-primary`, `maes-wine`, `bg-maes-bg`, `font-maes-sans`), imported in LayoutMaes.
- `src/styles/globalPascoa.css` — Pascoa-specific tokens, imported from the Pascoa page.

Every file that starts with `@import "tailwindcss"` also carries a block of `@source not` rules: they exclude
the Kellanova campaign from Tailwind's project scan (see the Sabor do Verão section) **and all `*.md` files**.
`src/styles/kellanova/` is the one stylesheet folder with no Tailwind in it at all.

The markdown exclusion is not cosmetic. Tailwind v4 scans every file in the project, `.md` included, so a class
name mentioned in prose in this very file generates a real CSS rule in all four production stylesheets. That is
how the Kellanova leak came back the first time it was documented. No markdown here renders to the site (there
are no content collections), so none of it should generate CSS. Adding the rule removed exactly one utility
that had been living off documentation prose — `.inline`, 23 bytes, matched by the word "inline" in this file
and used by no page's markup.

### React islands

`src/components/ui/{Badge,Button,GlassCard}.tsx` are React TSX components used as Astro islands. Most of the site is plain `.astro`.

### Image mapping

In `EventCard.astro` event images are hardcoded by `event.id` string match (`degustacao-vinhos`, `receitas-arapongas`, `cervejas-especiais`). Unknown IDs fall back to `mulheres.png`. When adding a new Mulher event, either match an existing id or update the mapping.

### Supabase environments

| Environment    | Project ID             | Usage                |
| -------------- | ---------------------- | -------------------- |
| **Production** | `ezpdzyfbeyywpkmejunt` | Vercel (public site) |

**CRITICAL**: Never run INSERT/UPDATE/DELETE queries on the production database without explicit approval. Always verify which project ID you are targeting.

### .pen files

`src/pages/maes/maes.pen` is an encrypted Pencil design file. Open it only through the `pencil` MCP tools — never `Read` or `Grep` it directly.
