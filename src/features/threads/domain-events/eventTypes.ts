import type { MessageDomainEvent } from "./events/message";
import type { RunDomainEvent } from "./events/run";
import type { SessionDomainEvent } from "./events/session";
import type { ToolDomainEvent } from "./events/tool";
import type { TurnDomainEvent } from "./events/turn";
import type { UsageDomainEvent } from "./events/usage";

export type DomainEvent =
  | SessionDomainEvent
  | TurnDomainEvent
  | MessageDomainEvent
  | ToolDomainEvent
  | UsageDomainEvent
  | RunDomainEvent;

export type DomainEventType = DomainEvent["type"];

export const DOMAIN_EVENT_TYPES = [
  "session.started",
  "session.ended",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "message.delta.appended",
  "message.completed",
  "tool.started",
  "tool.completed",
  "usage.updated",
  "run.settled",
] as const satisfies readonly DomainEventType[];
