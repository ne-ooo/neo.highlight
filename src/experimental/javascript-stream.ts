import type { Token, TokenizeOptions } from "../core/types";
import { tokenizeWithMetrics } from "../core/tokenizer";
import { javascript } from "../grammars/javascript";
import { typescript } from "../grammars/typescript";
import { scanJavaScript } from "../grammars/shared/javascript-scanner";
import { createJavaScriptInput } from "./javascript-input";

/** Options for the opt-in experimental JavaScript/TypeScript stream. */
export interface JavaScriptStreamOptions extends TokenizeOptions {
  language?: "javascript" | "typescript";
  /** Highlight the mutable suffix, or leave it plain until a checkpoint. */
  preview?: "highlight" | "plain";
  maxRetainedCodeUnits?: number;
  maxWorkCodeUnits?: number;
  maxUpdates?: number;
}
export interface JavaScriptStreamUpdate {
  /** Replace the previous provisional suffix at this UTF-16 source offset. */
  readonly replaceFrom: number;
  readonly tokens: Token[];
  /** Earlier tokens are final. The remaining suffix can change with later input. */
  readonly committedThrough: number;
  readonly sourceLength: number;
  readonly done: boolean;
}
export interface JavaScriptStreamMetrics {
  readonly updates: number;
  readonly sourceLength: number;
  readonly pendingCodeUnits: number;
  readonly workCodeUnits: number;
  readonly tokenizedCodeUnits: number;
  readonly tokenizations: number;
  readonly matchCount: number;
  readonly tokenCount: number;
}
export interface JavaScriptStream {
  append(chunk: string): JavaScriptStreamUpdate;
  finish(): JavaScriptStreamUpdate;
  dispose(): void;
  readonly metrics: JavaScriptStreamMetrics;
}
function limit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  return value;
}

/** Resume lexical scanning, commit independent statements, and retain an unfinished suffix. */
export function createJavaScriptStream(options: JavaScriptStreamOptions = {}): JavaScriptStream {
  const language = options.language ?? "javascript";
  if (language !== "javascript" && language !== "typescript") throw new RangeError("Streaming supports javascript and typescript");
  const grammar = language === "typescript" ? typescript : javascript;
  const preview = options.preview ?? "highlight";
  if (preview !== "highlight" && preview !== "plain") throw new RangeError("preview must be highlight or plain");
  const maxInputLength = limit(options.maxInputLength ?? 250_000, "maxInputLength");
  const maxMatchCount = limit(options.maxMatchCount ?? 100_000, "maxMatchCount");
  const maxTokenCount = limit(options.maxTokenCount ?? 100_000, "maxTokenCount");
  const maxTokenDepth = limit(options.maxTokenDepth ?? 100, "maxTokenDepth");
  const maxRetained = limit(options.maxRetainedCodeUnits ?? 64_000, "maxRetainedCodeUnits");
  const maxWork = limit(options.maxWorkCodeUnits ?? 16_000_000, "maxWorkCodeUnits");
  const maxUpdates = limit(options.maxUpdates ?? 10_000, "maxUpdates");
  let input = createJavaScriptInput("");
  const scanner = () => scanJavaScript(input.source, false, "code", { depth: 0, maxTokenDepth }, 0, 1, language === "typescript", "}", input)[Symbol.iterator]();
  let iterator = scanner();
  let committedThrough = 0;
  let closed = false;
  let updates = 0, sourceLength = 0, workCodeUnits = 0, tokenizedCodeUnits = 0, tokenizations = 0, matchCount = 0, tokenCount = 0;
  function release(): void {
    closed = true;
    iterator.return?.();
    input = createJavaScriptInput("");
  }
  function charge(units: number): void {
    if (units > maxWork - workCodeUnits) throw new RangeError("Stream exceeds maxWorkCodeUnits");
    workCodeUnits += units;
  }
  function tokenizeSegment(source: string): Token[] {
    charge(source.length);
    const result = tokenizeWithMetrics(source, grammar, {
      maxInputLength, maxMatchCount: maxMatchCount - matchCount,
      maxTokenCount: maxTokenCount - tokenCount, maxTokenDepth,
    });
    tokenizations++;
    tokenizedCodeUnits += source.length;
    matchCount += result.matchCount;
    tokenCount += result.tokenCount;
    return result.tokens;
  }
  function update(chunk: string, final: boolean): JavaScriptStreamUpdate {
    if (closed) throw new Error("JavaScript stream is closed");
    if (typeof chunk !== "string") throw new TypeError("Stream chunk must be a string");
    const replaceFrom = committedThrough;
    try {
      if (updates >= maxUpdates) throw new RangeError("Stream exceeds maxUpdates");
      if (chunk.length > maxInputLength - sourceLength) throw new RangeError("Stream exceeds maxInputLength");
      updates++;
      // Include concatenation, suffix copies, output copies, and tokenization in this budget.
      charge(input.source.length + chunk.length);
      input.source += chunk;
      input.final = final;
      sourceLength += chunk.length;
      const tokens: Token[] = [];
      let consumed = 0;
      for (;;) {
        const event = iterator.next();
        if (event.done || event.value.kind === "input") break;
        if (event.value.kind !== "checkpoint") continue;
        const end = event.value.end;
        for (const token of tokenizeSegment(input.source.slice(consumed, end))) tokens.push(token);
        committedThrough += end - consumed;
        consumed = end;
      }
      if (final) {
        const tail = input.source.slice(consumed);
        if (tail.length || sourceLength === 0) for (const token of tokenizeSegment(tail)) tokens.push(token);
        committedThrough = sourceLength;
        release();
      } else {
        if (consumed) {
          const tail = input.source.slice(consumed);
          charge(tail.length * 2); // The cursor replays this suffix after a checkpoint rebase.
          iterator.return?.();
          input = createJavaScriptInput(tail);
          iterator = scanner();
        }
        if (input.source.length > maxRetained) throw new RangeError("Stream exceeds maxRetainedCodeUnits");
        charge(input.source.length);
        if (input.source.length) {
          if (preview === "plain") tokens.push(input.source);
          else for (const token of tokenizeSegment(input.source)) tokens.push(token);
        }
      }
      return { replaceFrom, tokens, committedThrough, sourceLength, done: final };
    } catch (error) { release(); throw error; }
  }
  return {
    append: chunk => update(chunk, false),
    finish: () => update("", true),
    dispose: release,
    get metrics() { return { updates, sourceLength, pendingCodeUnits: input.source.length, workCodeUnits, tokenizedCodeUnits, tokenizations, matchCount, tokenCount }; },
  };
}
