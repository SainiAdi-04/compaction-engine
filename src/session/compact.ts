import { SessionEntry, Message, CompactionEntry, LLMProvider } from "../types.ts";
import { SessionLog } from "./sessionLog.ts";
import { triggerCompaction } from "../core/trigger.ts";
import { findCutPoint } from "../core/cutPoint.ts";
import { serializeConversation } from "../core/serialize.ts";
import { generateSummary } from "../summary/generateSummary.ts";
import { mergeDetails } from "../core/mergeDetails.ts";
import { getCurrentTokenCount } from "../core/currentTokenCount.ts";

function findLastCompactionEntry(entries: SessionEntry[]): CompactionEntry | undefined {
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === "compaction") {
            return entry;
        }
    }
    return undefined;
}

export async function runCompaction(
    sessionLog: SessionLog,
    provider: LLMProvider,
    contextWindow: number,
    reserveTokens: number,
    keepRecentTokens: number
): Promise<CompactionEntry | null> {

    
    const allEntries = sessionLog.getAllEntries();
    const previousCompaction = findLastCompactionEntry(allEntries);

    
    const currentTokenCount = getCurrentTokenCount(sessionLog);
    const shouldCompact = triggerCompaction(currentTokenCount, contextWindow, reserveTokens);

    if (!shouldCompact) {
        return null;
    }

    
    const liveEntries = previousCompaction
        ? sessionLog.getEntriesfromId(previousCompaction.firstKeptEntryId)
        : allEntries;

    const liveMessages: Message[] = liveEntries.filter(
        (entry): entry is Message => entry.type === "message"
    );

    
    const { cutPointIndex, isSplitTurn } = findCutPoint(liveMessages, keepRecentTokens);

    if (cutPointIndex <= 0) {
        return null;
    }

    const messagesToSummarize = liveMessages.slice(0, cutPointIndex);
    const newFirstKeptEntryId = liveMessages[cutPointIndex].id;

   
    const serialized = serializeConversation(messagesToSummarize);

    const previousSummaryText = previousCompaction?.summary;
    const { summaryText, details, usage } = await generateSummary(
        serialized,
        provider,
        previousSummaryText
    );

    
    const mergedDetails = mergeDetails(previousCompaction?.details, details);

    const newEntry: CompactionEntry = {
        type: "compaction",
        id: crypto.randomUUID(),
        summary: summaryText,
        firstKeptEntryId: newFirstKeptEntryId,
        tokensBefore: currentTokenCount,
        details: mergedDetails,
        usage: usage,
        isSplitTurn: isSplitTurn,
    };


    sessionLog.addEntry(newEntry);

    return newEntry;
}