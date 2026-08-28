# Compaction Engine

A standalone implementation of context compaction for LLM coding agents, built with Deno and TypeScript. This project follows the compaction architecture documented by the [Pi coding agent](https://pi.dev/docs/latest/compaction), informed by Chroma's [Context Rot](https://www.trychroma.com/research/context-rot) research, and inspired by [Earendil's post on compaction in Pi](https://earendil.com/posts/compaction-in-pi/).

---

## The Problem: Context Windows Have Limits

Every LLM has a context window: a fixed upper limit on how many tokens it can read and reason over in a single request. When you use a coding agent, everything that happens in the session fills this window. Your messages, the agent's replies, every file it reads, every command it runs, every tool result it receives -- all of it accumulates token by token.

A short session might use a few thousand tokens. A serious coding session where the agent reads files, writes code, runs tests, reads error output, and iterates can easily blow past 100,000 tokens. At some point, the conversation simply does not fit anymore.

When that happens, the agent has two choices:

1. **Drop old messages.** Simple, but the agent loses memory of what it was doing, what files it touched, what decisions were made, and why. It starts repeating work or contradicting earlier choices.
2. **Compress old messages into a summary.** The original messages are replaced in the context with a much shorter structured summary that preserves the essential information: goals, progress, decisions, and file paths.

Compaction is choice 2.

---

## Context Rot: Why Bigger Is Not Better

You might wonder: if models now have context windows of 1 million tokens or more, why bother compressing at all? Just send everything.

Chroma's research paper ["Context Rot: How Increasing Input Tokens Impacts LLM Performance"](https://www.trychroma.com/research/context-rot) (July 2025) answers this. They tested 18 models, including GPT-4.1, Claude 4, Gemini 2.5, and Qwen3, and found that LLM performance degrades as input length grows, even when the task itself does not get harder.

The key findings:

- **Performance is not uniform across the context window.** The model does not treat the 10,000th token as reliably as the 100th. Everyone assumed it did; it does not.
- **Standard benchmarks hid this.** The widely used "Needle in a Haystack" test only checks if a model can find an exact sentence buried in a long document. That is trivial pattern matching. Real tasks require semantic understanding, filtering distractors, and reasoning, all of which degrade with length.
- **Fuzzy questions degrade faster.** When the answer does not share exact words with the question, accuracy drops more steeply as input grows.
- **Distractors hurt more at scale.** A single "related but wrong" sentence near the real answer hurts accuracy, and the effect worsens in longer contexts.
- **Even trivial copy-paste tasks break.** Asking a model to repeat a long block of text verbatim gets less accurate with length. Models sometimes refuse, add words, or go off the rails entirely.


---

## Compaction: The Solution

Compaction is a five-stage pipeline:

1. **Trigger**: detect that the conversation has grown too long.
2. **Cut**: choose a boundary that separates old messages (to be summarized) from recent messages (to be kept as-is).
3. **Serialize**: convert the old messages into a flat, plain-text transcript.
4. **Summarize**: send that transcript to an LLM with instructions to compress it into a structured summary.
5. **Save**: append the summary as a new entry in the session log. The old messages stay on disk but are no longer sent to the model.

After compaction, the next request to the LLM looks like:

```
[system prompt] -> [summary of everything before the cut] -> [recent messages kept as-is]
```

The following sections walk through each stage.

---

## 1 - Deciding When to Compact

Compaction fires when the total tokens in the current context exceed a threshold:

```
currentTokens > contextWindow - reserveTokens
```

`reserveTokens` is headroom set aside for the model's response. If the context window is 200,000 tokens and the reserve is 16,384, compaction triggers when the conversation exceeds 183,616 tokens.

The "current token count" is not simply the sum of all messages ever sent. If a previous compaction already happened, the current count is:

```
tokens(last summary) + tokens(messages after the last summary)
```

This is the "live context" -- what the model will actually see on the next request. Messages that were already summarized in a prior compaction do not count.

---

## 2 - Choosing What to Summarize (The Cut Point)

Once compaction is triggered, the engine needs to decide where to draw the line between "old messages to summarize" and "recent messages to keep."

The algorithm walks backward from the newest message, accumulating token counts. When the running total exceeds a budget called `keepRecentTokens`, it stops. Everything before that point is the candidate for summarization. Everything from that point onward stays in context untouched.

There is one critical constraint: **the cut must never land on a tool result.** In a coding agent conversation, a tool result (the output of a file read, a bash command, etc.) is semantically bound to the tool call that produced it. If you keep the call but summarize the result, or vice versa, the conversation becomes incoherent. So if the backward walk lands on a tool result, the cut is rolled back to the preceding assistant or user message.

This gives the engine a clean boundary: everything before the cut is a self-contained block of conversation that can be summarized without orphaning any tool call/result pairs.

---

## 3 - Serializing Messages Into a Transcript

The messages selected for summarization are converted into a flat, plain-text transcript:

```
[User]: Can you read src/config.ts?
[Assistant]: Sure, reading that file now.
[Tool result]: {"status":"ok","content":"export const config = { port: 3000 }"}
[User]: Change the port to 8080.
[Assistant]: Done. I updated src/config.ts.
```

Two deliberate design choices here:

1. **Flat text, not structured messages.** The transcript is fed to a summarizing LLM. If it received the original structured message objects, it might interpret them as a conversation to *continue* rather than something to *compress*. The flat format makes the intent unambiguous.

2. **Tool results are truncated.** Tool outputs (file contents, command output) are usually what blow up token counts. A single file read can produce thousands of tokens. The serializer truncates each tool result to 2,000 characters and appends a marker like `[truncated 8342 chars]`. The summarizer does not need the full file contents to note "the agent read config.ts and found port was set to 3000."

---

## 4 - Generating the Summary

The serialized transcript is sent to an LLM along with:

- A **system prompt** that says: "You are a context summarization assistant. Compress this coding session transcript into a structured summary. Do not continue the conversation or respond to it -- only summarize it."
- **Format instructions** specifying the exact markdown structure the summary must follow (see [The Summary Format](#the-summary-format)).
- The **previous summary**, if one exists from an earlier compaction. This makes compaction iterative: each summary builds on the last rather than starting from scratch.

The LLM returns a structured summary, which the engine then parses to extract machine-readable metadata (specifically the file paths from `<read-files>` and `<modified-files>` XML tags embedded in the summary).

---

## 5 - Saving the Result

The summary is wrapped in a `CompactionEntry` and appended to the session log. This entry contains:

- **summary**: the full markdown text produced by the summarizer.
- **firstKeptEntryId**: the ID of the first message that was *not* summarized. This is where the "kept" messages begin.
- **tokensBefore**: how many tokens were in the live context before compaction ran.
- **details**: cumulative lists of files that were read and modified (see [Cumulative File Tracking](#cumulative-file-tracking)).
- **isSplitTurn**: whether the compaction had to split a single turn (see [Split Turns](#split-turns)).

**Nothing is deleted.** The old messages remain in the session log on disk. They are simply excluded from what gets sent to the LLM going forward. This means you can always go back and inspect the full history if needed.

---

## The Summary Format

The summarizer is instructed to produce output in this exact markdown structure:

```markdown
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
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

Each section exists for a specific reason:

| Section | Why it matters |
|---|---|
| **Goal** | Preserves user intent so it does not drift across compactions |
| **Constraints & Preferences** | Keeps explicit requirements the user stated |
| **Progress** | Gives the agent a checklist (done / in-progress / blocked) so it does not repeat or forget work |
| **Key Decisions** | Preserves *why* something was chosen, not just *what*. Prevents the agent from re-litigating settled design choices |
| **Next Steps** | Primes the agent for what to do immediately when it resumes |
| **Critical Context** | Catch-all for facts (IDs, config values, error messages) that do not fit elsewhere but are needed to continue |
| **`<read-files>` / `<modified-files>`** | Machine-parseable tags for file tracking, explained below |

---

## Cumulative File Tracking

The `<read-files>` and `<modified-files>` tags in the summary are not just prose. They are machine-parseable lists of file paths that the engine extracts and stores as structured data alongside the summary.

When a new compaction happens, the engine merges the file lists from the new summary with the file lists from the previous compaction's stored details, deduplicating as it goes. This means the full history of every file the agent has read or modified survives indefinitely, even across dozens of compactions, without any of the original messages needing to be in context.

This is important because a coding agent that has been running for a while needs to know which files it has already touched, even if the messages where those file operations happened were summarized away long ago.

---

## Split Turns

A "turn" in a coding agent conversation is a user message followed by everything the assistant does in response: its replies, tool calls, tool results, and so on, up until the next user message.

Most turns are a few messages. But sometimes a single turn is enormous. The user might say "refactor the entire auth module," and the agent responds with a long chain of file reads, file writes, and tool calls, all within one turn before the user speaks again.

If that single turn exceeds the `keepRecentTokens` budget, the normal cut-point algorithm has a problem: the entire turn is "recent" (it is the response to the most recent user request), so it should be kept, but it is too big to fit.

The solution is a **split turn**. The engine finds a cut point *inside* the oversized turn, splitting it into an early part (which gets summarized) and a later part (which stays in context). The same tool-result constraint applies: the inner cut must not land on a tool result.

The `isSplitTurn` flag on the `CompactionEntry` records whether this happened, so downstream logic knows the summary contains part of the most recent turn, not just older history.

---

## Iterative Compaction

Compaction is not a one-time event. In a long session, it fires multiple times as the conversation keeps growing. Each compaction is iterative:

1. The first compaction summarizes messages 1 through N and keeps messages N+1 onward.
2. The conversation grows. The second compaction summarizes messages N+1 through M, but it also receives the first summary as input. The summarizer folds the new information into the existing summary rather than starting fresh.
3. This repeats. Each summary builds on the last. File lists are merged and deduplicated across rounds.

This design means that information from the very beginning of the session (the user's original goal, early design decisions) persists through the summary chain indefinitely, even as the specific messages that contained it are long gone from context.

---

## How Compaction Interacts With Prompt Caching

Prompt caching is a cost optimization used by LLM providers (Anthropic, Google, OpenAI all offer variants). It works because in a conversation, each new request shares a long prefix with the previous request:

```
request 1: [system][tools][turn A]                        -> all new, nothing cached
request 2: [system][tools][turn A][turn B]                 -> prefix cached, only B is new
request 3: [system][tools][turn A][turn B][turn C]          -> prefix cached, only C is new
```

The provider caches the shared prefix, so you only pay full price for the new tokens at the end.

Compaction is the one event that disrupts this. When compaction fires, the old turns in the prefix are replaced with a summary:

```
request N:   [system][tools][SUMMARY][turn C][turn D][new]
              -> cache MISS, the prefix changed, everything recomputed
request N+1: [system][tools][SUMMARY][turn C][turn D][new][turn E]
              -> prefix cached again, only E is new
```

The cache miss is a one-time cost. After that single request, caching resumes normally with the new prefix (which now includes the summary). Over a long session, this is a worthwhile tradeoff: a brief cache miss in exchange for a much smaller, higher-quality context that the model can reason over more reliably.

---

## Running the Project

### Prerequisites

- [Deno](https://deno.land/) (v2.9+)
- A Gemini API key

### Setup

```bash
git clone https://github.com/SainiAdi-04/compaction-engine.git
cd compaction-engine

cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### Run

```bash
# Run the compaction CLI against a fixture conversation
deno task compact

# Run in watch mode during development
deno task dev

# Run the test suite
deno task test
```

The CLI loads a fixture conversation, runs the full compaction pipeline against the Gemini API, and prints the before/after state with the generated summary, file details, and LLM token usage.

---


### What each file does

| File | Purpose |
|---|---|
| `src/types.ts` | All TypeScript interfaces: `Message`, `CompactionEntry`, `LLMProvider`, `SessionEntry`, `CompactionDetails` |
| `src/core/trigger.ts` | `triggerCompaction()`: checks if `currentTokens > contextWindow - reserveTokens` |
| `src/core/currentTokenCount.ts` | `getCurrentTokenCount()`: sums tokens in the live tail (after the last compaction) plus estimated summary tokens |
| `src/core/cutPoint.ts` | `findCutPoint()`: backward walk to find the cut, tool-result rollback, split-turn detection via `findInnerCutPoint()`. Also exports `findTurnStart()`, `findTurnEnd()`, and `sumTokens()` |
| `src/core/serialize.ts` | `serializeConversation()`: converts messages to `[Role]: content` plain text, truncates tool results to 2,000 chars |
| `src/core/mergeDetails.ts` | `mergeDetails()`: deduplicates and merges `readFiles` and `modifiedFiles` arrays across compaction rounds |
| `src/summary/prompt.ts` | `buildSummaryPrompt()`: constructs the system prompt and user message for the summarizer, including format instructions and previous summary |
| `src/summary/generateSummary.ts` | `generateSummary()`: orchestrates prompt building, LLM call, and response parsing |
| `src/summary/parseSummary.ts` | `parseSummary()`: extracts `<read-files>` and `<modified-files>` tag contents from the LLM's response into structured data |
| `src/llm/client.ts` | `GeminiProvider`: implements `LLMProvider` by calling the Gemini Interactions API |
| `src/session/sessionLog.ts` | `SessionLog`: in-memory append-only log of messages and compaction entries |
| `src/session/compact.ts` | `runCompaction()`: the top-level orchestrator that wires all stages together |
| `src/fixtures/fakeConversations.ts` | Four fixture conversations for testing: normal, tool-result-adjacent, split-turn, and file-tracking scenarios |
| `cli/main.ts` | CLI entry point: loads fixtures, runs compaction against the Gemini API, prints results |

---

## References

1. **Earendil - Compaction in Pi**: [earendil.com/posts/compaction-in-pi/](https://earendil.com/posts/compaction-in-pi/).

2. **Pi Coding Agent - Compaction Documentation**: [pi.dev/docs/latest/compaction](https://pi.dev/docs/latest/compaction).

3. **Chroma - Context Rot** (July 2025): ["Context Rot: How Increasing Input Tokens Impacts LLM Performance"](https://www.trychroma.com/research/context-rot) by Kelly Hong, Anton Troynikov, Jeff Huber.
