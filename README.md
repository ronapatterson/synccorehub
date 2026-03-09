# SyncCoreHub — Multi-Tenant CRM & Client Portal

SyncCoreHub is a full-stack, multi-tenant CRM platform for agencies and service businesses. It combines a staff-facing CRM dashboard (customer management, lead pipeline, projects, ICP scoring, referrals, and a plugin marketplace) with a branded client portal where customers can track their own projects and services. A BullMQ background worker handles async tasks like email delivery, webhook dispatch, and AI-powered ICP scoring.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone & Install](#1-clone--install)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Start Infrastructure (Docker)](#3-start-infrastructure-docker)
  - [4. Database Setup](#4-database-setup)
  - [5. Run Development Servers](#5-run-development-servers)
- [Apps](#apps)
  - [Web — CRM Dashboard](#web--crm-dashboard)
  - [Portal — Client Portal](#portal--client-portal)
  - [Worker — Background Jobs](#worker--background-jobs)
- [Packages](#packages)
- [Environment Variables Reference](#environment-variables-reference)
- [Deployment](#deployment)

---

## Features

| Feature | Description |
|---|---|
| **Multi-Tenant** | Each workspace is isolated with tenant-scoped data and role-based access |
| **CRM** | Full customer, lead, and pipeline management with activity tracking |
| **ICP Scoring** | AI-powered Ideal Customer Profile scoring to prioritize leads and customers |
| **Projects** | Kanban-style project tracking shared between staff and clients |
| **Client Portal** | Branded portal where clients log in to view their projects, services, and referrals |
| **Referral Program** | Track referrals, reward payouts, and referral links per tenant |
| **Plugin System** | Extensible plugin marketplace with a hooks SDK for custom integrations |
| **Webhooks** | Outbound webhooks with delivery tracking and retry logic |
| **API Keys** | Per-tenant API key management for external integrations |
| **Email** | Transactional emails via Resend (team invites, project updates, referral rewards) |
| **Stripe Billing** | Subscription management with Customer Portal |
| **Background Jobs** | BullMQ queues for email, webhook delivery, and ICP scoring |

---

## Architecture Overview

```
                        ┌───────────────────────────────┐
                        │        Nginx (port 80)         │
                        │   routes by Host header         │
                        └─────────┬──────────┬───────────┘
                                  │          │
                    ┌─────────────▼──┐  ┌────▼──────────────┐
                    │  CRM Web App   │  │  Client Portal     │
                    │  (port 3000)   │  │  (port 3001)       │
                    │  Next.js 15    │  │  Next.js 15        │
                    │  tRPC + Better │  │  Better Auth       │
                    │  Auth          │  │  (portal-specific) │
                    └────────┬───────┘  └──────┬────────────┘
                             │                 │
                    ┌────────▼─────────────────▼────────────┐
                    │           PostgreSQL 16                 │
                    │         (Drizzle ORM, multi-tenant)    │
                    └────────────────────────────────────────┘
                             │
                    ┌────────▼───────────────────────────────┐
                    │            BullMQ Worker                │
                    │  email | webhook delivery | icp scorer  │
                    └─────────────────┬──────────────────────┘
                                      │
                             ┌────────▼────────┐
                             │   Redis 7        │
                             │  (job queues)    │
                             └─────────────────┘

   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │  MinIO /   │   │  Resend    │   │  Stripe    │   │  Google /  │
   │  S3        │   │  (Email)   │   │  (Billing) │   │  GitHub    │
   │  (Files)   │   └────────────┘   └────────────┘   │  OAuth     │
   └────────────┘                                      └────────────┘
```

---

## Monorepo Structure

```
synccorehub/
├── apps/
│   ├── web/            # Staff-facing CRM dashboard (Next.js 15 + tRPC)
│   ├── portal/         # Client-facing portal (Next.js 15)
│   └── worker/         # BullMQ background job processor
├── packages/
│   ├── auth/           # Better Auth config for web + portal
│   ├── database/       # Drizzle ORM schema, migrations, client
│   ├── email/          # Resend email templates (React Email)
│   ├── plugins/        # Plugin SDK, hooks registry, manifest types
│   ├── types/          # Shared TypeScript types
│   ├── ui/             # Shared component library (shadcn/ui)
│   └── typescript-config/ # Shared tsconfig presets
├── docker/
│   ├── nginx/          # Reverse proxy config
│   └── postgres/       # DB init script
├── docker-compose.yml  # Full local stack
├── turbo.json          # Turborepo pipeline config
└── pnpm-workspace.yaml
```

---

## Tech Stack

| Concern | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| API Layer | tRPC v11 (web app) |
| Auth | Better Auth (web) + custom portal auth (portal) |
| Database | PostgreSQL 16 via Drizzle ORM |
| Job Queue | BullMQ + Redis 7 |
| File Storage | MinIO (local) / any S3-compatible service |
| Email | Resend + React Email templates |
| Payments | Stripe (subscriptions + Customer Portal) |
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** + **Docker Compose** (for local infrastructure)
- A [Resend](https://resend.com) account
- A [Stripe](https://stripe.com) account (optional for billing)
- Google and/or GitHub OAuth app credentials (optional)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/ronapatterson/synccorehub.git
cd synccorehub
pnpm install
```

### 2. Environment Variables

Copy the example file and fill in values:

```bash
cp .env.example .env
```

See the [Environment Variables Reference](#environment-variables-reference) section for details on each variable.

### 3. Start Infrastructure (Docker)

This starts PostgreSQL, Redis, and MinIO locally with a single command:

```bash
docker compose up -d postgres redis minio minio-setup
```

Verify everything is healthy:

```bash
docker compose ps
```

> MinIO console is available at `http://localhost:9001` (user: `synccorehub` / pass: `synccorehub-secret`)

### 4. Database Setup

Generate and apply the initial database migration:

```bash
pnpm db:migrate
```

Seed the database with sample data (optional):

```bash
pnpm db:seed
```

To open the Drizzle Studio visual database browser:

```bash
pnpm db:studio
```

### 5. Run Development Servers

Start all apps in parallel:

```bash
pnpm dev
```

| App | URL |
|---|---|
| CRM Dashboard | `http://localhost:3000` |
| Client Portal | `http://localhost:3001` |
| MinIO Console | `http://localhost:9001` |

Or run a specific app:

```bash
pnpm --filter @synccorehub/web dev
pnpm --filter @synccorehub/portal dev
pnpm --filter @synccorehub/worker dev
```

---

## Apps

### Web — CRM Dashboard

The main staff-facing application (`apps/web`, port 3000). Built with Next.js 15 App Router and tRPC for type-safe API calls.

**Key sections:**

| Route | Description |
|---|---|
| `/dashboard` | KPI overview: customers, ICP match rate, pipeline value, deal velocity |
| `/customers` | Customer list with ICP scores and CRM data |
| `/customers/[id]` | Customer detail: contact info, projects, activities |
| `/leads` | Lead pipeline with stage management |
| `/projects` | All projects across customers |
| `/projects/[id]` | Project detail: status, tasks, client portal access |
| `/contractors` | Contractor management |
| `/segments` | Customer segmentation |
| `/icp` | ICP profile configuration for AI scoring |
| `/marketplace` | Plugin marketplace |
| `/referrals` | Referral program management |
| `/reports` | Business reports and analytics |
| `/settings` | Tenant settings, team members, API keys, webhooks, billing, plugins |

### Portal — Client Portal

The client-facing application (`apps/portal`, port 3001). Clients receive an invite email, set a password, and can view:

- Their active projects and status updates
- Services subscribed to
- Referral links and rewards

Authentication is separate from the CRM — clients never have access to staff data.

### Worker — Background Jobs

The BullMQ worker (`apps/worker`) processes three queues:

| Queue | Jobs |
|---|---|
| `email` | Send transactional emails via Resend |
| `webhook-delivery` | Deliver outbound webhook payloads with retry logic |
| `icp-scorer` | Score leads and customers against the configured ICP profile |

The worker connects to the same PostgreSQL and Redis instances as the web app.

---

## Packages

| Package | Purpose |
|---|---|
| `@synccorehub/auth` | Better Auth configuration for web (Google/GitHub OAuth + email) and portal (email-only) |
| `@synccorehub/database` | Drizzle ORM schema, migration runner, typed client, seed script |
| `@synccorehub/email` | React Email templates: team invite, project status update, referral reward, portal invite |
| `@synccorehub/plugins` | Plugin SDK with hooks registry, manifest schema, and plugin execution sandbox |
| `@synccorehub/types` | Shared TypeScript interfaces and enums used across apps |
| `@synccorehub/ui` | shadcn/ui component library (Button, Card, Badge, Input, etc.) |
| `@synccorehub/typescript-config` | Shared `tsconfig` presets for Next.js, Node, and React library targets |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `BETTER_AUTH_SECRET` | Yes | Random 32+ char secret for CRM auth |
| `BETTER_AUTH_URL` | Yes | CRM app URL e.g. `http://localhost:3000` |
| `PORTAL_AUTH_SECRET` | Yes | Random 32+ char secret for portal auth |
| `PORTAL_AUTH_URL` | Yes | Portal URL e.g. `http://localhost:3001` |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app client secret |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email |
| `EMAIL_FROM` | Yes | Verified sender address e.g. `noreply@yourdomain.com` |
| `S3_ENDPOINT` | Yes | S3/MinIO endpoint URL |
| `S3_REGION` | Yes | S3 region e.g. `us-east-1` |
| `S3_ACCESS_KEY` | Yes | S3 access key |
| `S3_SECRET_KEY` | Yes | S3 secret key |
| `S3_BUCKET` | Yes | S3 bucket name |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (`sk_test_...` for dev) |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key (`pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret (`whsec_...`) |
| `APP_URL` | Yes | CRM app public URL |
| `PORTAL_URL` | Yes | Portal public URL |
| `ENCRYPTION_KEY` | Yes | 64-char hex string (32 bytes) for AES-256 plugin config encryption |

Generate secrets:

```bash
# Auth secrets
openssl rand -base64 32

# Encryption key (hex)
openssl rand -hex 32
```

---

## Deployment

### Docker (self-hosted)

Build and run the full stack with Docker Compose:

```bash
docker compose up -d
```

This starts all services: PostgreSQL, Redis, MinIO, the CRM web app, the client portal, the BullMQ worker, and the Nginx reverse proxy (port 80).

For production, update the environment variables in `docker-compose.yml` or use a `.env` file, and ensure `BETTER_AUTH_SECRET`, `PORTAL_AUTH_SECRET`, and `ENCRYPTION_KEY` are set to strong random values.

### Vercel / Railway / Render

Each app can be deployed independently:

- **`apps/web`** — deploy as a Next.js app, set root directory to `apps/web`
- **`apps/portal`** — deploy as a Next.js app, set root directory to `apps/portal`
- **`apps/worker`** — deploy as a Node.js service (requires persistent process, not serverless)

Use a managed PostgreSQL (e.g. Neon, Supabase) and managed Redis (e.g. Upstash) for serverless-compatible deployments.
