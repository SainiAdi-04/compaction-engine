import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { mergeDetails } from "../src/core/mergeDetails.ts";
import { CompactionDetails } from "../src/types.ts";

Deno.test("mergeDetails - prevCompaction undefined returns newCompaction details", () => {
  const newCompaction: CompactionDetails = {
    readFiles: ["src/a.ts", "src/b.ts"],
    modifiedFiles: ["src/c.ts"],
  };
  const result = mergeDetails(undefined, newCompaction);
  assertEquals(result, {
    readFiles: ["src/a.ts", "src/b.ts"],
    modifiedFiles: ["src/c.ts"],
  });
});

Deno.test("mergeDetails - both empty arrays returns empty arrays", () => {
  const prev: CompactionDetails = { readFiles: [], modifiedFiles: [] };
  const next: CompactionDetails = { readFiles: [], modifiedFiles: [] };
  const result = mergeDetails(prev, next);
  assertEquals(result, { readFiles: [], modifiedFiles: [] });
});

Deno.test("mergeDetails - disjoint file lists are combined", () => {
  const prev: CompactionDetails = {
    readFiles: ["src/a.ts"],
    modifiedFiles: ["src/b.ts"],
  };
  const next: CompactionDetails = {
    readFiles: ["src/c.ts"],
    modifiedFiles: ["src/d.ts"],
  };
  const result = mergeDetails(prev, next);
  assertEquals(result.readFiles, ["src/a.ts", "src/c.ts"]);
  assertEquals(result.modifiedFiles, ["src/b.ts", "src/d.ts"]);
});

Deno.test("mergeDetails - duplicate files across prev and next are deduplicated", () => {
  const prev: CompactionDetails = {
    readFiles: ["src/shared.ts", "src/read1.ts"],
    modifiedFiles: ["src/mod1.ts", "src/shared_mod.ts"],
  };
  const next: CompactionDetails = {
    readFiles: ["src/read2.ts", "src/shared.ts"],
    modifiedFiles: ["src/shared_mod.ts", "src/mod2.ts"],
  };
  const result = mergeDetails(prev, next);
  assertEquals(result.readFiles, ["src/shared.ts", "src/read1.ts", "src/read2.ts"]);
  assertEquals(result.modifiedFiles, ["src/mod1.ts", "src/shared_mod.ts", "src/mod2.ts"]);
});

Deno.test("mergeDetails - duplicate files within nextCompaction itself are deduplicated", () => {
  const next: CompactionDetails = {
    readFiles: ["src/a.ts", "src/a.ts", "src/b.ts"],
    modifiedFiles: ["src/c.ts", "src/c.ts"],
  };
  const result = mergeDetails(undefined, next);
  assertEquals(result.readFiles, ["src/a.ts", "src/b.ts"]);
  assertEquals(result.modifiedFiles, ["src/c.ts"]);
});

Deno.test("mergeDetails - multi-step sequential compaction accumulates all files", () => {
  let accumulated: CompactionDetails | undefined = undefined;

  const step1: CompactionDetails = {
    readFiles: ["file1.ts"],
    modifiedFiles: ["file2.ts"],
  };
  accumulated = mergeDetails(accumulated, step1);

  const step2: CompactionDetails = {
    readFiles: ["file3.ts"],
    modifiedFiles: ["file2.ts", "file4.ts"],
  };
  accumulated = mergeDetails(accumulated, step2);

  const step3: CompactionDetails = {
    readFiles: ["file1.ts", "file5.ts"],
    modifiedFiles: ["file6.ts"],
  };
  accumulated = mergeDetails(accumulated, step3);

  assertEquals(accumulated.readFiles, ["file1.ts", "file3.ts", "file5.ts"]);
  assertEquals(accumulated.modifiedFiles, ["file2.ts", "file4.ts", "file6.ts"]);
});

Deno.test("mergeDetails - file in both readFiles and modifiedFiles is preserved in both", () => {
  const prev: CompactionDetails = {
    readFiles: ["src/both.ts"],
    modifiedFiles: ["src/both.ts"],
  };
  const next: CompactionDetails = {
    readFiles: ["src/other.ts"],
    modifiedFiles: [],
  };
  const result = mergeDetails(prev, next);
  assertEquals(result.readFiles.includes("src/both.ts"), true);
  assertEquals(result.modifiedFiles.includes("src/both.ts"), true);
});
