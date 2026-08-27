import { Message } from "../types.ts";

function makeMessage(
  id: string,
  role: Message["role"],
  content: string,
  tokenCount: number,
  toolCallId?: string,
): Message {
  const message: Message = {
    type: "message",
    id: id,
    role: role,
    content: content,
    tokenCount: tokenCount,
  };

  if (toolCallId !== undefined) {
    message.toolCallId = toolCallId;
  }

  return message;
}

export function fixtureNormal(): Message[] {
  const messages: Message[] = [];

  // --- index 0: user ---
  messages.push(
    makeMessage(
      "msg-normal-0",
      "user",
      "Hey, I want to set up a new Deno project. Can you help me initialise the folder structure?",
      80,
    ),
  );

  // --- index 1: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-1",
      "assistant",
      "Sure! I will create the following directories for you: src/, tests/, and cli/. I will also add a deno.json with sensible defaults and a README.md placeholder.",
      120,
    ),
  );

  // --- index 2: user ---
  messages.push(
    makeMessage(
      "msg-normal-2",
      "user",
      "Great, now add a types.ts file under src/ with a Message interface that has id, role, content, and tokenCount fields.",
      100,
    ),
  );

  // --- index 3: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-3",
      "assistant",
      "Done. I created src/types.ts with the Message interface. Each field is typed as you described.",
      80,
    ),
  );

  // --- index 4: user ---
  messages.push(
    makeMessage(
      "msg-normal-4",
      "user",
      "Now write a function called findCutPoint in src/core/cutPoint.ts. It should walk backward through the messages array accumulating token counts.",
      100,
    ),
  );

  // --- index 5: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-5",
      "assistant",
      "I have implemented findCutPoint(). It iterates from the end of the array, summing tokenCount until the total exceeds keepRecentTokens, then returns that index.",
      80,
    ),
  );

  // --- index 6: user ---
  messages.push(
    makeMessage(
      "msg-normal-6",
      "user",
      "Can you also add a serialize function in src/core/serialize.ts?",
      60,
    ),
  );

  // --- index 7: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-7",
      "assistant",
      "Added serializeConversation(). It joins message contents with role headers.",
      50,
    ),
  );

  // --- index 8: tool_result (safely inside the kept window) ---
  messages.push(
    makeMessage(
      "msg-normal-8",
      "tool_result",
      '{"status":"ok","output":"serialize.ts written successfully"}',
      30,
      "tool-call-normal-1",
    ),
  );

  // --- index 9: user ---
  messages.push(
    makeMessage(
      "msg-normal-9",
      "user",
      "Excellent. Now write unit tests for findCutPoint in tests/cutPoint.test.ts. Cover at least three cases: empty array, array shorter than budget, and a normal cut.",
      100,
    ),
  );

  // --- index 10: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-10",
      "assistant",
      "I have written three test cases in cutPoint.test.ts using Deno.test(). All three scenarios are covered: empty input returns -1, short input returns 0, and a 10-message array returns the expected cut index.",
      100,
    ),
  );

  // --- index 11: user ---
  messages.push(
    makeMessage(
      "msg-normal-11",
      "user",
      "Run the tests and show me the output.",
      50,
    ),
  );

  // --- index 12: assistant ---
  messages.push(
    makeMessage(
      "msg-normal-12",
      "assistant",
      "All three tests passed. Here is the output:\n  cutPoint.test.ts … ok (3 tests)\n  test result: ok. 3 passed.",
      50,
    ),
  );

  return messages;
}

