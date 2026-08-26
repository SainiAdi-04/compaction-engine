import { CompactionDetails } from "../types.ts";

export function mergeDetails(
  prevCompaction: CompactionDetails | undefined,
  newCompaction: CompactionDetails,
): CompactionDetails {
  const mergedReadFiles = Array.from(
    new Set([...(prevCompaction?.readFiles || []), ...newCompaction.readFiles]),
  );
  const mergedModifiedFiles = Array.from(
    new Set([
      ...(prevCompaction?.modifiedFiles || []),
      ...newCompaction.modifiedFiles,
    ]),
  );

  return {
    readFiles: mergedReadFiles,
    modifiedFiles: mergedModifiedFiles,
  };
}
