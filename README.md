# VaekstKapital Lead Dashboard

Internt dashboard for lead aktivering og pipeline tracking. Viser alle HubSpot contacts ekskl. VaekstNet platform brugere.

## Stack
- Next.js 15 (App Router) + TypeScript
- NextAuth (credentials, domain-based)
- Upstash Redis (caching)
- Chart.js 4.4.1 (CDN)
- HubSpot CRM API (EU1)

## Kom i gang

```bash
npm install
cp .env.example .env.local
# Udfyld alle env-variable
npm run dev
```

## Opsætning

### 1. HubSpot API Key
Hent fra HubSpot → Settings → Integrations → Private Apps

### 2. Upstash Redis
Opret gratis KV database på upstash.com eller via Vercel Storage

### 3. Password hash
Gå til https://bcrypt-generator.com, vælg 10 rounds, generer hash af fælles adgangskode.
Indsæt som `SHARED_PASSWORD_HASH` i env.

### 4. NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

## Deploy til Vercel

```bash
vercel deploy
```

Tilføj alle env-variable i Vercel dashboard under Settings → Environment Variables.

Vercel KV (Upstash) kan oprettes direkte i Vercel under Storage.

## Synkronisering

Kør `/api/sync` for at hente data fra HubSpot og gemme i cache.

Automatisk via cron: 06:00 og 18:00 (dansk tid).

Manuel: Klik "↻ Synkroniser" i topbaren.

## Debug

Besøg `/api/stages` for at se alle HubSpot pipelines og stage IDs.

## Hvem har adgang?

Alle emails fra godkendte domæner kan logge ind med fælles adgangskode:
- vaekstkapital.com
- vaekstkapital.dk
- vaekstnet.com
- vkfunddistribution.com
- vaekstholdings.com

Tilføj/fjern domæner i `src/lib/users.ts`.
