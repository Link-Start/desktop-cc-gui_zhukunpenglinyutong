import { convertFileSrc } from "@tauri-apps/api/core";
import { LocalImage } from "../media/LocalImage";

export function resolveImageViewPreviewSrc(candidate: string): string {
  if (!candidate) {
    return "";
  }
  if (
    candidate.startsWith("http://") ||
    candidate.startsWith("https://") ||
    candidate.startsWith("data:") ||
    candidate.startsWith("asset://")
  ) {
    return candidate;
  }
  try {
    return convertFileSrc(candidate);
  } catch {
    return "";
  }
}

type ImageViewToolContentProps = {
  previewSrc: string;
  workspaceId?: string | null;
  localPath?: string;
  alt: string;
};

export function ImageViewToolContent({
  previewSrc,
  workspaceId,
  localPath,
  alt,
}: ImageViewToolContentProps) {
  if (!previewSrc) {
    return null;
  }
  return (
    <div className="task-details" style={{ padding: "12px", border: "none" }}>
      <div
        className="task-field-content"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <LocalImage
          src={previewSrc}
          workspaceId={workspaceId}
          localPath={localPath}
          alt={alt}
          loading="lazy"
          style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px" }}
        />
      </div>
    </div>
  );
}
