export function buildSummaryPrompt(
  serializedConversation: string,
  previousSummary?: string,
): { systemPrompt: string; userMessage: string } {
  const systemPrompt =
    `You are a context summarization assistant. Your job is to compress a coding session transcript into a structured summary that preserves everything needed to resume work later. Do not continue the conversation or respond to it — only summarize it.`;

  const formatInstructions =
    `Summarize the conversation below using EXACTLY this markdown structure:

## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues, if any]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>

IMPORTANT: You must populate <read-files> and <modified-files> with the actual file paths mentioned anywhere in the conversation above — every file that was read goes in <read-files>, every file that was created or edited goes in <modified-files>. List one file path per line. Do not leave these empty if any files were read or modified in the conversation, even if you already mentioned them in the prose sections above.

`;

  const previousSummaryBlock = previousSummary
    ? `Here is the summary of everything before this point:\n${previousSummary}\n\n`
    : "";

  const conversationBlock =
    `Here is the conversation to summarize:\n${serializedConversation}`;

  const userMessage =
    `${formatInstructions}\n\n${previousSummaryBlock}${conversationBlock}`;

  return { systemPrompt, userMessage };
}
