import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { hydrateClaudeDeferredImage } from "../../../../services/tauri";
import {
  createOwnedObjectUrl,
  revokeOwnedObjectUrl,
} from "../../../../services/mediaResourceOwners";
import type { ClaudeDeferredImage } from "../../../../types";
import type { MessageImage } from "../../components/media/MessageMediaBlocks";

export type DeferredImageState = {
  status: "idle" | "loading" | "loaded" | "error";
  src?: string;
  transient?: boolean;
  error?: string;
};

type DeferredImageRequestIdentity = {
  key: string;
  scopeKey: string;
  requestId: number;
};

export function deferredMessageImageKey(
  threadId: string | null | undefined,
  messageId: string,
  image: ClaudeDeferredImage,
) {
  const locator = image.locator;
  return JSON.stringify([
    image.workspacePath ?? "",
    threadId ?? "",
    messageId,
    locator.sessionId,
    locator.lineIndex,
    locator.blockIndex,
    locator.messageId ?? "",
    locator.mediaType,
  ]);
}

function deferredImageScopeKey(
  threadId: string | null | undefined,
  messageId: string,
  image: ClaudeDeferredImage,
) {
  return JSON.stringify([image.workspacePath ?? "", threadId ?? "", messageId]);
}

function isTransientImageObjectUrl(src: string | undefined, transient: boolean | undefined) {
  return Boolean(transient && src?.startsWith("blob:"));
}

function revokeDeferredImageState(state: DeferredImageState | undefined) {
  if (isTransientImageObjectUrl(state?.src, state?.transient) && state?.src) {
    revokeOwnedObjectUrl(state.src);
  }
}

async function createTransientImageObjectUrl(dataUrl: string) {
  if (!dataUrl.toLowerCase().startsWith("data:image/")) {
    return { src: dataUrl, transient: false };
  }
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return {
      src: createOwnedObjectUrl(blob, { ownerId: "message-deferred-image" }),
      transient: true,
    };
  } catch {
    return { src: dataUrl, transient: false };
  }
}

