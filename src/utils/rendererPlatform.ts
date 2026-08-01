export type RendererPlatform = "macos" | "windows" | "linux" | "unknown";

type NavigatorLike = Pick<Navigator, "platform" | "userAgent"> & {
  userAgentData?: {
    platform?: string;
  };
};

export function detectRendererPlatform(
  navigatorLike: NavigatorLike | undefined = globalThis.navigator,
): RendererPlatform {
  const platform = (
    navigatorLike?.userAgentData?.platform ||
    navigatorLike?.platform ||
    navigatorLike?.userAgent ||
    ""
  ).toLowerCase();

  if (platform.includes("mac")) {
    return "macos";
  }
  if (platform.includes("win")) {
    return "windows";
  }
  if (platform.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

export function installRendererPlatformAttribute(
  documentLike: Pick<Document, "documentElement"> | undefined = globalThis.document,
  navigatorLike?: NavigatorLike,
) {
  documentLike?.documentElement.setAttribute(
    "data-platform",
    detectRendererPlatform(navigatorLike),
  );
}
