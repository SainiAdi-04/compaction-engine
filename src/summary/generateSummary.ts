import { LLMProvider, CompactionDetails, Usage } from "../types.ts";
import {buildSummaryPrompt} from "./prompt.ts"
import {parseSummary} from "./parseSummary.ts"

export async function generateSummary(serializedConversation: string, provider: LLMProvider, previousSummary?: string): Promise<{summaryText:string, details: CompactionDetails, usage: Usage}>{

    const { systemPrompt, userMessage } = buildSummaryPrompt(serializedConversation, previousSummary)
    const { text, usage } = await provider.call(systemPrompt, userMessage);
    const { summaryText, details } = parseSummary(text);

    return { summaryText, details, usage };

}