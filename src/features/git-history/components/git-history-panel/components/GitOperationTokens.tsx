export type GitOperationTokenKind =
  | "command"
  | "operator"
  | "remote"
  | "branch"
  | "option";

export type GitOperationToken = {
  kind: GitOperationTokenKind;
  value: string;
  separatorBefore?: string;
};

type GitOperationTokensProps = {
  tokens: readonly GitOperationToken[];
  as?: "code" | "div" | "span";
  className?: string;
};

export function GitOperationTokens({
  tokens,
  as: Element = "span",
  className,
}: GitOperationTokensProps) {
  return (
    <Element
      className={`git-history-operation-tokens${className ? ` ${className}` : ""}`}
      translate="no"
    >
      {tokens.map((token, index) => (
        <span
          key={`${index}-${token.kind}-${token.value}`}
          className={`git-history-operation-token is-${token.kind}`}
        >
          {token.separatorBefore ?? (index > 0 ? " " : "")}
          {token.value}
        </span>
      ))}
    </Element>
  );
}
