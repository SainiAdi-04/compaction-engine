import { cutPoint, Message } from "../types.ts";

export function findCutPoint(
  messages: Message[],
  keepRecentTokens: number,
): cutPoint {
  if (messages.length === 0) {
    return { cutPointIndex: -1, isSplitTurn: false };
  }
  let tCount = 0;
  let idx = messages.length - 1;
  let crossed = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    idx = i;
    tCount += messages[i].tokenCount;
    if (tCount >= keepRecentTokens) {
      crossed = true;
      break;
    }
  }

  if (!crossed) {
    return { cutPointIndex: -1, isSplitTurn: false };
  }

  while (idx > 0 && messages[idx].role === "tool_result") {
    idx--;
  }

  return {
    cutPointIndex: idx,
    isSplitTurn: false,
  };
}


