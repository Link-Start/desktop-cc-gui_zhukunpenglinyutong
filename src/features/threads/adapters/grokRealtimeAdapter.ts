import type { RealtimeAdapter } from "../contracts/conversationCurtainContracts";
import { mapCommonRealtimeEvent } from "./sharedRealtimeAdapter";

export const grokRealtimeAdapter: RealtimeAdapter = {
  engine: "grok",
  mapEvent(input: unknown) {
    return mapCommonRealtimeEvent("grok", input, {
      allowTextDeltaAlias: true,
    });
  },
};