export function fixtureToolResultAdjacent(): Message[] {
  const messages: Message[] = [];

  // --- index 0: user ---
  messages.push(
    makeMessage(
      "msg-tool-0",
      "user",
      "I need to refactor the database module. Let us start by listing all the files in src/db/.",
      120,
    ),
  );

  // --- index 1: assistant ---
  messages.push(
    makeMessage(
      "msg-tool-1",
      "assistant",
      "Here are the files in src/db/: connection.ts, queries.ts, migrations.ts, and schema.ts. The connection module handles pooling, queries has all the prepared statements, migrations runs the version upgrades, and schema defines the table types.",
      150,
    ),
  );

  // --- index 2: user ---
  messages.push(
    makeMessage(
      "msg-tool-2",
      "user",
      "OK. Please read the contents of src/db/connection.ts so we can see if the pool config is correct. I suspect the max connections value is too low for production.",
      130,
    ),
  );

  // --- index 3: assistant (this is the tool-calling message) ---
  messages.push(
    makeMessage(
      "msg-tool-3",
      "assistant",
      'I will read that file for you now. Calling tool: read_file(path="src/db/connection.ts")',
      100,
    ),
  );

  // --- index 4: tool_result (the naive cut would land here — INVALID) ---
  messages.push(
    makeMessage(
      "msg-tool-4",
      "tool_result",
      '{"status":"ok","content":"import { Pool } from \\"pg\\";\\nconst pool = new Pool({ max: 5 });\\nexport default pool;"}',
      50,
      "tool-call-adj-1",
    ),
  );

  // --- index 5: user ---
  messages.push(
    makeMessage(
      "msg-tool-5",
      "user",
      "Yep, max is only 5. Change it to 20 and also add an idleTimeoutMillis of 30000. Make sure to keep the existing import.",
      120,
    ),
  );

  // --- index 6: assistant ---
  messages.push(
    makeMessage(
      "msg-tool-6",
      "assistant",
      "Done. I updated src/db/connection.ts — max is now 20 and I added idleTimeoutMillis: 30000 to the Pool constructor options. The import statement is unchanged.",
      130,
    ),
  );

  // --- index 7: user ---
  messages.push(
    makeMessage(
      "msg-tool-7",
      "user",
      "Perfect. Now run the integration tests to make sure nothing broke.",
      100,
    ),
  );

  // --- index 8: assistant ---
  messages.push(
    makeMessage(
      "msg-tool-8",
      "assistant",
      "All 12 integration tests passed. No regressions detected. The connection pool now initialises with max=20 and the idle timeout is respected in the teardown test.",
      100,
    ),
  );

  return messages;
}

export function fixtureSplitTurn(): Message[] {
  const messages: Message[] = [];

  // --- index 0: user (turn-opening message) ---
  messages.push(
    makeMessage(
      "msg-split-0",
      "user",
      "I need you to refactor the entire authentication module. Break it into separate files for OAuth, JWT, and session management. Read each existing file first, then rewrite them one by one.",
      150,
    ),
  );

  // --- index 1: assistant (first action in the long chain) ---
  messages.push(
    makeMessage(
      "msg-split-1",
      "assistant",
      'Let me start by reading the current auth module. Calling tool: read_file(path="src/auth/index.ts"). This file currently contains all three concerns mixed together: the OAuth client setup, the JWT signing/verification helpers, and the session middleware. I will split them out step by step.',
      200,
    ),
  );

  // --- index 2: tool_result ---
  messages.push(
    makeMessage(
      "msg-split-2",
      "tool_result",
      '{"status":"ok","content":"// src/auth/index.ts\\nimport { OAuth2Client } from \\"google-auth\\";\\nimport jwt from \\"jsonwebtoken\\";\\n// ... 200 lines of mixed auth code ..."}',
      50,
      "tool-call-split-1",
    ),
  );

  // --- index 3: assistant (second action) ---
  messages.push(
    makeMessage(
      "msg-split-3",
      "assistant",
      'I have read the file. Now I will create src/auth/oauth.ts with just the OAuth2Client setup and the callback handler. I am extracting the googleClient initialisation, the redirectUrl builder, and the handleCallback function into this new file. Calling tool: write_file(path="src/auth/oauth.ts")',
      200,
    ),
  );

  // --- index 4: tool_result ---
  messages.push(
    makeMessage(
      "msg-split-4",
      "tool_result",
      '{"status":"ok","output":"src/auth/oauth.ts created successfully (45 lines)"}',
      50,
      "tool-call-split-2",
    ),
  );

  // --- index 5: assistant (third action) ---
  messages.push(
    makeMessage(
      "msg-split-5",
      "assistant",
      'OAuth module is done. Now creating src/auth/jwt.ts with the signing and verification logic. I am moving the signToken() and verifyToken() functions, along with the secret loading from environment variables. Calling tool: write_file(path="src/auth/jwt.ts")',
      200,
    ),
  );

  // --- index 6: tool_result ---
  messages.push(
    makeMessage(
      "msg-split-6",
      "tool_result",
      '{"status":"ok","output":"src/auth/jwt.ts created successfully (38 lines)"}',
      50,
      "tool-call-split-3",
    ),
  );

  // --- index 7: assistant (fourth action) ---
  messages.push(
    makeMessage(
      "msg-split-7",
      "assistant",
      'JWT module is done. Finally, creating src/auth/session.ts with the session middleware. This includes the createSession(), destroySession(), and the Express middleware that checks for a valid session cookie. Calling tool: write_file(path="src/auth/session.ts")',
      200,
    ),
  );

  // --- index 8: tool_result ---
  messages.push(
    makeMessage(
      "msg-split-8",
      "tool_result",
      '{"status":"ok","output":"src/auth/session.ts created successfully (52 lines)"}',
      50,
      "tool-call-split-4",
    ),
  );

  // --- index 9: assistant (wrapping up the turn) ---
  messages.push(
    makeMessage(
      "msg-split-9",
      "assistant",
      "All three modules are now created: oauth.ts, jwt.ts, and session.ts. I have also updated the barrel export in src/auth/index.ts to re-export from each new file. The original monolithic code has been fully replaced.",
      150,
    ),
  );

  // --- index 10: user (next turn starts) ---
  messages.push(
    makeMessage(
      "msg-split-10",
      "user",
      "Looks good. Run the auth tests now.",
      50,
    ),
  );

  return messages;
}

