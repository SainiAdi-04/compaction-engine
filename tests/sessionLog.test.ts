import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { SessionLog } from "../src/session/sessionLog.ts";
import { Message, CompactionEntry } from "../src/types.ts";

function createMessage(id: string, content = "text", tokenCount = 10): Message {
  return {
    type: "message",
    id,
    role: "user",
    content,
    tokenCount,
  };
}

function createCompaction(id: string, firstKeptEntryId: string): CompactionEntry {
  return {
    type: "compaction",
    id,
    summary: "Summary text",
    firstKeptEntryId,
    tokensBefore: 500,
    details: { readFiles: [], modifiedFiles: [] },
  };
}

Deno.test("SessionLog - initializes empty", () => {
  const log = new SessionLog();
  assertEquals(log.getAllEntries(), []);
  assertEquals(log.getAllEntries().length, 0);
});

Deno.test("SessionLog - addEntry adds messages and compactions", () => {
  const log = new SessionLog();
  const m1 = createMessage("m1");
  const c1 = createCompaction("c1", "m1");

  log.addEntry(m1);
  log.addEntry(c1);

  const entries = log.getAllEntries();
  assertEquals(entries.length, 2);
  assertEquals(entries[0], m1);
  assertEquals(entries[1], c1);
});

Deno.test("SessionLog - getEntriesfromId returns slice from found id to end", () => {
  const log = new SessionLog();
  const m1 = createMessage("m1");
  const m2 = createMessage("m2");
  const m3 = createMessage("m3");
  const m4 = createMessage("m4");

  log.addEntry(m1);
  log.addEntry(m2);
  log.addEntry(m3);
  log.addEntry(m4);

  const slice = log.getEntriesfromId("m3");
  assertEquals(slice.length, 2);
  assertEquals(slice[0].id, "m3");
  assertEquals(slice[1].id, "m4");
});

Deno.test("SessionLog - getEntriesfromId on first entry returns all entries", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1"));
  log.addEntry(createMessage("m2"));

  const slice = log.getEntriesfromId("m1");
  assertEquals(slice.length, 2);
  assertEquals(slice[0].id, "m1");
});

Deno.test("SessionLog - getEntriesfromId on last entry returns single item array", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1"));
  log.addEntry(createMessage("m2"));

  const slice = log.getEntriesfromId("m2");
  assertEquals(slice.length, 1);
  assertEquals(slice[0].id, "m2");
});

Deno.test("SessionLog - getEntriesfromId throws when id is not found", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1"));

  assertThrows(
    () => {
      log.getEntriesfromId("non-existent-id");
    },
    Error,
    'SessionLog: no entry found with id "non-existent-id"',
  );
});

Deno.test("SessionLog - getEntriesfromId throws on empty log", () => {
  const log = new SessionLog();
  assertThrows(
    () => {
      log.getEntriesfromId("any-id");
    },
    Error,
    'SessionLog: no entry found with id "any-id"',
  );
});

Deno.test("SessionLog - handles 100+ entries sequentially", () => {
  const log = new SessionLog();
  for (let i = 0; i < 150; i++) {
    log.addEntry(createMessage(`m-${i}`, `content ${i}`, 10));
  }
  assertEquals(log.getAllEntries().length, 150);
  const tail = log.getEntriesfromId("m-100");
  assertEquals(tail.length, 50);
  assertEquals(tail[0].id, "m-100");
  assertEquals(tail[49].id, "m-149");
});

Deno.test("SessionLog - getAllEntries returns shallow copy protecting internal state", () => {
  const log = new SessionLog();
  log.addEntry(createMessage("m1"));

  const entries = log.getAllEntries();
  entries.push(createMessage("m2_mutated"));

  // Because SessionLog returns a shallow copy [...this.entries], external push does not alter internal state
  assertEquals(entries.length, 2);
  assertEquals(log.getAllEntries().length, 1);
});


