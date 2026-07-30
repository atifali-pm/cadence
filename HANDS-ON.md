# Cadence: local setup

Developer notes for running Cadence locally.

## Prerequisites

- Node 22 (`node --version` should print v22.x)
- Docker with Compose (`docker compose version` should succeed)
- Free host ports: 8040 (API), 5461 (Postgres), 6386 (Redis)

## Environment

Copy `.env.example` to `.env` and fill in the values:

- `HUBSPOT_PRIVATE_APP_TOKEN`: comes from a HubSpot developer account. Create a free developer account with a test account, then generate a private app under Settings, Integrations, Private Apps with read and write scopes for `crm.objects.contacts`, `crm.objects.companies`, and `crm.objects.deals`.
- `ANTHROPIC_API_KEY`: powers the agent layer.
- `DATABASE_URL` and `REDIS_URL`: the defaults in `.env.example` match the compose file.

## Demo mode (no account, no API key)

The fastest way to see Cadence work. It runs the entire loop (sync into Postgres, follow-up drafting, CRM write-back, and the exactly-once guard) against a bundled demo pipeline with a deterministic drafter. Nothing leaves your machine.

```
docker compose -f docker/docker-compose.yml up -d
npm install
npm run demo
```

## Running against HubSpot

```
docker compose -f docker/docker-compose.yml up -d
npm install
npm run dev        # API with the webhook receiver on port 8040
npm run worker     # queue worker for webhook events
npm run sync       # pull contacts and deals into Postgres
npm run followup -- <contactId>   # draft and post a follow-up note
```

These need the HubSpot credentials from the Environment section. Without `ANTHROPIC_API_KEY`, `followup` falls back to the deterministic drafter. `npm run typecheck` and `npm test` cover static checks and the test suite.

## Design rules

- The agent drafts notes and tasks; humans send them. There is no automatic outbound anywhere in the codebase and no email send path.
- Everything CRM-specific stays behind the `CrmProvider` interface. HubSpot shapes do not leak into the agent layer or the API surface.
- Cadence is a custom integration built on the public HubSpot API. It is not a HubSpot product and is not affiliated with HubSpot.

## Screenshots

UI and output screenshots live in [`/screenshots/`](screenshots/) at the repo root, named descriptively (`01-healthz.png`, `02-sync-run.png`), and get embedded in the README as milestones land.
