import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { runCompaction } from "../src/session/compact.ts";
import { SessionLog } from "../src/session/sessionLog.ts";
import { getCurrentTokenCount } from "../src/core/currentTokenCount.ts";
import {
  fixtureNormal,
  fixtureToolResultAdjacent,
  fixtureSplitTurn,
  fixtureFileTracking,
} from "../src/fixtures/fakeConversations.ts";

import { LLMProvider, LLMResponse, Message } from "../src/types.ts";

class MockLLMProvider implements LLMProvider {
  public callCount = 0;
  public lastSystemPrompt = "";
  public lastUserMessage = "";

  constructor(
    private mockSummary: string,
    private shouldFail = false,
    private usage = { inputTokens: 500, outputTokens: 100 },
  ) {}

  call(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    this.callCount++;
    this.lastSystemPrompt = systemPrompt;
    this.lastUserMessage = userMessage;

    if (this.shouldFail) {
      return Promise.reject(new Error("LLM provider unavailable"));
    }

    return Promise.resolve({
      text: this.mockSummary,
      usage: this.usage,
    });
  }
}

Deno.test("runCompaction - end-to-end compaction on fixtureNormal", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureNormal();
  for (const m of messages) {
    sessionLog.addEntry(m);
  }

  const initialTokens = getCurrentTokenCount(sessionLog);
  assertEquals(initialTokens, 1000);
  assertEquals(sessionLog.getAllEntries().length, 13);

  const mockLLMOutput = `## Goal
Initialize Deno project and write cutPoint and serialize modules.

## Progress
### Done
- [x] Created folder structure
- [x] Added types.ts
- [x] Implemented findCutPoint and serializeConversation

<read-files>
src/types.ts
</read-files>

<modified-files>
src/core/cutPoint.ts
src/core/serialize.ts
</modified-files>`;

  const provider = new MockLLMProvider(mockLLMOutput);

  // contextWindow = 1200, reserveTokens = 400 -> threshold = 800
  // 1000 > 800 -> should trigger
  // keepRecentTokens = 400
  const result = await runCompaction(sessionLog, provider, 1200, 400, 400);

  assertEquals(result !== null, true);
  if (!result) return;

  assertEquals(result.type, "compaction");
  assertEquals(typeof result.id, "string");
  assertEquals(result.tokensBefore, 1000);
  assertEquals(result.summary, mockLLMOutput);
  assertEquals(result.details.readFiles, ["src/types.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/core/cutPoint.ts", "src/core/serialize.ts"]);
  assertEquals(result.usage, { inputTokens: 500, outputTokens: 100 });
  assertEquals(result.isSplitTurn, false);

  // Verify SessionLog has 14 entries (13 messages + 1 compaction entry)

  assertEquals(sessionLog.getAllEntries().length, 14);
  assertEquals(sessionLog.getAllEntries()[13], result);

  // Verify token count after compaction is reduced
  const afterTokens = getCurrentTokenCount(sessionLog);
  assertEquals(afterTokens < initialTokens, true);
});

Deno.test("runCompaction - does not trigger when token count is below threshold", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureNormal();
  for (const m of messages) {
    sessionLog.addEntry(m);
  }

  const provider = new MockLLMProvider("Summary");

  // contextWindow = 2000, reserveTokens = 400 -> threshold = 1600
  // Total tokens = 1000 <= 1600 -> should NOT trigger
  const result = await runCompaction(sessionLog, provider, 2000, 400, 400);

  assertEquals(result, null);
  assertEquals(provider.callCount, 0);
  assertEquals(sessionLog.getAllEntries().length, 13);
});

Deno.test("runCompaction - does not trigger when cutPointIndex <= 0", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureNormal();
  for (const m of messages) {
    sessionLog.addEntry(m);
  }

  const provider = new MockLLMProvider("Summary");

  // keepRecentTokens = 2000 (larger than total message tokens 1000)
  // cutPoint returns -1
  const result = await runCompaction(sessionLog, provider, 1200, 400, 2000);

  assertEquals(result, null);
  assertEquals(provider.callCount, 0);
  assertEquals(sessionLog.getAllEntries().length, 13);
});

