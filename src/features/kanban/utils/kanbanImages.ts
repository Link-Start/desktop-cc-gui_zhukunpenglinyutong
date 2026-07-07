import { saveKanbanImage } from "../../../services/tauri/kanbanImages";

export function isKanbanImageDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

export function hasKanbanImageDataUrl(images: readonly string[]): boolean {
  return images.some(isKanbanImageDataUrl);
}

/**
 * 把 images 里的 base64 data URL 逐个落盘为文件路径；普通路径原样保留。
 * 单张落盘失败时保留原 data URL（best-effort，不丢用户附件）。
 */
export async function persistKanbanImages(images: readonly string[]): Promise<string[]> {
  return Promise.all(
    images.map(async (image) => {
      if (!isKanbanImageDataUrl(image)) {
        return image;
      }
      try {
        return await saveKanbanImage(image);
      } catch {
        return image;
      }
    }),
  );
}
