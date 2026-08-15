import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import X from "lucide-react/dist/esm/icons/x";
import {
  createOwnedObjectUrl,
  revokeOwnedObjectUrl,
} from "../../../../services/mediaResourceOwners";
import { LocalImage } from "../../../../components/common/LocalImage";

export type MessageImage = {
  src: string;
  label: string;
  /** Absolute filesystem path for LocalImage fallback when asset protocol fails. */
  localPath?: string | null;
};

function shouldUseTransientObjectUrl(src: string) {
  return src.toLowerCase().startsWith("data:image/");
}

function messageImageGridKey(image: MessageImage, index: number) {
  if (shouldUseTransientObjectUrl(image.src)) {
    return `${index}:${image.label}:${image.src.length}`;
  }
  return `${image.src}:${index}`;
}

function useTransientImageSrc(src: string) {
  const [transientSrc, setTransientSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldUseTransientObjectUrl(src)) {
      setTransientSrc(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(src)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = createOwnedObjectUrl(blob, {
          ownerId: "message-image-grid",
        });
        setTransientSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setTransientSrc(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        revokeOwnedObjectUrl(objectUrl);
      }
    };
  }, [src]);

  return transientSrc ?? src;
}

const ManagedMessageImage = memo(function ManagedMessageImage({
  src,
  alt,
  loading,
  localPath = null,
  workspaceId = null,
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
  localPath?: string | null;
  workspaceId?: string | null;
}) {
  const renderSrc = useTransientImageSrc(src);
  // Filesystem paths (esp. non-ASCII) often fail under asset://; LocalImage
  // falls back to read_local_image_data_url via localPath + workspaceId.
  if (localPath || (workspaceId && !src.toLowerCase().startsWith("data:"))) {
    return (
      <LocalImage
        src={renderSrc}
        localPath={localPath}
        workspaceId={workspaceId}
        alt={alt}
        loading={loading}
      />
    );
  }
  return <img src={renderSrc} alt={alt} loading={loading} decoding="async" />;
});

export const MessageImageGrid = memo(function MessageImageGrid({
  images,
  onOpen,
  hasText,
  workspaceId = null,
}: {
  images: MessageImage[];
  onOpen: (index: number) => void;
  hasText: boolean;
  workspaceId?: string | null;
}) {
  return (
    <div
      className={`message-image-grid${hasText ? " message-image-grid--with-text" : ""}`}
      role="list"
    >
      {images.map((image, index) => (
        <button
          key={messageImageGridKey(image, index)}
          type="button"
          className="message-image-thumb"
          onClick={() => onOpen(index)}
          aria-label={`Open image ${index + 1}`}
        >
          <ManagedMessageImage
            src={image.src}
            alt={image.label}
            loading="lazy"
            localPath={image.localPath}
            workspaceId={workspaceId}
          />
        </button>
      ))}
    </div>
  );
});

export const ImageLightbox = memo(function ImageLightbox({
  images,
  activeIndex,
  onClose,
  workspaceId = null,
}: {
  images: MessageImage[];
  activeIndex: number;
  onClose: () => void;
  workspaceId?: string | null;
}) {
  const { t } = useTranslation();
  const activeImage = images[activeIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!activeImage) {
    return null;
  }

  return createPortal(
    <div
      className="message-image-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="message-image-lightbox-content"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="message-image-lightbox-close"
          onClick={onClose}
          aria-label={t("messages.closeImagePreview")}
        >
          <X size={16} aria-hidden />
        </button>
        <ManagedMessageImage
          src={activeImage.src}
          alt={activeImage.label}
          localPath={activeImage.localPath}
          workspaceId={workspaceId}
        />
      </div>
    </div>,
    document.body,
  );
});
