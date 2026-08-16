const MISSING_BINARY_DETECT_ERROR =
  /no such file or directory|cannot find the file specified|os error 2|not found during startup detection|cli not found/i;

export function isMissingBinaryDetectError(
  error: string | null | undefined,
): boolean {
  const text = error?.trim() ?? "";
  return text.length > 0 && MISSING_BINARY_DETECT_ERROR.test(text);
}

export function resolveFirstRunDetectCardError(
  installed: boolean,
  error: string | null | undefined,
): string | null {
  if (installed) {
    return null;
  }
  const text = error?.trim() ?? "";
  if (!text || isMissingBinaryDetectError(text)) {
    return null;
  }
  return text;
}

export function retainFirstRunCardError(
  error: string | null | undefined,
): string | null {
  const text = error?.trim() ?? "";
  if (!text || isMissingBinaryDetectError(text)) {
    return null;
  }
  return text;
}
