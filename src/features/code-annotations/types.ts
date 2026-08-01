export type CodeAnnotationSource =
  | "file-preview-mode"
  | "file-edit-mode"
  | "embedded-diff-view"
  | "modal-diff-view";

export type CodeAnnotationLineRange = {
  startLine: number;
  endLine: number;
};

export type CodeAnnotationAnchor = {
  version: 1;
  selectedText: string;
  prefixText: string;
  suffixText: string;
  fingerprint: string;
};

export type CodeAnnotationSelection = {
  id: string;
  path: string;
  lineRange: CodeAnnotationLineRange;
  body: string;
  source: CodeAnnotationSource;
  anchor?: CodeAnnotationAnchor;
};

export type CodeAnnotationDraftInput = Omit<CodeAnnotationSelection, "id">;

export type CodeAnnotationBridgeProps = {
  onCreateCodeAnnotation?: (annotation: CodeAnnotationDraftInput) => void;
  onRemoveCodeAnnotation?: (annotationId: string) => void;
  codeAnnotations?: CodeAnnotationSelection[];
};
