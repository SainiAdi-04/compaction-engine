import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  findCutPoint,
  findTurnStart,
  findTurnEnd,
  sumTokens,
  findInnerCutPoint,
} from "../src/core/cutPoint.ts";
import { Message } from "../src/types.ts";
import {
  fixtureNormal,
  fixtureToolResultAdjacent,
  fixtureSplitTurn,
  fixtureFileTracking,
} from "../src/fixtures/fakeConversations.ts";

function createMessage(
  id: string,
  role: Message["role"],
  tokenCount: number,
  content = "test content",
  toolCallId?: string,
): Message {
  const msg: Message = {
    type: "message",
    id,
    role,
    content,
    tokenCount,
  };
  if (toolCallId !== undefined) {
    msg.toolCallId = toolCallId;
  }
  return msg;
}

Deno.test("findCutPoint - empty messages array returns index -1 and isSplitTurn false", () => {
  const result = findCutPoint([], 100);
  assertEquals(result, {
    cutPointIndex: -1,
    isSplitTurn: false,
  });
});

Deno.test("findCutPoint - total tokens strictly less than keepRecentTokens returns -1", () => {
  const messages: Message[] = [
    createMessage("m1", "user", 50),
    createMessage("m2", "assistant", 50),
  ];
  const result = findCutPoint(messages, 200);
  assertEquals(result.cutPointIndex, -1);
  assertEquals(result.isSplitTurn, false);
});

Deno.test("findCutPoint - total tokens exactly equal to keepRecentTokens returns -1", () => {
  const messages: Message[] = [
    createMessage("m1", "user", 100),
    createMessage("m2", "assistant", 100),
  ];
  // Total tokens = 200. With keepRecentTokens = 200, all messages fit within budget -> returns -1
  const result = findCutPoint(messages, 200);
  assertEquals(result.cutPointIndex, -1);
});

Deno.test("findCutPoint - normal cut where budget is crossed in middle of messages", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),       // 0 - to summarize
    createMessage("m1", "assistant", 100),  // 1 - to summarize
    createMessage("m2", "user", 100),       // 2 - to summarize
    createMessage("m3", "assistant", 100),  // 3 - to summarize
    createMessage("m4", "user", 100),       // 4 - to summarize
    createMessage("m5", "assistant", 100),  // 5 - cut point (kept)
    createMessage("m6", "user", 100),       // 6 - kept
  ];
  // keepRecentTokens = 250: m6 (100) + m5 (100) = 200 <= 250. m4 (100) -> 300 > 250 (crosses).
  // Kept tail starts at m5 (index 5). Cut point index should be 5.
  const result = findCutPoint(messages, 250);
  assertEquals(result.cutPointIndex, 5);
});

Deno.test("findCutPoint - tokenCount = [10,10,10,10,10], keepRecentTokens = 45 trace", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 10),
    createMessage("m1", "assistant", 10),
    createMessage("m2", "user", 10),
    createMessage("m3", "assistant", 10),
    createMessage("m4", "user", 10),
  ];
  // m4(10)+m3(10)+m2(10)+m1(10)=40 <= 45. m0 makes 50 > 45. Kept tail starts at m1 (index 1).
  const result = findCutPoint(messages, 45);
  assertEquals(result.cutPointIndex, 1);
});

Deno.test("findCutPoint - single message with tokens exceeding keepRecentTokens", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
  ];
  // Total tokens (100) > keepRecentTokens (50).
  // Kept tail starts at index 0.
  const result = findCutPoint(messages, 50);
  assertEquals(result.cutPointIndex, 0);
});

Deno.test("findCutPoint - 2 messages where keepRecentTokens allows keeping 1 message", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),       // index 0
    createMessage("m1", "assistant", 100),  // index 1
  ];
  // Total tokens = 200. keepRecentTokens = 150.
  // m1 is 100 (<= 150). m0 makes tentative 200 > 150 -> crosses. Kept tail is m1 (index 1).
  const result = findCutPoint(messages, 150);
  assertEquals(result.cutPointIndex, 1);
});

