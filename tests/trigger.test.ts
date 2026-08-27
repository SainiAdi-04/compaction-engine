import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { triggerCompaction } from "../src/core/trigger.ts";

Deno.test("triggerCompaction - default parameters below threshold returns false", () => {
  // Defaults: contextWindow = 20000, reserveToken = 2000 -> threshold = 18000
  assertEquals(triggerCompaction(10000), false);
  assertEquals(triggerCompaction(17999), false);
});

Deno.test("triggerCompaction - default parameters exactly at threshold returns false", () => {
  // threshold = 20000 - 2000 = 18000
  assertEquals(triggerCompaction(18000), false);
});

Deno.test("triggerCompaction - default parameters above threshold returns true", () => {
  // threshold = 18000
  assertEquals(triggerCompaction(18001), true);
  assertEquals(triggerCompaction(20000), true);
  assertEquals(triggerCompaction(25000), true);
});

Deno.test("triggerCompaction - custom parameters below threshold returns false", () => {
  // contextWindow = 1200, reserveToken = 400 -> threshold = 800
  assertEquals(triggerCompaction(799, 1200, 400), false);
  assertEquals(triggerCompaction(0, 1200, 400), false);
});

Deno.test("triggerCompaction - custom parameters exactly at threshold returns false", () => {
  assertEquals(triggerCompaction(800, 1200, 400), false);
});

Deno.test("triggerCompaction - custom parameters above threshold returns true", () => {
  assertEquals(triggerCompaction(801, 1200, 400), true);
  assertEquals(triggerCompaction(1000, 1200, 400), true);
  assertEquals(triggerCompaction(1500, 1200, 400), true);
});

Deno.test("triggerCompaction - zero current tokens returns false when threshold is positive", () => {
  assertEquals(triggerCompaction(0, 1000, 200), false);
});

Deno.test("triggerCompaction - reserveTokens equals contextWindow (threshold = 0)", () => {
  // contextWindow = 1000, reserveToken = 1000 -> threshold = 0
  assertEquals(triggerCompaction(0, 1000, 1000), false);
  assertEquals(triggerCompaction(1, 1000, 1000), true);
});

Deno.test("triggerCompaction - reserveTokens greater than contextWindow (negative threshold)", () => {
  // contextWindow = 500, reserveToken = 1000 -> threshold = -500
  // Any non-negative token count will be > -500
  assertEquals(triggerCompaction(0, 500, 1000), true);
  assertEquals(triggerCompaction(100, 500, 1000), true);
});

Deno.test("triggerCompaction - negative current token count", () => {
  assertEquals(triggerCompaction(-10, 1000, 200), false);
});
