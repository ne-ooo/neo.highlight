import type { Token } from "../core/types";
import { tokenizeWithMetrics } from "../core/tokenizer";
import { javascript } from "../grammars/javascript";
import { typescript } from "../grammars/typescript";
import { scanJavaScript } from "../grammars/shared/javascript-scanner";
import { createJavaScriptInput } from "./javascript-input";
import type { JavaScriptStreamOptions } from "./javascript-stream";

interface Segment { start: number; end: number; tokens: Token[] }
export interface JavaScriptEdit {
  /** The revision to which this edit applies. */
  revision: number;
  start: number;
  end: number;
  text: string;
}
export interface JavaScriptDocumentUpdate {
  revision: number;
  /** Replace this range in the previous document. Source offsets use UTF-16 units. */
  from: number;
  to: number;
  tokens: Token[];
  sourceLength: number;
}
export interface JavaScriptDocument {
  edit(edit: JavaScriptEdit): JavaScriptDocumentUpdate;
  snapshot(): { revision: number; source: string; tokens: Token[] };
  dispose(): void;
  readonly metrics: {
    revision: number; sourceLength: number; retainedSegments: number; updates: number;
    workCodeUnits: number; tokenizedCodeUnits: number; reusedCodeUnits: number;
    matchCount: number; tokenCount: number;
  };
}
function bounded(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  return value;
}
function join(segments: readonly Segment[]): Token[] {
  const result: Token[] = [];
  for (const segment of segments) for (const token of segment.tokens) {
    if (token === "") continue;
    if (typeof token === "string" && typeof result.at(-1) === "string") result[result.length - 1] += token;
    else result.push(token);
  }
  return result.length ? result : [""];
}

/** Experimental edit sessions. Checkpoints use the same conservative grammar reset states as streams. */
export function createJavaScriptDocument(initial: string, options: JavaScriptStreamOptions = {}): JavaScriptDocument {
  if (typeof initial !== "string") throw new TypeError("Document source must be a string");
  const language = options.language ?? "javascript";
  if (language !== "javascript" && language !== "typescript") throw new RangeError("Incremental documents support javascript and typescript");
  const grammar = language === "typescript" ? typescript : javascript;
  const maxInput = bounded(options.maxInputLength ?? 250_000, "maxInputLength");
  const maxRegion = bounded(options.maxRetainedCodeUnits ?? 64_000, "maxRetainedCodeUnits");
  const maxWork = bounded(options.maxWorkCodeUnits ?? 16_000_000, "maxWorkCodeUnits");
  const maxMatches = bounded(options.maxMatchCount ?? 100_000, "maxMatchCount");
  const maxTokens = bounded(options.maxTokenCount ?? 100_000, "maxTokenCount");
  const maxDepth = bounded(options.maxTokenDepth ?? 100, "maxTokenDepth");
  const maxUpdates = bounded(options.maxUpdates ?? 10_000, "maxUpdates");
  let source = initial, segments: Segment[] = [], revision = 0, updates = 0, closed = false;
  let workCodeUnits = 0, tokenizedCodeUnits = 0, reusedCodeUnits = 0, matchCount = 0, tokenCount = 0;
  function release(): void { closed = true; source = ""; segments = []; }
  function charge(size: number): void {
    if (size > maxWork - workCodeUnits) throw new RangeError("Document exceeds maxWorkCodeUnits");
    workCodeUnits += size;
  }
  function segment(text: string, start: number, end: number): Segment {
    if (end - start > maxRegion) throw new RangeError("Document exceeds maxRetainedCodeUnits per region");
    charge(end - start);
    const result = tokenizeWithMetrics(text, grammar, { maxInputLength: maxInput, maxTokenCount: maxTokens - tokenCount,
      maxMatchCount: maxMatches - matchCount, maxTokenDepth: maxDepth });
    tokenizedCodeUnits += text.length;
    matchCount += result.matchCount; tokenCount += result.tokenCount;
    return { start, end, tokens: result.tokens };
  }
  function parse(text: string, offset: number, stop: (end: number) => boolean): { segments: Segment[]; end: number } {
    const input = createJavaScriptInput(text); input.final = true;
    const result: Segment[] = [];
    let start = 0;
    for (const event of scanJavaScript(text, false, "code", { depth: 0, maxTokenDepth: maxDepth }, 0, 1, language === "typescript", "}", input)) {
      if (event.kind !== "checkpoint") continue;
      result.push(segment(text.slice(start, event.end), offset + start, offset + event.end));
      start = event.end;
      if (stop(offset + start)) { charge(start); return { segments: result, end: offset + start }; }
    }
    if (start < text.length || !text.length) result.push(segment(text.slice(start), offset + start, offset + text.length));
    charge(text.length);
    return { segments: result, end: offset + text.length };
  }
  if (initial.length > maxInput) throw new RangeError("Document exceeds maxInputLength");
  segments = parse(initial, 0, () => false).segments;
  return {
    edit(edit) {
      if (closed) throw new Error("JavaScript document is closed");
      if (!edit || edit.revision !== revision) throw new RangeError("Document revision is stale");
      if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < 0 || edit.end < edit.start || edit.end > source.length) {
        throw new RangeError("Invalid document edit range");
      }
      if (typeof edit.text !== "string") throw new TypeError("Edit text must be a string");
      try {
        if (updates >= maxUpdates) throw new RangeError("Document exceeds maxUpdates");
        const length = source.length - (edit.end - edit.start) + edit.text.length;
        if (length > maxInput) throw new RangeError("Document exceeds maxInputLength");
        charge(length);
        const nextSource = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
        const delta = edit.text.length - (edit.end - edit.start);
        // A checkpoint depends on the following newline. An edit at that offset invalidates it.
        let prefixCount = 0;
        while (prefixCount < segments.length - 1 && segments[prefixCount]!.end < edit.start) prefixCount++;
        const from = segments[prefixCount]?.start ?? 0;
        const oldCheckpoints = new Map<number, number>();
        for (let index = prefixCount; index < segments.length - 1; index++) oldCheckpoints.set(segments[index]!.end, index + 1);
        let suffixIndex = segments.length;
        const changed = parse(nextSource.slice(from), from, end => {
          const originalEnd = end - delta;
          if (end < edit.start + edit.text.length || originalEnd < edit.end) return false;
          const index = oldCheckpoints.get(originalEnd);
          if (index === undefined) return false;
          suffixIndex = index;
          return true;
        });
        const to = suffixIndex < segments.length ? segments[suffixIndex]!.start : source.length;
        const suffix = segments.slice(suffixIndex).map(item => ({ ...item, start: item.start + delta, end: item.end + delta }));
        const patch = structuredClone(join(changed.segments));
        charge(changed.end - from); // Returned tokens are isolated from the retained cache.
        segments = [...segments.slice(0, prefixCount), ...changed.segments, ...suffix];
        source = nextSource;
        revision++; updates++;
        reusedCodeUnits += from + source.length - changed.end;
        return { revision, from, to, tokens: patch, sourceLength: source.length };
      } catch (error) { release(); throw error; }
    },
    snapshot() {
      if (closed) throw new Error("JavaScript document is closed");
      try { charge(source.length); return { revision, source, tokens: structuredClone(join(segments)) }; }
      catch (error) { release(); throw error; }
    },
    dispose: release,
    get metrics() { return { revision, sourceLength: source.length, retainedSegments: segments.length, updates, workCodeUnits,
      tokenizedCodeUnits, reusedCodeUnits, matchCount, tokenCount }; },
  };
}
