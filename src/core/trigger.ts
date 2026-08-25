// checks contextTokens > contextWindow - reserveTokens
// const contextWindow = 20000;
// const reserveToken = 2000;

export function triggerCompaction(
  currentTokenCount: number,
  contextWindow: number = 20000,
  reserveToken: number = 2000,
): boolean {
  if (currentTokenCount > contextWindow - reserveToken) {
    return true;
  }

  return false;
}
