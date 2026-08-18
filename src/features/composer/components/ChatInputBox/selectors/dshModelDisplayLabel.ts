import type { ModelInfo } from "../types";

const PROVIDER_LABEL_SEPARATOR = " / ";

export type DshModelDisplayLabelOptions = {
  /** Closed trigger shows `provider / lastSegment` so it cannot collide with other CLI names. */
  closed?: boolean;
};

/**
 * DSH catalog rows are stored as `{provider} / {model}` and some model ids
 * are routed (`ovh/Qwen2.5-VL-72B-Instruct`). List rows show the last model
 * token; the closed trigger keeps the provider prefix.
 */
export function formatDshModelDisplayLabel(
  model: Pick<ModelInfo, "id"> & Partial<Pick<ModelInfo, "model" | "label">>,
  options: DshModelDisplayLabelOptions = {},
): string {
  const lastSegment = resolveDshLastSegment(model);
  if (!options.closed) {
    return lastSegment;
  }
  const provider = firstPathSegment(model.id);
  if (!provider || provider.toLowerCase() === lastSegment.toLowerCase()) {
    return lastSegment;
  }
  return `${provider}${PROVIDER_LABEL_SEPARATOR}${lastSegment}`;
}

function resolveDshLastSegment(
  model: Pick<ModelInfo, "id"> & Partial<Pick<ModelInfo, "model" | "label">>,
): string {
  const candidates = [
    model.model?.trim(),
    takeAfterProviderSeparator(model.label),
    model.id.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const last = lastPathSegment(candidate);
    if (last) {
      return last;
    }
  }
  return model.id;
}

function takeAfterProviderSeparator(label?: string): string {
  const value = label?.trim() ?? "";
  const index = value.lastIndexOf(PROVIDER_LABEL_SEPARATOR);
  return index >= 0
    ? value.slice(index + PROVIDER_LABEL_SEPARATOR.length).trim()
    : value;
}

function firstPathSegment(value: string): string {
  const slash = value.indexOf("/");
  return (slash >= 0 ? value.slice(0, slash) : "").trim();
}

function lastPathSegment(value: string): string {
  const slash = value.lastIndexOf("/");
  return (slash >= 0 ? value.slice(slash + 1) : value).trim();
}