Deno.test("runCompaction - sequential compactions merge file tracking details and pass previous summary", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureFileTracking();

  // Add first 10 messages (total tokens: 60+40+80+70+50+40+70+60+80+120 = 670)
  for (let i = 0; i < 10; i++) {
    sessionLog.addEntry(messages[i]);
  }

  const firstLLMOutput = `## Goal
Update configuration and logger.

<read-files>
src/config.ts
src/utils/logger.ts
</read-files>

<modified-files>
src/utils/logger.ts
</modified-files>`;

  const provider1 = new MockLLMProvider(firstLLMOutput);

  // Trigger first compaction: threshold = 600 - 100 = 500. Total = 670 > 500.
  const comp1 = await runCompaction(sessionLog, provider1, 600, 100, 200);
  assertEquals(comp1 !== null, true);
  if (!comp1) return;

  assertEquals(comp1.details.readFiles, ["src/config.ts", "src/utils/logger.ts"]);
  assertEquals(comp1.details.modifiedFiles, ["src/utils/logger.ts"]);

  // Now add remaining messages (index 10..20)
  for (let i = 10; i < messages.length; i++) {
    sessionLog.addEntry(messages[i]);
  }

  const secondLLMOutput = `## Goal
Add HTTP server and DB schema.

<read-files>
src/db/schema.ts
</read-files>

<modified-files>
src/config.ts
src/server.ts
</modified-files>`;

  const provider2 = new MockLLMProvider(secondLLMOutput);

  // Trigger second compaction
  const comp2 = await runCompaction(sessionLog, provider2, 600, 100, 200);
  assertEquals(comp2 !== null, true);
  if (!comp2) return;

  // Verify provider2 received the first summary in its user message
  assertEquals(provider2.lastUserMessage.includes("Here is the summary of everything before this point:\n" + firstLLMOutput), true);

  // Verify merged file tracking contains files from BOTH compactions
  assertEquals(comp2.details.readFiles, ["src/config.ts", "src/utils/logger.ts", "src/db/schema.ts"]);
  assertEquals(comp2.details.modifiedFiles, ["src/utils/logger.ts", "src/config.ts", "src/server.ts"]);
});

Deno.test("runCompaction - provider failure leaves session log unmodified", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureNormal();
  for (const m of messages) {
    sessionLog.addEntry(m);
  }

  const failingProvider = new MockLLMProvider("", true);

  await assertRejects(
    async () => {
      await runCompaction(sessionLog, failingProvider, 1200, 400, 400);
    },
    Error,
    "LLM provider unavailable",
  );

  // Ensure no corrupt compaction entry was appended
  assertEquals(sessionLog.getAllEntries().length, 13);
});

Deno.test("runCompaction - 3-round successive compaction cycle", async () => {
  const sessionLog = new SessionLog();

  // Helper to create a message
  const makeMsg = (id: string, tokenCount: number): Message => ({
    type: "message",
    id,
    role: "user",
    content: `User prompt for ${id}`,
    tokenCount,
  });

  const provider = new MockLLMProvider(`## Goal
Cumulative summary
<read-files>
src/index.ts
</read-files>
<modified-files>
src/app.ts
</modified-files>`);

  // Round 1: add 5 messages of 100 tokens (500 tokens)
  for (let i = 1; i <= 5; i++) sessionLog.addEntry(makeMsg(`r1-m${i}`, 100));
  // threshold: 400 - 100 = 300. current = 500. keepRecent = 150 (keeps r1-m4, r1-m5)
  const c1 = await runCompaction(sessionLog, provider, 400, 100, 150);
  assertEquals(c1 !== null, true);

  // Round 2: add 4 messages of 100 tokens (400 tokens)
  for (let i = 1; i <= 4; i++) sessionLog.addEntry(makeMsg(`r2-m${i}`, 100));
  const c2 = await runCompaction(sessionLog, provider, 400, 100, 150);
  assertEquals(c2 !== null, true);

  // Round 3: add 4 messages of 100 tokens (400 tokens)
  for (let i = 1; i <= 4; i++) sessionLog.addEntry(makeMsg(`r3-m${i}`, 100));
  const c3 = await runCompaction(sessionLog, provider, 400, 100, 150);
  assertEquals(c3 !== null, true);

  // Check that 3 compactions exist in sessionLog
  const compactions = sessionLog.getAllEntries().filter(e => e.type === "compaction");
  assertEquals(compactions.length, 3);
});

Deno.test("runCompaction - sets isSplitTurn to true when compacting fixtureSplitTurn", async () => {
  const sessionLog = new SessionLog();
  const messages = fixtureSplitTurn();
  for (const m of messages) {
    sessionLog.addEntry(m);
  }

  const provider = new MockLLMProvider("## Goal\nSplit turn summary\n<read-files></read-files>\n<modified-files></modified-files>");

  // contextWindow = 1400, reserveTokens = 200, keepRecentTokens = 500
  // Turn 0 has 1300 tokens > 500 -> triggers split turn compaction
  const result = await runCompaction(sessionLog, provider, 1400, 200, 500);

  assertEquals(result !== null, true);
  if (!result) return;

  assertEquals(result.type, "compaction");
  assertEquals(result.isSplitTurn, true);
});


