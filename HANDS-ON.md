# Cadence: hands-on kickoff

This file is the entry point for the next Claude Code session. Read it top to bottom before writing any code. It carries the phase plan, the paste-ready kickoff prompt, the gotchas from the finalized idea spec, and the screenshot convention.

Scaffold state: Phase 0 is done. Repo, docs, docker-compose stub, Fastify hello-world, the `CrmProvider` interface skeleton, and `.env.example` exist. No feature code has been written yet. No HubSpot API calls, no sync logic, no agent logic. That all starts in Phase 1.

## Screenshots

When you hit a UI or output milestone (the health endpoint responding, the first sync run logging rows, an agent-drafted note landing in HubSpot, a dashboard view), capture a screenshot and save it to `/screenshots/` at the repo root. Use descriptive filenames like `01-healthz.png`, `02-sync-run.png`, `03-writeback-note.png`, `04-dashboard.png`.

**Embed every screenshot in README.md** via relative markdown image refs: `![Dashboard](screenshots/04-dashboard.png)`. A public repo with screenshots embedded in the README is a complete portfolio artifact. **A live deploy URL is optional, not required.** Most viewers who land on the GitHub page see the app in action through the README; that IS the demo.

`/screenshots/` is the one canonical location for source image files. Do not duplicate them into `/docs/` or `/public/`. The README and the portfolio site both reference them from `/screenshots/` (the portfolio-maintainer copies them to the site's public dir at promotion time).

The portfolio-maintainer at `~/.claude/agents/portfolio-maintainer.md` looks in `/screenshots/` when deciding whether to promote the project to atifali.pages.dev. No screenshots means the project does not qualify.

## Preflight

Before the first build session, confirm the local environment:

- **Node 22** on the path. `node --version` should print v22.x.
- **Docker + Docker Compose** running. `docker compose version` should succeed.
- **Ports free.** Cadence uses API 8040, Postgres 5461, Redis 6386. These were scanned against every sibling project's docker-compose at scaffold time and are clear. If you add services, re-scan before picking new host ports.
- **HubSpot developer account.** This is the one manual step only Atif can do. Create a free HubSpot developer account and a test account, then generate a private app token under Settings, Integrations, Private Apps. Scopes needed: `crm.objects.contacts`, `crm.objects.companies`, `crm.objects.deals`, each read and write. Takes about ten minutes. Phase 1 cannot run against real HubSpot without it.
- **Anthropic API key.** Needed once the agent layer comes online in Phase 1.

Copy `.env.example` to `.env` and fill in the tokens before running anything against HubSpot.

## Kickoff prompt for the next session

Paste this into a fresh Claude Code session started from `/home/atif/projects/cadence/`:

```
We are building Cadence, an AI sales copilot integrated with HubSpot. Read HANDS-ON.md
and README.md, then read the project memory at
~/.claude/projects/-home-atif-projects-cadence/memory/ (start with MEMORY.md and
project_cadence.md). The full idea spec lives in the portfolio memory at
project_cadence_idea.md.

Phase 0 (scaffold) is done. Start Phase 1: the first vertical slice. In order:

1. Bring up Postgres and Redis via docker/docker-compose.yml. Confirm the Fastify
   hello-world serves /healthz on port 8040.
2. Set up Drizzle ORM and the first schema: tables for contacts and deals plus a sync
   cursor/watermark table.
3. Implement the HubSpot provider behind the CrmProvider interface in
   src/connectors/crm-provider.ts, using a private app token. Read only for now.
4. Sync contacts and deals from HubSpot into Postgres. Handle rate limits and retries.
5. Handle ONE HubSpot webhook subscription end to end: receive, validate the signature,
   enqueue to BullMQ, process.
6. Wire ONE Claude agent that reads a contact plus its deals and drafts a follow-up note,
   then write that note back to the HubSpot contact via the engagements API with an
   idempotency key.

Keep the slice thin but real on every layer. That vertical slice is the milestone that
makes HubSpot screening answers truthful. Capture screenshots as you go and embed them
in the README. Do not build Phase 2 breadth until the Phase 1 slice works end to end.
```

## Phase plan

### Phase 0: scaffold (done)

- [x] Repo, README, HANDS-ON, LICENSE, .gitignore
- [x] docker-compose stub with Postgres 16 and Redis 7
- [x] Fastify 5 hello-world serving /healthz
- [x] `CrmProvider` interface skeleton in `src/connectors/`
- [x] `.env.example` with the four required placeholders
- [x] `src/` module skeleton (connectors, sync, webhooks, jobs, agents, writeback, mcp, api)
- [x] Per-project Claude memory seeded

### Phase 1: vertical slice (the application-gate milestone)

- [ ] Docker services up; hello-world confirmed on 8040
- [ ] Drizzle schema: contacts, deals, sync cursor table
- [ ] HubSpot provider (private app token, read path) behind `CrmProvider`
- [ ] Contacts and deals sync into Postgres with rate-limit and retry handling
- [ ] One webhook subscription handled end to end (receive, validate, enqueue, process)
- [ ] One agent-drafted follow-up note written back to a real HubSpot contact
- [ ] Screenshots captured and embedded in README

### Phase 2: sync breadth and job hardening

- [ ] Companies sync and deal-stage tracking
- [ ] Full incremental sync with watermarks across all objects
- [ ] Broader webhook coverage
- [ ] BullMQ hardening: retries, backoff, dead-letter handling
- [ ] Rate-limit strategy under sustained load

### Phase 3: agent layer proper (demo milestone)

- [ ] Pipeline analyst agent: deal risk, stalled-deal detection
- [ ] Follow-up drafter agent
- [ ] Orchestrator coordinating the worker agents
- [ ] Case-study screenshots after this phase

### Phase 4: MCP and second provider

- [ ] MCP server exposing CRM tools (search contacts, deal summary, draft follow-up)
- [ ] Salesforce provider stub proving the interface holds

### Phase 5: polish and promotion

- [ ] Read-only dashboard
- [ ] Structured logging
- [ ] docs pass (ARCHITECTURE.md, API.md, SETUP.md)
- [ ] Portfolio promotion via portfolio-maintainer

## Gotchas from the idea spec

- **Cadence is a working name.** Atif may rename before Phase 1 ships. Rename is cheap until then, so do not hardcode the name in a way that is painful to change (config, package name, one banner constant, not scattered string literals).
- **HubSpot token is a manual prerequisite.** Nothing in Phase 1 runs against real HubSpot until Atif creates the developer account and generates the private app token. Do not stub around this permanently; the whole point is real integration.
- **Never automatic outbound.** The agent drafts notes and tasks. Humans send. No email sending anywhere in scope. Do not add a send path.
- **Never framed as HubSpot-official.** This is a custom integration showcase, not a HubSpot product or endorsement. Keep copy honest about that.
- **Salesforce is a stub only.** The second provider exists to prove the abstraction, not to be a real integration. Dev-org friction is not worth it yet.
- **Provider interface first, HubSpot behind it.** Do not let HubSpot-specific shapes leak into the agent layer or the API. Everything CRM-specific stays behind `CrmProvider`.
- **Phase 1 is thin on purpose.** One webhook, one agent note, contacts plus deals only. Resist building Phase 2 breadth early. The thin slice is what makes screening answers truthful, and it ships in one or two focused sessions only if it stays thin.
- **Portfolio case study waits for Phase 3.** Per the no-vapor rule, this becomes a portfolio piece after the agent layer is demo-worthy, not before.