export function fixtureFileTracking(): Message[] {
  const messages: Message[] = [];

  // --- index 0: user ---
  messages.push(
    makeMessage(
      "msg-files-0",
      "user",
      "Can you read src/config.ts and tell me what environment variables it expects?",
      60,
    ),
  );

  // --- index 1: assistant (reads a file) ---
  messages.push(
    makeMessage(
      "msg-files-1",
      "assistant",
      'Sure, let me read that file. Calling tool: read_file(path="src/config.ts")',
      40,
    ),
  );

  // --- index 2: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-2",
      "tool_result",
      '{"status":"ok","content":"export const config = {\\n  port: Number(Deno.env.get(\\"PORT\\") ?? 3000),\\n  dbUrl: Deno.env.get(\\"DATABASE_URL\\") ?? \\"\\",\\n  logLevel: Deno.env.get(\\"LOG_LEVEL\\") ?? \\"info\\"\\n};"}',
      80,
      "tool-call-files-1",
    ),
  );

  // --- index 3: assistant (reports findings) ---
  messages.push(
    makeMessage(
      "msg-files-3",
      "assistant",
      'The config module expects three environment variables: PORT (defaults to 3000), DATABASE_URL (defaults to empty string), and LOG_LEVEL (defaults to "info").',
      70,
    ),
  );

  // --- index 4: user ---
  messages.push(
    makeMessage(
      "msg-files-4",
      "user",
      "Good. Now read src/utils/logger.ts — I want to see if it respects the LOG_LEVEL from config.",
      50,
    ),
  );

  // --- index 5: assistant (reads another file) ---
  messages.push(
    makeMessage(
      "msg-files-5",
      "assistant",
      'Reading that file now. Calling tool: read_file(path="src/utils/logger.ts")',
      40,
    ),
  );

  // --- index 6: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-6",
      "tool_result",
      '{"status":"ok","content":"import { config } from \\"../config.ts\\";\\nconst LEVEL = config.logLevel;\\nexport function log(msg: string) { if (LEVEL !== \\"silent\\") console.log(msg); }"}',
      70,
      "tool-call-files-2",
    ),
  );

  // --- index 7: assistant ---
  messages.push(
    makeMessage(
      "msg-files-7",
      "assistant",
      'Yes, the logger imports config and uses logLevel. However it only checks for "silent" — it does not support granular levels like "debug", "warn", or "error".',
      60,
    ),
  );

  // --- index 8: user ---
  messages.push(
    makeMessage(
      "msg-files-8",
      "user",
      "Update the logger to support debug, info, warn, and error levels. Also update config.ts to validate that LOG_LEVEL is one of those values.",
      80,
    ),
  );

  // --- index 9: assistant (modifies a file) ---
  messages.push(
    makeMessage(
      "msg-files-9",
      "assistant",
      'I will update the logger first. Calling tool: edit_file(path="src/utils/logger.ts", content="import { config } from \\"../config.ts\\";\\ntype LogLevel = \\"debug\\" | \\"info\\" | \\"warn\\" | \\"error\\";\\nconst LEVELS: LogLevel[] = [\\"debug\\", \\"info\\", \\"warn\\", \\"error\\"];\\nconst currentIdx = LEVELS.indexOf(config.logLevel as LogLevel);\\nexport function log(level: LogLevel, msg: string) {\\n  if (LEVELS.indexOf(level) >= currentIdx) console.log(`[${level}] ${msg}`);\\n}")',
      120,
    ),
  );

  // --- index 10: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-10",
      "tool_result",
      '{"status":"ok","output":"src/utils/logger.ts updated successfully"}',
      30,
      "tool-call-files-3",
    ),
  );

  // --- index 11: assistant (modifies another file) ---
  messages.push(
    makeMessage(
      "msg-files-11",
      "assistant",
      'Now updating the config to validate LOG_LEVEL. Calling tool: edit_file(path="src/config.ts", content="const VALID_LEVELS = [\\"debug\\", \\"info\\", \\"warn\\", \\"error\\"];\\nconst rawLevel = Deno.env.get(\\"LOG_LEVEL\\") ?? \\"info\\";\\nif (!VALID_LEVELS.includes(rawLevel)) throw new Error(`Invalid LOG_LEVEL: ${rawLevel}`);\\nexport const config = {\\n  port: Number(Deno.env.get(\\"PORT\\") ?? 3000),\\n  dbUrl: Deno.env.get(\\"DATABASE_URL\\") ?? \\"\\",\\n  logLevel: rawLevel\\n};")',
      110,
    ),
  );

  // --- index 12: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-12",
      "tool_result",
      '{"status":"ok","output":"src/config.ts updated successfully"}',
      30,
      "tool-call-files-4",
    ),
  );

  // --- index 13: user ---
  messages.push(
    makeMessage(
      "msg-files-13",
      "user",
      "Also read src/db/schema.ts — I need to check if there is a users table defined there before we add session support.",
      60,
    ),
  );

  // --- index 14: assistant (reads a third file) ---
  messages.push(
    makeMessage(
      "msg-files-14",
      "assistant",
      'Let me check. Calling tool: read_file(path="src/db/schema.ts")',
      40,
    ),
  );

  // --- index 15: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-15",
      "tool_result",
      '{"status":"ok","content":"export interface User { id: string; email: string; createdAt: Date; }\\nexport interface Post { id: string; authorId: string; title: string; body: string; }"}',
      70,
      "tool-call-files-5",
    ),
  );

  // --- index 16: assistant ---
  messages.push(
    makeMessage(
      "msg-files-16",
      "assistant",
      "There is a User interface with id, email, and createdAt fields. There is also a Post interface. We can add a Session interface here when we are ready.",
      60,
    ),
  );

  // --- index 17: user ---
  messages.push(
    makeMessage(
      "msg-files-17",
      "user",
      "Great. Finally, create a new file src/server.ts with a basic HTTP server that imports config and logger.",
      70,
    ),
  );

  // --- index 18: assistant (creates a new file) ---
  messages.push(
    makeMessage(
      "msg-files-18",
      "assistant",
      'Creating the server file now. Calling tool: write_file(path="src/server.ts", content="import { config } from \\"./config.ts\\";\\nimport { log } from \\"./utils/logger.ts\\";\\nDeno.serve({ port: config.port }, (_req) => {\\n  log(\\"info\\", `Request received`);\\n  return new Response(\\"OK\\");\\n});\\nlog(\\"info\\", `Server running on port ${config.port}`);")',
      100,
    ),
  );

  // --- index 19: tool_result ---
  messages.push(
    makeMessage(
      "msg-files-19",
      "tool_result",
      '{"status":"ok","output":"src/server.ts created successfully (7 lines)"}',
      30,
      "tool-call-files-6",
    ),
  );

  // --- index 20: assistant ---
  messages.push(
    makeMessage(
      "msg-files-20",
      "assistant",
      "Done. src/server.ts is created. It imports config for the port and logger for request logging. You can start it with `deno run --allow-net --allow-env src/server.ts`.",
      80,
    ),
  );

  return messages;
}
