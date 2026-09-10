import type { Token, TokenizeOptions } from "../core/types";

export interface HighlightWorkerRequest extends TokenizeOptions {
  id: string | number;
  code: string;
  language: string;
}
export interface HighlightWorkerSuccess {
  id: string | number;
  ok: true;
  tokens: Token[];
}
export interface HighlightWorkerFailure {
  id: string | number;
  ok: false;
  error: { name: string; message: string };
}
export type HighlightWorkerResponse = HighlightWorkerSuccess | HighlightWorkerFailure;

export const limitNames = ["maxInputLength", "maxMatchCount", "maxTokenCount", "maxTokenDepth"] as const;

/** Copy only protocol fields. Signals and application keys stay on the caller. */
export function copyLimits(options: TokenizeOptions): TokenizeOptions {
  const limits: TokenizeOptions = {};
  for (const name of limitNames) {
    const value = options[name];
    if (value === undefined) continue;
    if (value !== Infinity && (!Number.isInteger(value) || value < 0)) {
      throw new RangeError(`${name} must be a non-negative integer or Infinity`);
    }
    limits[name] = value;
  }
  return limits;
}

export function validRequestId(id: unknown): id is string | number {
  return typeof id === "string" || (typeof id === "number" && Number.isFinite(id));
}
