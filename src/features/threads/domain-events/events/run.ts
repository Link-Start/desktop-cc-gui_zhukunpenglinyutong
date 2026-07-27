import type { DomainEventCommonFields } from "./base";

export type RunSettledEvent = Readonly<
  DomainEventCommonFields & {
    type: "run.settled";
    status: "completed" | "failed" | "cancelled" | "replaced";
    evidence?: Readonly<Record<string, unknown>>;
  }
>;

export type RunDomainEvent = RunSettledEvent;
