import { useRef } from "react";
import type {
  MessagesTimelineProps,
  TimelineInteractionModel,
  TimelineLiveModel,
  TimelineNavigationModel,
  TimelinePresentationModel,
  TimelineRuntimeModel,
  TimelineSlotsModel,
  TimelineSnapshotModel,
} from "../models/messagesTimelineModels";

function useShallowStableModel<T extends object>(next: T): T {
  const stableRef = useRef(next);
  const current = stableRef.current;
  const nextKeys = Object.keys(next) as Array<keyof T>;

  if (
    nextKeys.length !== Object.keys(current).length ||
    nextKeys.some((key) => !Object.is(current[key], next[key]))
  ) {
    stableRef.current = next;
  }

  return stableRef.current;
}

type MessagesTimelineModelsInput = {
  snapshot: TimelineSnapshotModel;
  live: TimelineLiveModel;
  runtime: TimelineRuntimeModel;
  navigation: TimelineNavigationModel;
  interactions: TimelineInteractionModel;
  presentation: TimelinePresentationModel;
  slots: TimelineSlotsModel;
};

export function useMessagesTimelineModels(
  input: MessagesTimelineModelsInput,
): MessagesTimelineProps {
  const snapshot = useShallowStableModel(input.snapshot);
  const live = useShallowStableModel(input.live);
  const runtime = useShallowStableModel(input.runtime);
  const navigation = useShallowStableModel(input.navigation);
  const interactions = useShallowStableModel(input.interactions);
  const presentation = useShallowStableModel(input.presentation);
  const slots = useShallowStableModel(input.slots);

  return { snapshot, live, runtime, navigation, interactions, presentation, slots };
}
