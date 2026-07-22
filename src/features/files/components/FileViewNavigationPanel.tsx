import type { LspLocationLike } from "../utils/fileViewNavigationUtils";
import { relativePathFromFileUri } from "../utils/fileViewNavigationUtils";

type FileViewNavigationPanelProps = {
  workspacePath: string;
  navigationError: string | null;
  definitionCandidates: LspLocationLike[];
  onCloseDefinitionCandidates: () => void;
  implementationCandidates: LspLocationLike[];
  onCloseImplementationCandidates: () => void;
  referenceResults: LspLocationLike[] | null;
  onCloseReferenceResults: () => void;
  onNavigateToLocation: (location: LspLocationLike) => void;
  t: (key: string) => string;
};

export function FileViewNavigationPanel({
  workspacePath,
  navigationError,
  definitionCandidates,
  onCloseDefinitionCandidates,
  implementationCandidates,
  onCloseImplementationCandidates,
  referenceResults,
  onCloseReferenceResults,
  onNavigateToLocation,
  t,
}: FileViewNavigationPanelProps) {
  const hasDefinitionCandidates = definitionCandidates.length > 0;
  const hasImplementationCandidates = implementationCandidates.length > 0;
  const hasReferenceResults = referenceResults !== null;
  if (
    !navigationError
    && !hasDefinitionCandidates
    && !hasImplementationCandidates
    && !hasReferenceResults
  ) {
    return null;
  }

  const renderCandidates = (
    title: string,
    locations: LspLocationLike[],
    onClose: () => void,
  ) => locations.length > 0 ? (
    <div className="fvp-navigation-section">
      <div className="fvp-navigation-header">
        <span>{title}</span>
        <button
          type="button"
          className="ghost fvp-navigation-close"
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
      <ul className="fvp-navigation-list">
        {locations.map((location, index) => {
          const relativePath = relativePathFromFileUri(location.uri, workspacePath);
          const path = relativePath || location.uri;
          return (
            <li key={`${location.uri}-${location.line}-${location.character}-${index}`}>
              <button
                type="button"
                className="fvp-navigation-item"
                onClick={() => onNavigateToLocation(location)}
              >
                <span className="fvp-navigation-path" title={path}>{path}</span>
                <span className="fvp-navigation-line">
                  L{location.line + 1}:C{location.character + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  return (
    <div className="fvp-navigation-panel">
      {navigationError ? (
        <div className="fvp-navigation-error">{navigationError}</div>
      ) : null}
      {renderCandidates(
        t("files.definitionCandidates"),
        definitionCandidates,
        onCloseDefinitionCandidates,
      )}
      {renderCandidates(
        t("files.implementationCandidates"),
        implementationCandidates,
        onCloseImplementationCandidates,
      )}
      {hasReferenceResults ? (
        <div className="fvp-navigation-section">
          <div className="fvp-navigation-header">
            <span>{t("files.referenceResults")}</span>
            <button
              type="button"
              className="ghost fvp-navigation-close"
              onClick={onCloseReferenceResults}
            >
              {t("common.close")}
            </button>
          </div>
          {referenceResults && referenceResults.length > 0 ? (
            <ul className="fvp-navigation-list">
              {referenceResults.map((location, index) => {
                const relativePath = relativePathFromFileUri(location.uri, workspacePath);
                const path = relativePath || location.uri;
                return (
                  <li key={`${location.uri}-${location.line}-${location.character}-${index}`}>
                    <button
                      type="button"
                      className="fvp-navigation-item"
                      onClick={() => onNavigateToLocation(location)}
                    >
                      <span className="fvp-navigation-path" title={path}>
                        {path}
                      </span>
                      <span className="fvp-navigation-line">
                        L{location.line + 1}:C{location.character + 1}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="fvp-navigation-empty">{t("files.noReferencesFound")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
