import type { RealtimeAdapter } from "../contracts/conversationCurtainContracts";
import { mapCommonRealtimeEvent } from "./sharedRealtimeAdapter";

export const dshRealtimeAdapter: RealtimeAdapter = {
  engine: "dsh",
  mapEvent(input: unknown) {
    return mapCommonRealtimeEvent("dsh", input, {
      allowTextDeltaAlias: true,
    });
  },
};
