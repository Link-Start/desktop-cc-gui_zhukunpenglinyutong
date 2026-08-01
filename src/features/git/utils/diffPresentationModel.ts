export type DiffPresentationEntry = {
  filePath: string;
  status: string;
  diff: string;
  fileName?: string;
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type NormalizedDiffPresentationEntry<
  T extends DiffPresentationEntry,
> = T & {
  presentationPath: string;
  presentationFileName: string;
};

export function normalizeDiffPresentationEntry<
  T extends DiffPresentationEntry,
>(
  entry: T,
  resolvePath: (filePath: string) => string,
): NormalizedDiffPresentationEntry<T> {
  const presentationPath = resolvePath(entry.filePath);
  const explicitName = entry.fileName?.trim();
  const normalizedPath = presentationPath.replace(/\\/g, "/");
  return {
    ...entry,
    presentationPath,
    presentationFileName:
      explicitName ??
      normalizedPath.split("/").filter(Boolean).pop() ??
      normalizedPath,
  };
}
