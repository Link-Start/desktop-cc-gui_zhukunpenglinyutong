import {
  SAFETY_TIMEOUT_FORCED_MS,
  TICKET_APPLIED_RING_SIZE,
  TICKET_SCROLL_MATCH_TOLERANCE_PX,
} from "./scrollAuthorityConstants";
import type { ScrollOwner, WriteTicket } from "./scrollAuthorityTypes";

let ticketSeq = 0;

export function resetScrollWriteTicketSeqForTests() {
  ticketSeq = 0;
}

export function issueWriteTicket(input: {
  owner: Exclude<ScrollOwner, "none">;
  edge: WriteTicket["edge"];
  motion: WriteTicket["motion"];
  generation: number;
  now: number;
  safetyTimeoutMs?: number;
}): WriteTicket {
  ticketSeq += 1;
  const safetyMs = input.safetyTimeoutMs ?? SAFETY_TIMEOUT_FORCED_MS;
  return {
    id: `scroll-ticket-${ticketSeq}`,
    owner: input.owner,
    edge: input.edge,
    motion: input.motion,
    generation: input.generation,
    issuedAt: input.now,
    safetyTimeoutAt: input.now + safetyMs,
    appliedScrollTops: [],
  };
}

export function recordTicketAppliedScrollTop(
  ticket: WriteTicket,
  scrollTop: number,
  limit = TICKET_APPLIED_RING_SIZE,
): WriteTicket {
  const next = ticket.appliedScrollTops.filter(
    (value) => Math.abs(value - scrollTop) > TICKET_SCROLL_MATCH_TOLERANCE_PX,
  );
  next.push(scrollTop);
  while (next.length > limit) {
    next.shift();
  }
  return {
    ...ticket,
    appliedScrollTops: next,
  };
}

export function ticketMatchesAppliedScrollTop(
  ticket: WriteTicket | null,
  eventScrollTop: number,
  generation: number,
  tolerancePx = TICKET_SCROLL_MATCH_TOLERANCE_PX,
): boolean {
  if (!ticket || ticket.generation !== generation) {
    return false;
  }
  return ticket.appliedScrollTops.some(
    (value) => Math.abs(value - eventScrollTop) <= tolerancePx,
  );
}
