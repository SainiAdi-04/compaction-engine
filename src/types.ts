// Message, SessionEntry, CompactionEntry, BranchSummaryEntry, etc.
export type MessageRole =
  | "user"
  | "assistant"
  | "tool_result"
  | "bash_execution"
  | "custom";

export interface Message {
  type: "message";
  id: string;
  role: MessageRole;
  content: string;
  tokenCount: number;
  toolCallId?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}

export interface CompactionEntry {
  type: "compaction";
  id: string,
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details: CompactionDetails;
  usage?: Usage
}

export interface cutPoint {
  cutPointIndex: number;
  isSplitTurn: boolean;
}

export type SessionEntry = Message | CompactionEntry;

export interface LLMResponse {
  text: string;
  usage: Usage;
}

export interface LLMProvider {
  call(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
}


