type ComposingEvent = {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: {
    isComposing?: boolean;
    keyCode?: number;
  };
};

export function isComposingEvent(event: ComposingEvent) {
  return Boolean(
    event.isComposing ||
      event.keyCode === 229 ||
      event.nativeEvent?.isComposing ||
      event.nativeEvent?.keyCode === 229,
  );
}
