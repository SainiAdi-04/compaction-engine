import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  fixtureNormal,
  fixtureToolResultAdjacent,
  fixtureSplitTurn,
  fixtureFileTracking,
} from "../src/fixtures/fakeConversations.ts";
import { Message } from "../src/types.ts";

function validateFixtureMessages(messages: Message[]) {
  const seenIds = new Set<string>();
  for (const msg of messages) {
    assertEquals(msg.type, "message");
    assertEquals(typeof msg.id, "string");
    assertEquals(msg.id.length > 0, true);
    assertEquals(seenIds.has(msg.id), false, `Duplicate ID: ${msg.id}`);
    seenIds.add(msg.id);
    assertEquals(typeof msg.content, "string");
    assertEquals(typeof msg.tokenCount, "number");
    assertEquals(msg.tokenCount > 0, true);
    assertEquals(["user", "assistant", "tool_result", "bash_execution", "custom"].includes(msg.role), true);
  }
}

Deno.test("fixtures - fixtureNormal structure and token totals", () => {
  const messages = fixtureNormal();
  assertEquals(messages.length, 13);
  validateFixtureMessages(messages);

  const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  assertEquals(totalTokens, 1000);
});

Deno.test("fixtures - fixtureToolResultAdjacent structure and token totals", () => {
  const messages = fixtureToolResultAdjacent();
  assertEquals(messages.length, 9);
  validateFixtureMessages(messages);

  const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  assertEquals(totalTokens, 1000);

  // Check tool_result message at index 4
  assertEquals(messages[4].role, "tool_result");
  assertEquals(messages[4].toolCallId, "tool-call-adj-1");
});

Deno.test("fixtures - fixtureSplitTurn structure and token totals", () => {
  const messages = fixtureSplitTurn();
  assertEquals(messages.length, 11);
  validateFixtureMessages(messages);

  const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  assertEquals(totalTokens, 1350);
});

Deno.test("fixtures - fixtureFileTracking structure and token totals", () => {
  const messages = fixtureFileTracking();
  assertEquals(messages.length, 21);
  validateFixtureMessages(messages);

  const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  assertEquals(totalTokens, 1350);
});
