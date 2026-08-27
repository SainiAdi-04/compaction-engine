import { SessionEntry, CompactionEntry } from "../types.ts";
import { SessionLog } from "../session/sessionLog.ts";

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function findLastCompactionEntry(entries: SessionEntry[]): CompactionEntry | undefined {
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === "compaction") {
            return entry;
        }
    }
    return undefined;
}

export function getCurrentTokenCount(sessionLog: SessionLog): number {
    const allEntries = sessionLog.getAllEntries();
    const lastCompaction = findLastCompactionEntry(allEntries);

    if (!lastCompaction) {
        return allEntries.reduce((sum, entry) => {
            if (entry.type === "message") {
                return sum + entry.tokenCount;
            }
            return sum;
        }, 0);
    }

    const liveTail = sessionLog.getEntriesfromId(lastCompaction.firstKeptEntryId);

    const liveTailTokens = liveTail.reduce((sum, entry) => {
        if (entry.type === "message") {
            return sum + entry.tokenCount;
        }
        return sum;
    }, 0);

    const summaryTokens = estimateTokens(lastCompaction.summary);

    return summaryTokens + liveTailTokens;
}