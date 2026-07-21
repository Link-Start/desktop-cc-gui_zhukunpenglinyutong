import { useCallback, useLayoutEffect, useRef } from "react";
import type { TimelineMessageNodeBinding } from "../components/TimelineRowRenderer.types";
import { useKeyedNodeRefRegistry } from "./useKeyedNodeRefRegistry";

type RegisteredMessageNodeBinding = TimelineMessageNodeBinding & {
  node: HTMLDivElement;
};

export function useTimelineMessageNodeRefs(input: {
  agentTaskNodeByTaskIdRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
  agentTaskNodeByToolUseIdRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
  messageNodeByIdRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const bindingByMessageIdRef = useRef(new Map<string, TimelineMessageNodeBinding>());
  const registeredBindingByMessageIdRef = useRef(
    new Map<string, RegisteredMessageNodeBinding>(),
  );
  const registry = useKeyedNodeRefRegistry<HTMLDivElement>((messageId, node) => {
    const binding = bindingByMessageIdRef.current.get(messageId);
    const previous = registeredBindingByMessageIdRef.current.get(messageId);
    if (
      previous?.taskId &&
      (node === null || previous.taskId !== binding?.taskId) &&
      input.agentTaskNodeByTaskIdRef.current.get(previous.taskId) === previous.node
    ) {
      input.agentTaskNodeByTaskIdRef.current.delete(previous.taskId);
    }
    if (
      previous?.toolUseId &&
      (node === null || previous.toolUseId !== binding?.toolUseId) &&
      input.agentTaskNodeByToolUseIdRef.current.get(previous.toolUseId) === previous.node
    ) {
      input.agentTaskNodeByToolUseIdRef.current.delete(previous.toolUseId);
    }
    if (binding?.role === "user" && node) {
      input.messageNodeByIdRef.current.set(messageId, node);
    } else {
      input.messageNodeByIdRef.current.delete(messageId);
    }
    if (binding?.taskId && node) {
      input.agentTaskNodeByTaskIdRef.current.set(binding.taskId, node);
    }
    if (binding?.toolUseId && node) {
      input.agentTaskNodeByToolUseIdRef.current.set(binding.toolUseId, node);
    }
    if (binding && node) {
      registeredBindingByMessageIdRef.current.set(messageId, { ...binding, node });
    } else {
      registeredBindingByMessageIdRef.current.delete(messageId);
      bindingByMessageIdRef.current.delete(messageId);
    }
  });

  useLayoutEffect(() => {
    registry.syncMountedNodes();
  });

  const getRef = useCallback((messageId: string, binding: TimelineMessageNodeBinding) => {
    bindingByMessageIdRef.current.set(messageId, binding);
    return registry.getRef(messageId);
  }, [registry]);

  return { getRef };
}
