import { memo } from "react";
import { adaptLegacyMessagesProps } from "../contracts/messagesInput";
import type { MessagesProps } from "../types/messagesTypes";
import { MessagesCore } from "./MessagesCore";

export const Messages = memo(function Messages(props: MessagesProps) {
  return <MessagesCore {...adaptLegacyMessagesProps(props)} />;
});
