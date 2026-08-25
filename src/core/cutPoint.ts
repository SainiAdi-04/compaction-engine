import { cutPoint, Message } from "../types.ts";

export function findCutPoint(
  messages: Message[],
  keepRecentTokens: number,
): cutPoint {
  if (messages.length === 0) {
    return {
      cutPointIndex: -1,
      isSplitTurn: false,
    };
  }
  let tCount = 0;
  let idx = messages.length - 1;
  let crossed = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (tCount >= keepRecentTokens) {
      crossed = true;
      break;
    }
    idx = i;
    tCount += messages[i].tokenCount;
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

// manual test
const testMessages: Message[] = [
  {
    type: "message",
    id: "msg-0",
    role: "user",
    content: "Set up the project structure for me.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-1",
    role: "assistant",
    content: "Done — created src/, tests/, and cli/ directories.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-2",
    role: "user",
    content: "Now add a types.ts file with a Message interface.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-3",
    role: "assistant",
    content: "Created src/types.ts with the Message interface.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-4",
    role: "user",
    content: "Write findCutPoint() in src/core/cutPoint.ts.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-5",
    role: "assistant",
    content:
      'Implementing findCutPoint() now. Calling tool: write_file(path="src/core/cutPoint.ts")',
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-6",
    role: "tool_result",
    content:
      '{"status":"ok","output":"src/core/cutPoint.ts written successfully"}',
    tokenCount: 50,
    toolCallId: "tool-call-test-1",
  },
  {
    type: "message",
    id: "msg-7",
    role: "tool_result",
    content:
      '{"status":"ok","output":"src/core/cutPoint.ts written successfully"}',
    tokenCount: 50,
    toolCallId: "tool-call-test-1",
  },
  {
    type: "message",
    id: "msg-8",
    role: "user",
    content: "Add unit tests for findCutPoint.",
    tokenCount: 100,
  },
  {
    type: "message",
    id: "msg-9",
    role: "assistant",
    content: "Added three test cases. All passing.",
    tokenCount: 100,
  },
];

console.log(findCutPoint(testMessages, 250));
