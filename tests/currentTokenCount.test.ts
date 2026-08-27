import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { getCurrentTokenCount } from "../src/core/currentTokenCount.ts";
import { SessionLog } from "../src/session/sessionLog.ts";
import { Message, CompactionEntry } from "../src/types.ts";

function createMessage(id: string, tokenCount: number, role: Message["role"] = "user"): Message {
  return {
    type: "message",
    id,
    role,
    content: "sample content",
    tokenCount,
  };
}

function createCompaction(
  id: string,
  firstKeptEntryId: string,
  summary: string,
  tokensBefore = 1000,
): CompactionEntry {
  return {
    type: "compaction",
    id,
    summary,
    firstKeptEntryId,
    tokensBefore,
    details: { readFiles: [], modifiedFiles: [] },
  };
}

Deno.test("getCurrentTokenCount - empty session log returns 0", () => {
  const log = new SessionLog();
  assertEquals(getCurrentTokenCount(log), 0);
});

Deno.test("getCurrentTokenCount - messages only (no compaction) sums all tokenCounts", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 100));
  log.addEntry(createMessage("m2", 200));
  log.addEntry(createMessage("m3", 150));

  assertEquals(getCurrentTokenCount(log), 450);
});

Deno.test("getCurrentTokenCount - single compaction entry calculates summary tokens + live tail", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 100)); // summarized (excluded)
  log.addEntry(createMessage("m2", 100)); // summarized (excluded)
  log.addEntry(createMessage("m3", 100)); // first kept entry (included)
  log.addEntry(createMessage("m4", 100)); // kept (included)

  // summary string of length 40 -> Math.ceil(40 / 4) = 10 tokens
  const summaryText = "1234567890123456789012345678901234567890"; // 40 chars
  const compaction = createCompaction("c1", "m3", summaryText);
  log.addEntry(compaction);

  // Live tail from m3: m3 (100) + m4 (100) = 200 message tokens
  // Summary tokens = 10
  // Total expected = 210
  assertEquals(getCurrentTokenCount(log), 210);
});

Deno.test("getCurrentTokenCount - summary token estimation uses Math.ceil(length / 4)", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 50));

  // summary of 5 chars -> Math.ceil(5 / 4) = 2 tokens
  const compaction = createCompaction("c1", "m1", "12345");
  log.addEntry(compaction);

  // liveTail: m1 (50) + summary (2) = 52
  assertEquals(getCurrentTokenCount(log), 52);
});

Deno.test("getCurrentTokenCount - multiple compactions uses only the latest compaction", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 100));
  log.addEntry(createMessage("m2", 100));
  log.addEntry(createMessage("m3", 100));
  log.addEntry(createMessage("m4", 100));
  log.addEntry(createMessage("m5", 100));

  // Compaction 1 kept from m3 (summary of 20 chars = 5 tokens)
  const c1 = createCompaction("c1", "m3", "12345678901234567890");
  log.addEntry(c1);

  // Later, Compaction 2 kept from m4 (summary of 40 chars = 10 tokens)
  const c2 = createCompaction("c2", "m4", "1234567890123456789012345678901234567890");
  log.addEntry(c2);

  // Live tail from m4: m4 (100) + m5 (100) = 200 message tokens
  // Summary tokens for c2 = 10
  // Total expected = 210 (c1 should be ignored)
  assertEquals(getCurrentTokenCount(log), 210);
});

Deno.test("getCurrentTokenCount - firstKeptEntryId pointing to non-existent entry throws Error", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 100));
  log.addEntry(createCompaction("c1", "invalid-id", "summary"));

  assertThrows(
    () => {
      getCurrentTokenCount(log);
    },
    Error,
    'SessionLog: no entry found with id "invalid-id"',
  );
});

Deno.test("getCurrentTokenCount - new messages added after compaction are included in live tail", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1", 100)); // summarized
  log.addEntry(createMessage("m2", 100)); // first kept
  log.addEntry(createCompaction("c1", "m2", "12345678")); // 8 chars = 2 tokens

  // New turn happens after compaction:
  log.addEntry(createMessage("m3", 150));
  log.addEntry(createMessage("m4", 200));

  // Live tail starting at m2 includes: m2(100), c1(compaction=ignored), m3(150), m4(200) -> 450 tokens
  // Summary tokens = 2
  // Total = 452
  assertEquals(getCurrentTokenCount(log), 452);
});

