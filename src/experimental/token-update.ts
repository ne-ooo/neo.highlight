import type { Token } from "../core/types";

/** Apply a stream suffix or document range update to caller-owned tokens. */
export function applyJavaScriptTokenUpdate(tokens: readonly Token[], update: {
  tokens: readonly Token[]; sourceLength: number;
} & ({ replaceFrom: number } | { from: number; to: number })): Token[] {
  const length = (token: Token) => {
    const size = typeof token === "string" ? token.length : token.length;
    if (!Number.isSafeInteger(size) || size < 0) throw new RangeError("Invalid token length");
    return size;
  };
  let oldLength = 0, insertedLength = 0;
  for (const token of tokens) oldLength += length(token);
  for (const token of update.tokens) insertedLength += length(token);
  const from = "replaceFrom" in update ? update.replaceFrom : update.from;
  const to = "replaceFrom" in update ? oldLength : update.to;
  if (![from, to, oldLength, insertedLength, update.sourceLength].every(Number.isSafeInteger) || from < 0 || to < from || to > oldLength
    || oldLength - (to - from) + insertedLength !== update.sourceLength) throw new RangeError("Invalid token update range or source length");
  const result: Token[] = [];
  const append = (token: Token) => {
    if (token === "") return;
    const previous = result.at(-1);
    if (typeof previous === "string" && typeof token === "string") result[result.length - 1] = previous + token;
    else result.push(token);
  };
  const copy = (start: number, end: number) => {
    let offset = 0;
    for (const token of tokens) {
      const size = length(token);
      if (offset < end && offset + size > start) {
        if (offset >= start && offset + size <= end) append(token);
        else {
          if (typeof token !== "string") throw new RangeError("Token update splits a structured token");
          append(token.slice(Math.max(0, start - offset), end - offset));
        }
      }
      offset += size;
      if (offset >= end) break;
    }
  };
  copy(0, from);
  for (const token of update.tokens) append(token);
  copy(to, oldLength);
  return result.length ? result : [""];
}
