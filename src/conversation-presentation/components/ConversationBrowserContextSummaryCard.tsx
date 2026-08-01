import type { ConversationPresentationContext } from "../../types";
import { BrowserContextSummaryCard } from "../../features/browser-agent";

type BrowserPresentationContext = Extract<
  ConversationPresentationContext,
  { kind: "browser" }
>;

export function ConversationBrowserContextSummaryCard({
  context,
}: {
  context: BrowserPresentationContext;
}) {
  return <BrowserContextSummaryCard attachment={context.view} />;
}
