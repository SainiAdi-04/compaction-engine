import { cutPoint, Message } from "../types.ts";

export function findTurnStart(messages: Message[], idx: number): number {
  for (let i = idx; i >= 0; i--) {
    if (messages[i].role === "user") {
      return i;
    }
  }
  return 0;
}

export function findTurnEnd(messages: Message[], idx: number): number {
  for (let i = idx + 1; i < messages.length; i++) {
    if (messages[i].role === "user") {
      return i - 1;
    }
  }
  return messages.length - 1;
}

export function sumTokens(
  messages: Message[],
  start: number,
  end: number,
): number {
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum += messages[i].tokenCount;
  }
  return sum;
}

export function findInnerCutPoint(
  messages: Message[],
  turnStart: number,
  turnEnd: number,
  keepRecentTokens: number,
): number {
  let tCount = 0;
  let idx = turnEnd;

  for (let i = turnEnd; i >= turnStart; i--) {
    const tentative = tCount + messages[i].tokenCount;
    if (tentative > keepRecentTokens) {
      break;
    }
    tCount = tentative;
    idx = i;
  }

  while (idx > turnStart && messages[idx].role === "tool_result") {
    idx--;
  }

  return idx;
}

export function findCutPoint(
  messages: Message[],
  keepRecentTokens: number,
): cutPoint {
  if (messages.length === 0) {
    return { cutPointIndex: -1, isSplitTurn: false };
  }

  let tCount = 0;
  let idx = messages.length - 1;
  let crossed = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const tentative = tCount + messages[i].tokenCount;
    if (tentative > keepRecentTokens) {
      crossed = true;
      break;
    }
    tCount = tentative;
    idx = i;
  }

  if (!crossed) {
    return { cutPointIndex: -1, isSplitTurn: false };
  }

  while (idx > 0 && messages[idx].role === "tool_result") {
    idx--;
  }

  const turnStart = findTurnStart(messages, idx);
  const turnEnd = findTurnEnd(messages, idx);
  const turnTokens = sumTokens(messages, turnStart, turnEnd);

  if (turnTokens <= keepRecentTokens) {
    return {
      cutPointIndex: idx,
      isSplitTurn: false,
    };
  }

  const innerCutIndex = findInnerCutPoint(
    messages,
    turnStart,
    turnEnd,
    keepRecentTokens,
  );

  return {
    cutPointIndex: innerCutIndex,
    isSplitTurn: true,
  };
}