Deno.test("findCutPoint - 3 messages where budget is crossed at index 1", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),       // index 0 - Turn 0
    createMessage("m1", "assistant", 100),  // index 1 - Turn 0
    createMessage("m2", "user", 100),       // index 2 - Turn 1
  ];
  // Total tokens = 300. keepRecentTokens = 150.
  // m2 is 100 <= 150. m1 makes tentative 200 > 150 -> crosses at idx = 2.
  // Turn 1 (index 2) has 100 tokens <= 150 -> isSplitTurn: false.
  const result = findCutPoint(messages, 150);
  assertEquals(result.cutPointIndex, 2);
  assertEquals(result.isSplitTurn, false);
});

Deno.test("findCutPoint - keepRecentTokens = 0 returns index of last message", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 100),
  ];
  const result = findCutPoint(messages, 0);
  assertEquals(result.cutPointIndex, 1);
});

Deno.test("findCutPoint - cut landing on tool_result steps back to non-tool_result message", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),       // 0 - Turn 0
    createMessage("m1", "assistant", 100),  // 1 - Turn 0
    createMessage("m2", "user", 100),       // 2 - Turn 1
    createMessage("m3", "assistant", 100),  // 3 - Turn 1
    createMessage("m4", "tool_result", 100, "tool output", "call-1"), // 4 - Turn 1
    createMessage("m5", "user", 100),       // 5 - Turn 2
    createMessage("m6", "assistant", 100),  // 6 - Turn 2
  ];
  // keepRecentTokens = 350:
  // m6(100) + m5(100) + m4(100) = 300 <= 350. m3 makes 400 > 350 -> crosses.
  // Candidate idx = 4 (tool_result) -> steps back to idx = 3 (assistant).
  // Turn 1 (2..4) has 300 tokens <= 350 -> isSplitTurn: false.
  const result = findCutPoint(messages, 350);
  assertEquals(result.cutPointIndex, 3);
  assertEquals(result.isSplitTurn, false);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});

Deno.test("findCutPoint - cut landing on consecutive tool_results steps back past all of them", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),       // 0 - Turn 0
    createMessage("m1", "assistant", 100),  // 1 - Turn 0
    createMessage("m2", "user", 100),       // 2 - Turn 1
    createMessage("m3", "assistant", 100),  // 3 - Turn 1
    createMessage("m4", "tool_result", 50, "out 1", "call-1"), // 4 - Turn 1
    createMessage("m5", "tool_result", 50, "out 2", "call-2"), // 5 - Turn 1
    createMessage("m6", "user", 100),       // 6 - Turn 2
    createMessage("m7", "assistant", 100),  // 7 - Turn 2
  ];
  // keepRecentTokens = 350:
  // m7(100) + m6(100) + m5(50) + m4(50) = 300 <= 350. m3 makes 400 > 350 -> crosses.
  // Raw cut lands on m4 (tool_result) -> steps back to m3 (assistant).
  const result = findCutPoint(messages, 350);
  assertEquals(result.cutPointIndex, 3);
  assertEquals(result.isSplitTurn, false);
  assertEquals(messages[result.cutPointIndex].role, "assistant");
});

Deno.test("findCutPoint - tool_result at index 0 when stepped back", () => {
  const messages: Message[] = [
    createMessage("m0", "tool_result", 100, "first is tool_result", "call-0"),
    createMessage("m1", "assistant", 100),
    createMessage("m2", "user", 100),
    createMessage("m3", "assistant", 100),
  ];
  // keepRecentTokens = 250: m3(100)+m2(100)=200 <= 250. m1 makes 300 > 250 -> idx = 2.
  const result = findCutPoint(messages, 250);
  assertEquals(result.cutPointIndex, 2);
});

Deno.test("findCutPoint - fixtureNormal with 400 keepRecentTokens", () => {
  const messages = fixtureNormal();
  const result = findCutPoint(messages, 400);
  assertEquals(result.cutPointIndex > 0, true);
  assertEquals(result.cutPointIndex < messages.length, true);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});

Deno.test("findCutPoint - fixtureToolResultAdjacent prevents cutting into tool_result", () => {
  const messages = fixtureToolResultAdjacent();
  const result = findCutPoint(messages, 480);
  assertEquals(result.cutPointIndex > 0, true);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});

