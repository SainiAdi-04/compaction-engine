import { Message } from "../types.ts";

export function serializeConversation(messages: Message[]): string {
  let serializedString: string[] = [];
  for (const msg of messages) {
    const role = msg.role;
    let content = msg.content;

    if (role === "tool_result" && content.length > 2000) {
      const truncatedLength = content.length - 2000;
      content = content.slice(0, 2000) +
        `\n[truncated ${truncatedLength} chars]`;
    }

    serializedString.push(`${roleLabel(role)}: ${content}`);
  }

  return serializedString.join("\n");
}

function roleLabel(role: Message["role"]): string {
  switch (role) {
    case "user":
      return "[User]";
    case "assistant":
      return "[Assistant]";
    case "tool_result":
      return "[Tool result]";
    case "bash_execution":
      return "[Bash execution]";
    case "custom":
      return "[Custom]";
  }
}
