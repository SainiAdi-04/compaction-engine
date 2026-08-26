import { CompactionDetails } from "../types.ts";

export function parseSummary(rawLLMText: string): { summaryText: string; details: CompactionDetails } {
    const openingReadTag = "<read-files>";
    const closingReadTag = "</read-files>";
    const readFilePath = extractTagContent(rawLLMText, openingReadTag, closingReadTag);

    const openingWriteTag = "<modified-files>";
    const closingWriteTag = "</modified-files>";
    const modifiedFilePath = extractTagContent(rawLLMText, openingWriteTag, closingWriteTag);

    const readFiles = cleanPaths(readFilePath);
    const modifiedFiles = cleanPaths(modifiedFilePath);

    return {
        summaryText: rawLLMText,
        details: {
            readFiles: readFiles,
            modifiedFiles: modifiedFiles
        }
    };
}

function extractTagContent(text: string, openTag: string, closeTag: string): string {
    const startIndex = text.indexOf(openTag);
    const endIndex = text.indexOf(closeTag);

    if (startIndex === -1 || endIndex === -1) {
        return "";
    }

    return text.slice(startIndex + openTag.length, endIndex);
}

function cleanPaths(pathString: string): string[] {
    return pathString.split(/\r?\n/)
        .map(line => line.trim().replace(/^[-*•]\s+/, ""))
        .filter(line => line.length > 0);
}