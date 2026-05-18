# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (http://localhost:4321)
pnpm build      # Production build (static SSG → ./dist)
pnpm preview    # Preview the production build
```

Package manager is **pnpm**. There is no `test` script: `e2e.spec.ts` at the repo root is a Playwright spec that must be invoked manually (e.g. `npx playwright test e2e.spec.ts` against a running `pnpm dev`). It is not part of any CI step.

## Environment Variables

Required in `.env` (and as Docker build args — they are baked into the static bundle at build time):

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

`src/lib/supabase.ts` throws at module load if either is missing. Because dynamic routes use `getStaticPaths` that queries Supabase, the build itself fails when Supabase is unreachable.

## Deployment

- `Dockerfile` is a 2-stage build: Node 20 alpine builds Astro → nginx alpine serves `dist/` using `nginx.conf`.
- `.github/workflows/ci_cd.yml` triggers on **tag push** matching `v*.*.*` (or manual dispatch). It builds and pushes the image to GHCR with semver, sha, and `latest` tags. Supabase env vars are passed via repo secrets as `--build-arg`.
- Release flow is: bump `package.json` version → commit → tag `vX.Y.Z` → push tag. Recent commits show this is a frequent, lightweight ritual.

## Architecture

Astro 5 + React (islands) + Tailwind v4 + Supabase. Output is **static SSG** (no `output: 'server'` in `astro.config.mjs`), served by nginx.

### Multi-campaign routing

Root `/` **redirects to `https://www.condor.com.br`** (see `astro.config.mjs`). There is no `src/pages/index.astro` — the site is a collection of independent campaign sub-sites:

| Route | Campaign | Composition entry | Backing service |
| --- | --- | --- | --- |
| `/mulher/` | Mês da Mulher 2026 | `src/pages/mulher/index.astro` | `services/eventService.ts` |
| `/mulher/palestra/[id]/` | Per-talk CRM landing | `src/pages/mulher/palestra/[id].astro` | Direct Supabase via `getStaticPaths` |
| `/maes/` | Dia das Mães 2026 | `src/pages/maes/index.astro` | `services/maesEventService.ts` |
| `/maes/palestra/[id]/` | Per-talk CRM landing | `src/pages/maes/palestra/[id].astro` | Direct Supabase via `getStaticPaths` |
| `/pascoa/` | Páscoa Condor | `src/pages/pascoa/index.astro` | `services/pascoaService.ts` (JSON-driven) |
| `/passeio-ciclistico/` | Passeio Ciclístico 2026 | `src/pages/passeio-ciclistico/index.astro` | Static (no service / no DB) |

Each campaign has its own component folder (`src/components/{maes,pascoa,pc}/`) and (where applicable) its own JSON data folder (`src/data/{maes,pascoa}/`). The `src/components/` root and `src/data/*.json` files at the top level belong to the **Mulher** campaign — they are not shared.

The two campaigns that share Supabase (`mulher` and `maes`) both query the same `palestras` table but filter by `campanha_id` (`mes-da-mulher-2026` vs `dia-das-maes-2026`) and have parallel-but-separate event services. When fixing one campaign's logic, check whether the other needs the same change — they have drifted (e.g. `maesEventService.getEventStatus` is a slightly newer fork of `eventService.getEventStatus`).

### Event data flow (mulher + maes)

1. The grid component (`EventGrid.astro` / `EventGridMaes.astro`) calls its service's `fetchEvents()` / `fetchMaesEvents()` at build time.
2. The service queries `palestras` filtered by `active=true` and the campaign's `campanha_id`, maps rows to the `Event` shape, then enriches with registration counts from the `inscricoes` table.
3. A client-side script on the page re-runs the fetch on `DOMContentLoaded` to refresh card statuses with browser-only signals (URL params, current time).

**`getEventStatus()` precedence** (`eventService.ts` and `maesEventService.ts`):
- `FINISHED` — `is_active=false`, `campanha_active=false`, or event date has passed.
- `SOON` — registration opening date is missing or in the future.
- `FULL` — registration count for the user's source has reached its quota.
- `OPEN` — otherwise (mulher additionally requires `link_inscripcion`).

**Source resolution** (used for quota checks): `?src=crm` or `?src=social` URL param; if absent, defaults to `crm` when the path includes `/palestra/`, otherwise `social`. CRM is the channel used by direct landings; social is the public grid.

**Debug overrides** (browser only): `?force_status=OPEN|SOON|FULL|FINISHED` and optional `?force_event=<id>` override the computed status.

### Registration flow

- **Grid path**: `EventCard.astro` opens `EventModal.astro` (native `<dialog>`). Form submission flows through `utils/formHandler.ts` → `services/registrationService.ts` → `repositories/registrationRepository.ts` → Supabase RPC `inscrever_participante`. On result, the modal closes and `FeedbackModal.astro` opens.
- **Direct-landing path** (`/{campaign}/palestra/[id]/`): a `getStaticPaths` query pre-renders one HTML page per active palestra, embedding the event metadata as props. The page renders `EventRegistrationForm.astro` directly and, in an inline script, re-checks quota live; if sold out it hides the form and shows the "Vagas Esgotadas" block.
- **Maes-specific fields**: the form is campaign-aware (`EventRegistrationForm` takes a `campaign: "maes" | "mulher"` prop). For Maes, `formHandler.ts` requires `nome_filho`, `cpf_filho`, `nascimento_filho`; CPF and CPF-do-filho must differ. These extra fields are passed through to the RPC as `p_nome_filho` / `p_cpf_filho` / `p_maioridade_filho`.

### Content configuration

All copy, links, and config live in JSON files in `src/data/`. `settings.json` holds GTM ID and CTA overrides (Mulher). `events.json` holds status badge/button labels and the `statusConfig` map — **not** event data, which comes from Supabase. Maes and Pascoa have their own `content.json` files in their respective subfolders.

### Styling

Tailwind v4 configured via `@tailwindcss/vite` plugin — there is no `tailwind.config.js`. Design tokens are declared in `@theme` blocks inside CSS files:
- `src/styles/global.css` — Mulher tokens (primary `#f43f5e` rose, accent `#1e293b`), shared utilities (`.glass`, `.glass-white`, `.glass-dark`, `.bg-grain`).
- Maes-specific tokens (e.g. `maes-primary`, `maes-wine`, `bg-maes-bg`, `font-maes-sans`) live alongside the Maes layout/components.
- `src/styles/globalPascoa.css` — Pascoa-specific tokens, imported from the Pascoa page.

### React islands

`src/components/ui/{Badge,Button,GlassCard}.tsx` are React TSX components used as Astro islands. Most of the site is plain `.astro`.

### Image mapping

In `EventCard.astro` event images are hardcoded by `event.id` string match (`degustacao-vinhos`, `receitas-arapongas`, `cervejas-especiais`). Unknown IDs fall back to `mulheres.png`. When adding a new Mulher event, either match an existing id or update the mapping.

### .pen files

`src/pages/maes/maes.pen` is an encrypted Pencil design file. Open it only through the `pencil` MCP tools — never `Read` or `Grep` it directly.
