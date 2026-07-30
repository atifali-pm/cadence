import type { CrmContact, CrmDeal } from "../crm-provider.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/**
 * A small, realistic pipeline: a few healthy deals, a few going quiet, one
 * clearly stalled. Enough shape for the drafter to say something useful.
 */
export function demoContacts(): CrmContact[] {
  return [
    contact("9001", "mira.khan@northwindlabs.example", "Mira", "Khan", 2),
    contact("9002", "d.okafor@bluepeakhq.example", "David", "Okafor", 21),
    contact("9003", "s.lindqvist@arcticfreight.example", "Sara", "Lindqvist", 6),
    contact("9004", "tomas.rivera@helioscrm.example", "Tomas", "Rivera", 34),
    contact("9005", "a.nakamura@kitefinance.example", "Aiko", "Nakamura", 1),
    contact("9006", "p.vandermeer@dunecommerce.example", "Pieter", "van der Meer", 12),
  ];
}

export function demoDeals(): CrmDeal[] {
  return [
    deal("7001", "Northwind Labs annual platform", "contractsent", 48000, ["9001"], 2),
    deal("7002", "Bluepeak pilot expansion", "presentationscheduled", 15500, ["9002"], 21),
    deal("7003", "Arctic Freight onboarding", "qualifiedtobuy", 9200, ["9003"], 6),
    deal("7004", "Helios data migration", "decisionmakerboughtin", 27000, ["9004"], 34),
    deal("7005", "Kite Finance seats upgrade", "appointmentscheduled", 6400, ["9005"], 1),
    deal("7006", "Dune Commerce integration", "presentationscheduled", 18750, ["9006"], 12),
    deal("7007", "Bluepeak support retainer", "qualifiedtobuy", 4800, ["9002"], 19),
  ];
}

function contact(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  lastTouchDaysAgo: number,
): CrmContact {
  return {
    id,
    email,
    firstName,
    lastName,
    updatedAt: daysAgo(lastTouchDaysAgo),
    properties: { email, firstname: firstName, lastname: lastName },
  };
}

function deal(
  id: string,
  name: string,
  stage: string,
  amount: number,
  contactIds: string[],
  lastActivityDaysAgo: number,
): CrmDeal {
  return {
    id,
    name,
    stage,
    amount,
    contactIds,
    updatedAt: daysAgo(lastActivityDaysAgo),
    properties: { dealname: name, dealstage: stage, amount: String(amount) },
  };
}