Deno.test("findCutPoint - fixtureSplitTurn split turn scenario", () => {
  const messages = fixtureSplitTurn();
  // Turn 0 (indices 0..9) has 1300 tokens. With keepRecentTokens = 500, Turn 0 exceeds 500 tokens -> isSplitTurn: true
  const result = findCutPoint(messages, 500);
  assertEquals(result.cutPointIndex > 0, true);
  assertEquals(result.isSplitTurn, true);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});

Deno.test("findCutPoint - fixtureFileTracking cut point scenario", () => {
  const messages = fixtureFileTracking();
  const result = findCutPoint(messages, 500);
  assertEquals(result.cutPointIndex > 0, true);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});

Deno.test("findTurnStart - locates user message starting the turn", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 100),
    createMessage("m2", "tool_result", 50),
    createMessage("m3", "user", 100),
    createMessage("m4", "assistant", 100),
  ];
  assertEquals(findTurnStart(messages, 2), 0);
  assertEquals(findTurnStart(messages, 4), 3);
  assertEquals(findTurnStart(messages, 3), 3);
});

Deno.test("findTurnEnd - locates end of turn before next user message or array end", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 100),
    createMessage("m2", "tool_result", 50),
    createMessage("m3", "user", 100),
    createMessage("m4", "assistant", 100),
  ];
  assertEquals(findTurnEnd(messages, 0), 2);
  assertEquals(findTurnEnd(messages, 1), 2);
  assertEquals(findTurnEnd(messages, 3), 4);
});

Deno.test("sumTokens - sums tokenCount across specified range", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 150),
    createMessage("m2", "tool_result", 50),
  ];
  assertEquals(sumTokens(messages, 0, 2), 300);
  assertEquals(sumTokens(messages, 1, 2), 200);
  assertEquals(sumTokens(messages, 0, 0), 100);
});

Deno.test("findInnerCutPoint - walks backward within turn boundaries and rolls back tool_results", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 200),
    createMessage("m2", "tool_result", 50),
    createMessage("m3", "assistant", 200),
    createMessage("m4", "tool_result", 50),
  ];
  // keepRecentTokens = 100: m4 (50) <= 100. m3 makes 250 > 100 -> inner cut lands on m4 (tool_result) -> rolls back to m3 (assistant).
  const cut = findInnerCutPoint(messages, 0, 4, 100);
  assertEquals(cut, 3);
});

Deno.test("findCutPoint - returns isSplitTurn false when turn fits in budget", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 100),
    createMessage("m1", "assistant", 100),
    createMessage("m2", "user", 100),
    createMessage("m3", "assistant", 100),
  ];
  // keepRecentTokens = 250: m3(100)+m2(100)=200 <= 250. m1 makes 300 > 250 -> idx = 2.
  // Turn 1 (2..3) has 200 tokens <= 250 -> isSplitTurn: false.
  const result = findCutPoint(messages, 250);
  assertEquals(result.cutPointIndex, 2);
  assertEquals(result.isSplitTurn, false);
});

Deno.test("findCutPoint - returns isSplitTurn true when turn exceeds budget", () => {
  const messages: Message[] = [
    createMessage("m0", "user", 50),
    createMessage("m1", "assistant", 50),
    createMessage("m2", "user", 100),
    createMessage("m3", "assistant", 300),
    createMessage("m4", "tool_result", 100),
    createMessage("m5", "assistant", 200),
  ];
  // Turn 1 (m2..m5) has 100+300+100+200 = 700 tokens. keepRecentTokens = 250.
  // Turn 1 exceeds 250 -> isSplitTurn: true.
  // Inner cut inside Turn 1 (2..5) with keepRecentTokens = 250:
  // m5 (200) <= 250. m4 makes 300 > 250 -> idx = 5 (assistant).
  const result = findCutPoint(messages, 250);
  assertEquals(result.isSplitTurn, true);
  assertEquals(result.cutPointIndex, 5);
  assertEquals(messages[result.cutPointIndex].role !== "tool_result", true);
});
