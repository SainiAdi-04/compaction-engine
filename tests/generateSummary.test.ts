import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { generateSummary } from "../src/summary/generateSummary.ts";
import { LLMProvider, LLMResponse } from "../src/types.ts";

class MockLLMProvider implements LLMProvider {
  public lastSystemPrompt = "";
  public lastUserMessage = "";
  public callCount = 0;

  constructor(
    private responseText: string,
    private usage = { inputTokens: 150, outputTokens: 50 },
    private shouldFail = false,
  ) {}

  call(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    this.callCount++;
    this.lastSystemPrompt = systemPrompt;
    this.lastUserMessage = userMessage;

    if (this.shouldFail) {
      return Promise.reject(new Error("LLM API call failed"));
    }

    return Promise.resolve({
      text: this.responseText,
      usage: this.usage,
    });
  }
}

Deno.test("generateSummary - successful generation with mock LLM provider", async () => {
  const llmText = `## Goal
Build a compaction engine.

<read-files>
src/core/cutPoint.ts
</read-files>

<modified-files>
src/types.ts
</modified-files>`;

  const provider = new MockLLMProvider(llmText, { inputTokens: 200, outputTokens: 60 });
  const result = await generateSummary("[User]: Please implement types", provider);

  assertEquals(provider.callCount, 1);
  assertEquals(result.summaryText, llmText);
  assertEquals(result.details.readFiles, ["src/core/cutPoint.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/types.ts"]);
  assertEquals(result.usage, { inputTokens: 200, outputTokens: 60 });
  assertStringIncludes(provider.lastSystemPrompt, "context summarization assistant");
});

Deno.test("generateSummary - passes previousSummary into prompt building", async () => {
  const provider = new MockLLMProvider("## Goal\nContinue work");
  const previousSummary = "## Goal\nInitial setup";
  await generateSummary("[User]: Next task", provider, previousSummary);

  assertStringIncludes(provider.lastUserMessage, "Here is the summary of everything before this point:\n## Goal\nInitial setup");
});

Deno.test("generateSummary - propagates provider error", async () => {
  const provider = new MockLLMProvider("", { inputTokens: 0, outputTokens: 0 }, true);

  await assertRejects(
    async () => {
      await generateSummary("[User]: Hello", provider);
    },
    Error,
    "LLM API call failed",
  );
});
