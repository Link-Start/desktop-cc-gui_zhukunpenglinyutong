import { open } from "@tauri-apps/plugin-dialog";

export async function pickWorkspacePath(): Promise<string | null> {
  const selection = await open({ directory: true, multiple: false });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}

export async function pickImageFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif"],
      },
    ],
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function pickFiles(): Promise<string[]> {
  const selection = await open({
    multiple: true,
  });
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function pickWebAssetsArchive(): Promise<string | null> {
  const selection = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Web assets ZIP", extensions: ["zip"] }],
  });
  if (!selection || Array.isArray(selection)) {
    return null;
  }
  return selection;
}
