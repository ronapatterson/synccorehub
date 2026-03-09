FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ── Install dependencies ──────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/email/package.json ./packages/email/
COPY packages/plugins/package.json ./packages/plugins/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm --filter @synccorehub/worker build

# ── Production image ──────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN npm install -g pnpm@9

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

WORKDIR /app/apps/worker

COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages /app/packages

USER worker

CMD ["node", "dist/index.js"]
