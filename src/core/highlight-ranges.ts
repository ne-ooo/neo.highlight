import type { HighlightRange } from "./types";

export const MAX_HIGHLIGHT_RANGES = 256;

/** Validate and merge half-open UTF-16 source ranges without changing caller data. */
export function normalizeHighlightRanges(source: string, ranges: readonly HighlightRange[]): readonly HighlightRange[] {
  if (!Array.isArray(ranges)) throw new TypeError("highlightRanges must be an array");
  if (ranges.length > MAX_HIGHLIGHT_RANGES) throw new RangeError(`highlightRanges exceeds ${MAX_HIGHLIGHT_RANGES} ranges`);
  const boundary = (offset: number): boolean => {
    const before = source.charCodeAt(offset - 1);
    const after = source.charCodeAt(offset);
    return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
      && !(before === 13 && after === 10);
  };
  const sorted = ranges.map(range => {
    if (!range || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)
      || range.start < 0 || range.end <= range.start || range.end > source.length
      || !boundary(range.start) || !boundary(range.end)) {
      throw new RangeError("highlightRanges must contain valid source bounds without splitting a surrogate pair or CRLF");
    }
    return { start: range.start, end: range.end };
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  const result: { start: number; end: number }[] = [];
  for (const range of sorted) {
    const previous = result[result.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else result.push(range);
  }
  return Object.freeze(result.map(range => Object.freeze(range)));
}