export function useDeferredMessageImages(input: {
  messageId: string;
  threadId?: string | null;
  images: ClaudeDeferredImage[];
}): {
  states: ReadonlyMap<string, DeferredImageState>;
  loadedImages: MessageImage[];
  load: (image: ClaudeDeferredImage) => Promise<void>;
} {
  const { messageId, threadId = null, images } = input;
  const [stateByKey, setStateByKey] = useState<Record<string, DeferredImageState>>({});
  const objectUrlsRef = useRef(new Set<string>());
  const requestSequenceRef = useRef(0);
  const latestRequestsRef = useRef(new Map<string, DeferredImageRequestIdentity>());
  const currentKeysRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const stateByKeyRef = useRef(stateByKey);
  const currentKeys = useMemo(
    () => new Set(images.map((image) => deferredMessageImageKey(threadId, messageId, image))),
    [images, messageId, threadId],
  );

  const revokeTrackedState = useCallback((state: DeferredImageState | undefined) => {
    const objectUrl = isTransientImageObjectUrl(state?.src, state?.transient)
      ? state?.src ?? null
      : null;
    revokeDeferredImageState(state);
    if (objectUrl) {
      objectUrlsRef.current.delete(objectUrl);
    }
  }, []);

  const isRequestCurrent = useCallback((identity: DeferredImageRequestIdentity) => {
    const latestIdentity = latestRequestsRef.current.get(identity.key);
    return (
      isMountedRef.current &&
      currentKeysRef.current.has(identity.key) &&
      latestIdentity?.scopeKey === identity.scopeKey &&
      latestIdentity.requestId === identity.requestId
    );
  }, []);

  const load = useCallback(async (image: ClaudeDeferredImage) => {
    const key = deferredMessageImageKey(threadId, messageId, image);
    const identity: DeferredImageRequestIdentity = {
      key,
      scopeKey: deferredImageScopeKey(threadId, messageId, image),
      requestId: requestSequenceRef.current + 1,
    };
    requestSequenceRef.current = identity.requestId;
    latestRequestsRef.current.set(key, identity);
    if (!image.workspacePath) {
      setStateByKey((current) => {
        if (!isRequestCurrent(identity)) {
          return current;
        }
        revokeTrackedState(current[key]);
        return {
          ...current,
          [key]: {
            status: "error",
            error: "Missing workspace path for this Claude image.",
          },
        };
      });
      return;
    }
    setStateByKey((current) => {
      if (!isRequestCurrent(identity)) {
        return current;
      }
      revokeTrackedState(current[key]);
      return { ...current, [key]: { status: "loading" } };
    });
    try {
      const hydrated = await hydrateClaudeDeferredImage(image.workspacePath, image.locator);
      const transientImage = await createTransientImageObjectUrl(hydrated.src);
      const loadedState: DeferredImageState = {
        status: "loaded",
        src: transientImage.src,
        transient: transientImage.transient,
      };
      const loadedObjectUrl = isTransientImageObjectUrl(loadedState.src, loadedState.transient)
        ? loadedState.src ?? null
        : null;
      if (!isRequestCurrent(identity)) {
        revokeDeferredImageState(loadedState);
        return;
      }
      if (loadedObjectUrl) {
        objectUrlsRef.current.add(loadedObjectUrl);
      }
      setStateByKey((current) => {
        if (!isRequestCurrent(identity)) {
          revokeDeferredImageState(loadedState);
          if (loadedObjectUrl) {
            objectUrlsRef.current.delete(loadedObjectUrl);
          }
          return current;
        }
        revokeTrackedState(current[key]);
        return { ...current, [key]: loadedState };
      });
    } catch (error) {
      if (!isRequestCurrent(identity)) {
        return;
      }
      setStateByKey((current) => {
        if (!isRequestCurrent(identity)) {
          return current;
        }
        revokeTrackedState(current[key]);
        return {
          ...current,
          [key]: {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          },
        };
      });
    }
  }, [isRequestCurrent, messageId, revokeTrackedState, threadId]);

  useEffect(() => {
    stateByKeyRef.current = stateByKey;
  }, [stateByKey]);

  useLayoutEffect(() => {
    currentKeysRef.current = currentKeys;
  }, [currentKeys]);

  useEffect(() => {
    latestRequestsRef.current.forEach((_identity, key) => {
      if (!currentKeys.has(key)) {
        latestRequestsRef.current.delete(key);
      }
    });
    setStateByKey((current) => {
      let changed = false;
      const next: Record<string, DeferredImageState> = {};
      Object.entries(current).forEach(([key, state]) => {
        if (currentKeys.has(key)) {
          next[key] = state;
          return;
        }
        changed = true;
        revokeTrackedState(state);
      });
      return changed ? next : current;
    });
  }, [currentKeys, revokeTrackedState]);

  useEffect(() => {
    const latestRequests = latestRequestsRef.current;
    const objectUrls = objectUrlsRef.current;
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      latestRequests.clear();
      Object.values(stateByKeyRef.current).forEach(revokeTrackedState);
      objectUrls.forEach((objectUrl) => revokeOwnedObjectUrl(objectUrl));
      objectUrls.clear();
    };
  }, [revokeTrackedState]);

  const states = useMemo(
    () => new Map(Object.entries(stateByKey)),
    [stateByKey],
  );
  const loadedImages = useMemo(
    () => images.flatMap((image, index) => {
      const state = stateByKey[deferredMessageImageKey(threadId, messageId, image)];
      return state?.status === "loaded" && state.src
        ? [{ src: state.src, label: `Deferred Claude image ${index + 1}` }]
        : [];
    }),
    [images, messageId, stateByKey, threadId],
  );

  return { states, loadedImages, load };
}
