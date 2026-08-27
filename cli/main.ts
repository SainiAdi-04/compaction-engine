import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { Message, SessionEntry, CompactionEntry } from "../src/types.ts";
import { GeminiProvider } from "../src/llm/client.ts";
import { SessionLog } from "../src/session/sessionLog.ts";
import { runCompaction } from "../src/session/compact.ts";
import { getCurrentTokenCount } from "../src/core/currentTokenCount.ts";
import { fixtureNormal, fixtureToolResultAdjacent, fixtureSplitTurn, fixtureFileTracking } from "../src/fixtures/fakeConversations.ts";

const envVars = await load();

const apiKey: string | undefined = Deno.env.get("GEMINI_API_KEY") || envVars["GEMINI_API_KEY"];

if (apiKey === undefined || apiKey === "") {
    console.error("ERROR: GEMINI_API_KEY is not set.");
    console.error("Please set it in your environment or in a .env file at the project root.");
    Deno.exit(1);
}

console.log("✓ GEMINI_API_KEY loaded successfully.");
console.log("");


const modelName = "gemini-2.5-flash";
const provider = new GeminiProvider(apiKey, modelName);

console.log("✓ GeminiProvider created.");
console.log("  Model: " + modelName);
console.log("");

const chosenFixture = { name: "fixtureFileTracking", messages: fixtureFileTracking() };

console.log("✓ Fixture loaded: " + chosenFixture.name);
console.log("  Message count: " + String(chosenFixture.messages.length));
console.log("");

const sessionLog = new SessionLog();


for (let i = 0; i < chosenFixture.messages.length; i = i + 1) {
    const message: Message = chosenFixture.messages[i];
    sessionLog.addEntry(message);
}

console.log("✓ SessionLog populated.");
console.log("");


const allEntriesBefore: SessionEntry[] = sessionLog.getAllEntries();
const entryCountBefore: number = allEntriesBefore.length;
const tokenCountBefore: number = getCurrentTokenCount(sessionLog);

console.log("========================================");
console.log("  BEFORE COMPACTION");
console.log("========================================");
console.log("  Total entries:  " + String(entryCountBefore));
console.log("  Total tokens:   " + String(tokenCountBefore));
console.log("========================================");
console.log("");



const contextWindow = 1200;
const reserveTokens = 400;
const keepRecentTokens = 400;

console.log("Running compaction with:");
console.log("  contextWindow:    " + String(contextWindow));
console.log("  reserveTokens:    " + String(reserveTokens));
console.log("  keepRecentTokens: " + String(keepRecentTokens));
console.log("  trigger threshold (contextWindow - reserveTokens): " + String(contextWindow - reserveTokens));
console.log("");

let compactionResult: CompactionEntry | null;

try {
    compactionResult = await runCompaction(
        sessionLog,
        provider,
        contextWindow,
        reserveTokens,
        keepRecentTokens,
    );
} catch (error: unknown) {
    if (error instanceof Error) {
        console.error("Compaction failed: " + error.message);
    } else {
        console.error("Compaction failed: " + String(error));
    }
    Deno.exit(1);
}




if (compactionResult === null) {
    console.log("Result: No compaction needed.");
    console.log("  The current token count did not exceed the threshold,");
    console.log("  or there was no valid cut point.");
} else {
    console.log("========================================");
    console.log("  COMPACTION RESULT");
    console.log("========================================");

    console.log("");
    console.log("  Summary text:");
    console.log("  ─────────────────────────────────────");


    const summaryLines: string[] = compactionResult.summary.split("\n");
    for (let i = 0; i < summaryLines.length; i = i + 1) {
        console.log("    " + summaryLines[i]);
    }

    console.log("  ─────────────────────────────────────");
    console.log("");

    console.log("  firstKeptEntryId: " + compactionResult.firstKeptEntryId);
    console.log("  tokensBefore:     " + String(compactionResult.tokensBefore));
    console.log("  isSplitTurn:      " + String(compactionResult.isSplitTurn ?? false));
    console.log("");

    console.log("  Details:");
    console.log("    Read files:");
    if (compactionResult.details.readFiles.length === 0) {
        console.log("      (none)");
    } else {
        for (let i = 0; i < compactionResult.details.readFiles.length; i = i + 1) {
            console.log("      - " + compactionResult.details.readFiles[i]);
        }
    }

    console.log("    Modified files:");
    if (compactionResult.details.modifiedFiles.length === 0) {
        console.log("      (none)");
    } else {
        for (let i = 0; i < compactionResult.details.modifiedFiles.length; i = i + 1) {
            console.log("      - " + compactionResult.details.modifiedFiles[i]);
        }
    }

    if (compactionResult.usage !== undefined) {
        console.log("");
        console.log("  LLM Usage:");
        console.log("    Input tokens:  " + String(compactionResult.usage.inputTokens));
        console.log("    Output tokens: " + String(compactionResult.usage.outputTokens));
    }

    console.log("========================================");
}

console.log("");


const allEntriesAfter: SessionEntry[] = sessionLog.getAllEntries();
const entryCountAfter: number = allEntriesAfter.length;
const tokenCountAfter: number = getCurrentTokenCount(sessionLog);

console.log("========================================");
console.log("  AFTER COMPACTION");
console.log("========================================");
console.log("  Total entries:  " + String(entryCountAfter));
console.log("  Total tokens:   " + String(tokenCountAfter));
console.log("========================================");
console.log("");


if (compactionResult !== null) {
    const entriesDiff: number = entryCountAfter - entryCountBefore;
    const tokensDiff: number = tokenCountAfter - tokenCountBefore;

    console.log("  Change in entries: " + (entriesDiff >= 0 ? "+" : "") + String(entriesDiff));
    console.log("  Change in tokens:  " + (tokensDiff >= 0 ? "+" : "") + String(tokensDiff));
    console.log("  (The entry count went up by 1 because the compaction entry was appended.)");
    console.log("  (The token count changed because the summary replaces the summarised messages");
    console.log("   in the effective context window calculation.)");
}

console.log("");
console.log("Done.");
