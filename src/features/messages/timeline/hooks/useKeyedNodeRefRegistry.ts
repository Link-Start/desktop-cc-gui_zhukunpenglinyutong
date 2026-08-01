import { useCallback, useMemo, useRef } from "react";

type NodeRefCallback<TNode> = (node: TNode | null) => void;

export function useKeyedNodeRefRegistry<TNode>(
  delegate: (key: string, node: TNode | null) => void,
) {
  const delegateRef = useRef(delegate);
  delegateRef.current = delegate;
  const callbacksRef = useRef(new Map<string, NodeRefCallback<TNode>>());
  const mountedNodesRef = useRef(new Map<string, TNode>());

  const getRef = useCallback((key: string) => {
    const existing = callbacksRef.current.get(key);
    if (existing) {
      return existing;
    }
    const callback: NodeRefCallback<TNode> = (node) => {
      if (node) {
        mountedNodesRef.current.set(key, node);
      } else {
        mountedNodesRef.current.delete(key);
      }
      delegateRef.current(key, node);
    };
    callbacksRef.current.set(key, callback);
    return callback;
  }, []);

  const retainKeys = useCallback((keys: ReadonlySet<string>) => {
    callbacksRef.current.forEach((_callback, key) => {
      if (!keys.has(key)) {
        callbacksRef.current.delete(key);
        mountedNodesRef.current.delete(key);
      }
    });
  }, []);

  const syncMountedNodes = useCallback(() => {
    mountedNodesRef.current.forEach((node, key) => {
      delegateRef.current(key, node);
    });
  }, []);

  return useMemo(
    () => ({ getRef, retainKeys, syncMountedNodes }),
    [getRef, retainKeys, syncMountedNodes],
  );
}
