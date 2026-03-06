# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev          # Start dev server (http://localhost:4321)
pnpm build        # Production build
pnpm preview      # Preview the production build
```

Package manager is **pnpm**. No test runner is configured (Playwright is installed as a dev dependency but not wired up to scripts).

## Environment Variables

Required in `.env`:
```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

## Architecture

Single-page Astro 5 site ("Condor com Elas" — Women's Month 2026 campaign). Stack: Astro + React (islands) + Tailwind CSS v4 + Supabase.

**Page composition** (`src/pages/index.astro`): Hero → Intro → EventGrid → Experience → BannerCasa → Partners → Footer. All sections are Astro components that receive data from JSON files in `src/data/`.

**Data flow for events:**
1. `EventGrid.astro` calls `fetchEvents()` from `src/services/eventService.ts` at build/request time
2. `fetchEvents()` queries Supabase `palestras` table (active=true), then enriches with registration counts from `inscricoes` table via `registrationRepository`
3. Events are sorted: non-FINISHED first (by date), FINISHED last
4. Client-side script in `EventGrid.astro` re-calls `fetchEvents()` on `DOMContentLoaded` to update card statuses live (quota checks require browser URL params)

**Event status logic** (`src/services/eventService.ts → getEventStatus()`):
- `FINISHED`: `is_active=false`, `campanha_active=false`, or event date passed
- `SOON`: no `data_abertura_inscricao` or opening date in the future
- `FULL`: registration count >= quota for the user's source (`?src=crm` or `?src=social`)
- `OPEN`: has `link_inscripcion` and none of the above apply

Debug override: append `?force_status=OPEN&force_event=<id>` to URL to override status in browser.

**Registration flow:**
- `EventCard.astro` → button opens `EventModal.astro` (native `<dialog>`)
- Form submission handled by `src/utils/formHandler.ts`
- Calls `registrationService.submitRegistration()` → `registrationRepository.registerParticipant()` → Supabase RPC `inscrever_participante`
- On result, closes registration modal and opens `FeedbackModal.astro`
- Registration source is read from `?src=` URL param (defaults to `social`)

**Content configuration** (`src/data/*.json`): All copy, links, and configuration live in JSON files. The `settings.json` holds GTM ID and CTA overrides. `events.json` holds status badge/button labels and the `statusConfig` map (not event data — that comes from Supabase).

**Styling**: Tailwind v4 configured via `@tailwindcss/vite` plugin (no `tailwind.config.js`). Custom design tokens defined in `src/styles/global.css` under `@theme`: primary color `#f43f5e` (rose), accent `#1e293b`. Utility classes `.glass`, `.glass-white`, `.glass-dark`, `.bg-grain` are defined there.

**React components** (`src/components/ui/`): `Badge`, `Button`, `GlassCard` are React TSX used as Astro islands where needed.

**Image mapping** in `EventCard.astro`: event images are hardcoded by `event.id` string matching (`degustacao-vinhos`, `receitas-arapongas`, `cervejas-especiais`). Unknown IDs fall back to `mulheres.png`.
