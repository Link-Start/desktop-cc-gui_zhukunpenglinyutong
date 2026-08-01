import type { ConversationItem } from "../../../types";

export function withoutMessagePresentationMetadata(
  items: ConversationItem[] | undefined,
) {
  return items?.map((item) => {
    if (item.kind !== "message") {
      return item;
    }
    const { presentationMetadata: _presentationMetadata, ...sourceFields } = item;
    return sourceFields;
  });
}
