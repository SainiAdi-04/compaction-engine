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
</modified-files>`;

  const previousSummaryBlock = previousSummary
    ? `Here is the summary of everything before this point:\n${previousSummary}\n\n`
    : "";

  const conversationBlock =
    `Here is the conversation to summarize:\n${serializedConversation}`;

  const userMessage =
    `${formatInstructions}\n\n${previousSummaryBlock}${conversationBlock}`;

  return { systemPrompt, userMessage };
}
