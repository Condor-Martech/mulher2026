# ==================================
# Stage 1: Build
# ==================================
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Allow build scripts for sharp/esbuild (pnpm v10 blocks them by default)
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true

# Copy package files for layer caching
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies and rebuild sharp for the target platform
RUN pnpm install --frozen-lockfile && pnpm rebuild sharp

# Copy source code
COPY . .

# Build-time env vars (baked into the client bundle via import.meta.env)
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

# Build for production (generates dist/client + dist/server)
RUN pnpm build

# ==================================
# Stage 2: Runner
# ==================================
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321

# Runtime env vars — server-side code (lib/supabase.ts) reads these at request time
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

CMD ["node", "./dist/server/entry.mjs"]
