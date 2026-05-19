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

| Route | Campaign | Type | Composition entry | Backing service |
| --- | --- | --- | --- | --- |
| `/mulher/` | Mês da Mulher 2026 | Events + Registration | `src/pages/mulher/index.astro` | `services/eventService.ts` (Supabase) |
| `/mulher/palestra/[id]/` | Per-talk CRM landing | Dynamic SSR | `src/pages/mulher/palestra/[id].astro` | Direct Supabase query at request time |
| `/maes/` | Dia das Mães 2026 | Events + Registration + Promo | `src/pages/maes/index.astro` | `services/maesEventService.ts` (Supabase) + `maesService.ts` (Minio S3) |
| `/maes/palestra/[id]/` | Per-talk dual-channel landing | Dynamic SSR | `src/pages/maes/palestra/[id].astro` | Direct Supabase query at request time |
| `/pascoa/` | Páscoa Condor | Informational | `src/pages/pascoa/index.astro` | `services/pascoaService.ts` (Minio S3 + local fallback) |
| `/passeio-ciclistico/` | Passeio Ciclístico 2026 | Informational / Static | `src/pages/passeio-ciclistico/index.astro` | Static (no service / no DB) |

Each campaign has its own component folder (`src/components/{maes,pascoa,pc}/`) and (where applicable) its own JSON data folder (`src/data/{maes,pascoa}/`). The `src/components/` root and `src/data/*.json` files at the top level belong to the **Mulher** campaign — they are not shared.

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

### Cache strategy

Each page sets its own `Cache-Control` header for CDN/browser caching:
- `/mulher`, `/maes`: `max-age=30, stale-while-revalidate=60` (dynamic Supabase data)
- `/pascoa`: `max-age=60, stale-while-revalidate=120` (semi-static S3 content)
- `/passeio-ciclistico`: `max-age=300, stale-while-revalidate=600` (static content)

### Registration flow

- **Grid path**: `EventCard.astro` opens `EventModal.astro` (native `<dialog>`). Form submission flows through `utils/formHandler.ts` → `services/registrationService.ts` → `repositories/registrationRepository.ts` → Supabase RPC `inscrever_participante`. On result, the modal closes and `FeedbackModal.astro` opens.
- **Direct-landing path** (`/{campaign}/palestra/[id]/`): The SSR server queries Supabase on each request, calculates quota, and renders the form or "Vagas Esgotadas" block server-side. An inline script provides client-side form validation and submission.
- **Maes-specific fields**: the form is campaign-aware (`EventRegistrationForm` takes a `campaign: "maes" | "mulher"` prop). For Maes, `formHandler.ts` requires `nome_filho`, `cpf_filho`, `nascimento_filho`; CPF and CPF-do-filho must differ. These extra fields are passed through to the RPC as `p_nome_filho` / `p_cpf_filho` / `p_maioridade_filho`.
- **Dual-channel quotas (Maes only)**: The `/maes/palestra/[id]` page reads `?src=social` or `?src=crm` (default: `crm`) and checks the corresponding quota (`qtd_social` or `qtd_crm`).

### Content sources

| Source | Used by | Description |
| --- | --- | --- |
| **Supabase** (`palestras` + `inscricoes`) | Mulher, Maes | Event data and registration counts, queried at SSR time |
| **Minio S3** (`s3.cndr.me/lp-content/`) | Maes, Pascoa | Editorial content (JSON + images) with local fallback |
| **Local JSON** (`src/data/`) | All | Static config, fallback content, status labels |

All copy, links, and config live in JSON files in `src/data/`. `settings.json` holds GTM ID and CTA overrides (Mulher). `events.json` holds status badge/button labels and the `statusConfig` map — **not** event data, which comes from Supabase. Maes and Pascoa have their own `content.json` files in their respective subfolders.

### Layouts

- `src/layouts/Layout.astro` — Base layout used by Mulher, Pascoa, and Passeio Ciclístico. Fonts: Inter, Outfit, Pacifico. Includes GTM.
- `src/layouts/LayoutMaes.astro` — Exclusive Mães layout. Fonts: Montserrat, Pacifico, Pinyon Script. Includes Open Graph / Twitter Card meta tags, dedicated theme-color (#713334), and GTM.

### Styling

Tailwind v4 configured via `@tailwindcss/vite` plugin — there is no `tailwind.config.js`. Design tokens are declared in `@theme` blocks inside CSS files:
- `src/styles/global.css` — Mulher tokens (primary `#f43f5e` rose, accent `#1e293b`), shared utilities (`.glass`, `.glass-white`, `.glass-dark`, `.bg-grain`).
- `src/styles/maes.css` — Maes-specific tokens (e.g. `maes-primary`, `maes-wine`, `bg-maes-bg`, `font-maes-sans`), imported in LayoutMaes.
- `src/styles/globalPascoa.css` — Pascoa-specific tokens, imported from the Pascoa page.

### React islands

`src/components/ui/{Badge,Button,GlassCard}.tsx` are React TSX components used as Astro islands. Most of the site is plain `.astro`.

### Image mapping

In `EventCard.astro` event images are hardcoded by `event.id` string match (`degustacao-vinhos`, `receitas-arapongas`, `cervejas-especiais`). Unknown IDs fall back to `mulheres.png`. When adding a new Mulher event, either match an existing id or update the mapping.

### Supabase environments

| Environment | Project ID | Usage |
| --- | --- | --- |
| **Production** | `ezpdzyfbeyywpkmejunt` | Vercel (public site) |
| **Replica / Testing** | `bvmatruzfymlwapbzvjo` | Docker local (`mulher-test` on port 4321) |

**CRITICAL**: Never run INSERT/UPDATE/DELETE queries on the production database without explicit approval. Always verify which project ID you are targeting.

### .pen files

`src/pages/maes/maes.pen` is an encrypted Pencil design file. Open it only through the `pencil` MCP tools — never `Read` or `Grep` it directly.
