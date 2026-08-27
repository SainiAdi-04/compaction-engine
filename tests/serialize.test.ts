import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { serializeConversation } from "../src/core/serialize.ts";
import { Message } from "../src/types.ts";

function msg(role: Message["role"], content: string, id = "id-1", tokenCount = 10): Message {
  return { type: "message", id, role, content, tokenCount };
}

Deno.test("serializeConversation - empty array returns empty string", () => {
  assertEquals(serializeConversation([]), "");
});

Deno.test("serializeConversation - single user message formatting", () => {
  const result = serializeConversation([msg("user", "Hello world")]);
  assertEquals(result, "[User]: Hello world");
});

Deno.test("serializeConversation - single assistant message formatting", () => {
  const result = serializeConversation([msg("assistant", "How can I help?")]);
  assertEquals(result, "[Assistant]: How can I help?");
});

Deno.test("serializeConversation - single tool_result message formatting", () => {
  const result = serializeConversation([msg("tool_result", '{"ok":true}')]);
  assertEquals(result, '[Tool result]: {"ok":true}');
});

Deno.test("serializeConversation - single bash_execution message formatting", () => {
  const result = serializeConversation([msg("bash_execution", "ls -la\ntotal 0")]);
  assertEquals(result, "[Bash execution]: ls -la\ntotal 0");
});

Deno.test("serializeConversation - single custom message formatting", () => {
  const result = serializeConversation([msg("custom", "system notice")]);
  assertEquals(result, "[Custom]: system notice");
});

Deno.test("serializeConversation - multi-turn conversation joined with newline", () => {
  const messages: Message[] = [
    msg("user", "Create a file", "m1"),
    msg("assistant", "I will create it", "m2"),
    msg("tool_result", '{"status":"done"}', "m3"),
    msg("assistant", "All done!", "m4"),
  ];
  const expected =
    "[User]: Create a file\n" +
    "[Assistant]: I will create it\n" +
    '[Tool result]: {"status":"done"}\n' +
    "[Assistant]: All done!";
  assertEquals(serializeConversation(messages), expected);
});

Deno.test("serializeConversation - tool_result under 2000 chars is not truncated", () => {
  const content = "a".repeat(1999);
  const result = serializeConversation([msg("tool_result", content)]);
  assertEquals(result, `[Tool result]: ${content}`);
});

Deno.test("serializeConversation - tool_result exactly 2000 chars is not truncated", () => {
  const content = "b".repeat(2000);
  const result = serializeConversation([msg("tool_result", content)]);
  assertEquals(result, `[Tool result]: ${content}`);
});

Deno.test("serializeConversation - tool_result over 2000 chars is truncated with message", () => {
  const prefix = "x".repeat(2000);
  const suffix = "y".repeat(300);
  const content = prefix + suffix; // 2300 chars
  const result = serializeConversation([msg("tool_result", content)]);
  const expected = `[Tool result]: ${prefix}\n[truncated 300 chars]`;
  assertEquals(result, expected);
});

Deno.test("serializeConversation - user and assistant messages over 2000 chars are NOT truncated", () => {
  const largeContent = "z".repeat(3000);
  const userResult = serializeConversation([msg("user", largeContent)]);
  assertEquals(userResult, `[User]: ${largeContent}`);

  const assistantResult = serializeConversation([msg("assistant", largeContent)]);
  assertEquals(assistantResult, `[Assistant]: ${largeContent}`);
});

Deno.test("serializeConversation - bash_execution over 2000 chars is NOT truncated", () => {
  const largeBash = "c".repeat(2500);
  const bashResult = serializeConversation([msg("bash_execution", largeBash)]);
  assertEquals(bashResult, `[Bash execution]: ${largeBash}`);
});

Deno.test("serializeConversation - tool_result with exactly 2001 chars truncates 1 char", () => {
  const content = "x".repeat(2001);
  const result = serializeConversation([msg("tool_result", content)]);
  assertEquals(result, `[Tool result]: ${"x".repeat(2000)}\n[truncated 1 chars]`);
});

Deno.test("serializeConversation - empty content messages", () => {
  const result = serializeConversation([msg("user", ""), msg("assistant", "")]);
  assertEquals(result, "[User]: \n[Assistant]: ");
});

Deno.test("serializeConversation - multiple mixed messages with multiline content", () => {
  const messages: Message[] = [
    msg("user", "line1\nline2\nline3", "m1"),
    msg("assistant", "response\nwith\ncode", "m2"),
  ];
  assertEquals(
    serializeConversation(messages),
    "[User]: line1\nline2\nline3\n[Assistant]: response\nwith\ncode",
  );
});

