# Cadence

An AI sales copilot that plugs into HubSpot. Cadence keeps a working copy of your contacts, companies, and deals, watches the CRM for changes as they happen, and runs a Claude agent layer that reads the state of your pipeline and writes its conclusions back where your sales team already works: as notes and tasks on the record.

The point is simple. Sales teams live in the CRM but the CRM does not think for them. Deals go quiet, follow-ups slip, and the next right action is buried under fifty other records. Cadence watches for those moments and drafts the response, then hands it back to a human to send.

## The problem it solves

A HubSpot pipeline tells you what happened. It does not tell you what to do next. Reps end up doing that reasoning by hand, one record at a time, and the deals that most need attention are usually the ones nobody has looked at in two weeks.

Cadence closes that gap. It reasons over the whole pipeline continuously, surfaces the deals that are stalling or at risk, drafts the follow-up, and drops it onto the record as a note or task. Nothing is sent automatically. A person stays in the loop for every outbound touch.

## What it does

- Syncs contacts, companies, and deals from HubSpot into its own store so the agent layer has fast, queryable pipeline state.
- Listens to HubSpot webhooks so changes are reflected in near real time instead of on a nightly batch.
- Runs a Claude agent layer that analyzes deal risk, spots stalled follow-ups, and proposes the next action for each record that needs one.
- Writes agent output back into HubSpot as notes and tasks, with idempotency so the same insight never lands twice.
- Stays CRM-agnostic behind a provider interface. HubSpot is the first implementation; the interface is built so a second CRM slots in without rewriting the agent layer.

## Who it is for

Sales teams and revenue operators who already run their pipeline in HubSpot and want an agent watching it, not another dashboard to check. It is also a worked reference for the broader pattern of putting an AI agent on top of a CRM: pipeline copilots, HubSpot automation, sales-cadence tooling.

## Screenshots

Screenshots land here as the build progresses. They live in [`/screenshots/`](screenshots/) at the repo root and are embedded below.

<!-- Add embeds as UI milestones ship, for example:
![Pipeline dashboard](screenshots/02-dashboard.png)
![Agent-drafted follow-up note in HubSpot](screenshots/03-writeback-note.png)
-->

## Author

Built by Atif Ali. More work at [github.com/atifali-pm](https://github.com/atifali-pm).
