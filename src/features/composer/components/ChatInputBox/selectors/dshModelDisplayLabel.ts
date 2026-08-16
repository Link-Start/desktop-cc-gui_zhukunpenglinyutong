import type { ModelInfo } from "../types";

const PROVIDER_LABEL_SEPARATOR = " / ";

/**
 * DSH catalog rows are stored as `{provider} / {model}` and some model ids
 * are routed (`ovh/Qwen2.5-VL-72B-Instruct`). The picker only shows the
 * last model token.
 */
export function formatDshModelDisplayLabel(
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

function lastPathSegment(value: string): string {
  const slash = value.lastIndexOf("/");
  return (slash >= 0 ? value.slice(slash + 1) : value).trim();
}
