import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { parseSummary } from "../src/summary/parseSummary.ts";

Deno.test("parseSummary - parses standard markdown with read and modified file tags", () => {
  const llmText = `## Goal
Refactor the authentication module.

## Progress
### Done
- [x] Extracted JWT helper

<read-files>
src/auth/index.ts
src/config.ts
</read-files>

<modified-files>
src/auth/jwt.ts
src/auth/session.ts
</modified-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.summaryText, llmText);
  assertEquals(result.details.readFiles, ["src/auth/index.ts", "src/config.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/auth/jwt.ts", "src/auth/session.ts"]);
});

Deno.test("parseSummary - handles empty tags", () => {
  const llmText = `## Summary
Everything is fine.
<read-files>
</read-files>
<modified-files>
</modified-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, []);
  assertEquals(result.details.modifiedFiles, []);
});

Deno.test("parseSummary - handles missing tags gracefully", () => {
  const llmText = `## Goal
Setup project without any files touched.`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, []);
  assertEquals(result.details.modifiedFiles, []);
});

Deno.test("parseSummary - handles only read-files tag present", () => {
  const llmText = `Summary
<read-files>
src/types.ts
</read-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, ["src/types.ts"]);
  assertEquals(result.details.modifiedFiles, []);
});

Deno.test("parseSummary - handles only modified-files tag present", () => {
  const llmText = `Summary
<modified-files>
src/server.ts
</modified-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, []);
  assertEquals(result.details.modifiedFiles, ["src/server.ts"]);
});

Deno.test("parseSummary - handles unclosed tags gracefully without crashing", () => {
  const llmText = `Summary
<read-files>
src/types.ts
No closing tag here`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, []);
});

Deno.test("parseSummary - handles closing tag appearing before opening tag", () => {
  const llmText = `Summary
</read-files>
src/types.ts
<read-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, []);
});

Deno.test("parseSummary - trims whitespace and ignores blank lines inside tags", () => {
  const llmText = `<read-files>

   src/core/cutPoint.ts   

   src/core/serialize.ts

</read-files>
<modified-files>
   src/cli/main.ts   
</modified-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, ["src/core/cutPoint.ts", "src/core/serialize.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/cli/main.ts"]);
});

Deno.test("parseSummary - handles Windows CRLF line endings", () => {
  const llmText = "<read-files>\r\nsrc/win1.ts\r\nsrc/win2.ts\r\n</read-files>\r\n<modified-files>\r\nsrc/win3.ts\r\n</modified-files>";
  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, ["src/win1.ts", "src/win2.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/win3.ts"]);
});

Deno.test("parseSummary - strips markdown bullet points inside file tags", () => {
  const llmText = `<read-files>
- src/file1.ts
* src/file2.ts
• src/file3.ts
</read-files>
<modified-files>
- src/file4.ts
</modified-files>`;

  const result = parseSummary(llmText);
  assertEquals(result.details.readFiles, ["src/file1.ts", "src/file2.ts", "src/file3.ts"]);
  assertEquals(result.details.modifiedFiles, ["src/file4.ts"]);
});

