/**
 * Compatibility entry for existing callers.
 *
 * New production code imports `FileMarkdownPreview` from `./FileMarkdownPreview`.
 */
export {
  FileMarkdownPreview as FileMarkdownPreviewFast,
} from "./FileMarkdownPreview";
export type {
  FileMarkdownPreviewProps as FileMarkdownPreviewFastProps,
} from "./FileMarkdownPreview";
