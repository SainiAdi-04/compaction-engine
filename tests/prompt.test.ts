import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { buildSummaryPrompt } from "../src/summary/prompt.ts";

Deno.test("buildSummaryPrompt - systemPrompt defines role and behavior rules", () => {
  const { systemPrompt } = buildSummaryPrompt("conv text");
  assertStringIncludes(systemPrompt, "context summarization assistant");
  assertStringIncludes(systemPrompt, "Do not continue the conversation");
});

Deno.test("buildSummaryPrompt - userMessage contains all required markdown sections", () => {
  const { userMessage } = buildSummaryPrompt("conv text");
  assertStringIncludes(userMessage, "## Goal");
  assertStringIncludes(userMessage, "## Constraints & Preferences");
  assertStringIncludes(userMessage, "## Progress");
  assertStringIncludes(userMessage, "### Done");
  assertStringIncludes(userMessage, "### In Progress");
  assertStringIncludes(userMessage, "### Blocked");
  assertStringIncludes(userMessage, "## Key Decisions");
  assertStringIncludes(userMessage, "## Next Steps");
  assertStringIncludes(userMessage, "## Critical Context");
  assertStringIncludes(userMessage, "<read-files>");
  assertStringIncludes(userMessage, "</read-files>");
  assertStringIncludes(userMessage, "<modified-files>");
  assertStringIncludes(userMessage, "</modified-files>");
});

Deno.test("buildSummaryPrompt - userMessage without previousSummary does not include previous summary section", () => {
  const conversation = "[User]: Initial message";
  const { userMessage } = buildSummaryPrompt(conversation);

  assertEquals(userMessage.includes("Here is the summary of everything before this point:"), false);
  assertStringIncludes(userMessage, `Here is the conversation to summarize:\n${conversation}`);
});

Deno.test("buildSummaryPrompt - userMessage with previousSummary includes previous summary block", () => {
  const prev = "## Goal\nPrevious goal summary";
  const conv = "[User]: New request";
  const { userMessage } = buildSummaryPrompt(conv, prev);

  assertStringIncludes(userMessage, `Here is the summary of everything before this point:\n${prev}`);
  assertStringIncludes(userMessage, `Here is the conversation to summarize:\n${conv}`);
});

Deno.test("buildSummaryPrompt - handles empty conversation string", () => {
  const { userMessage } = buildSummaryPrompt("");
  assertStringIncludes(userMessage, "Here is the conversation to summarize:\n");
});

Deno.test("buildSummaryPrompt - userMessage includes explicit file population instructions", () => {
  const { userMessage } = buildSummaryPrompt("conv");
  assertStringIncludes(userMessage, "IMPORTANT: You must populate <read-files> and <modified-files>");
});

