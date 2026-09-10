import type { Grammar, TokenizeOptions } from "../core/types";
import { createRegistry, tokenize } from "../core/tokenizer";
import { normalizeGrammarIdentifier } from "../core/grammar-utils";
import { copyLimits, limitNames, validRequestId } from "./protocol";
import type { HighlightWorkerRequest, HighlightWorkerResponse } from "./protocol";
export type * from "./protocol";

export interface HighlightWorkerOptions {
  grammars: readonly Grammar[];
  /** Optional ceilings. A request can lower these limits, but cannot raise them. */
  limits?: TokenizeOptions;
}
export interface HighlightWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: HighlightWorkerResponse): void;
}

/** Create an isolated handler without importing grammars or installing global listeners. */
export function createHighlightWorkerHandler(options: HighlightWorkerOptions): (request: unknown) => HighlightWorkerResponse {
  const registry = createRegistry([...options.grammars]);
  const ceilings = copyLimits(options.limits ?? {});
  return (input) => {
    const request = input as Partial<HighlightWorkerRequest> | null | undefined;
    const id = validRequestId(request?.id) ? request.id : "invalid-request";
    try {
      if (!request || !validRequestId(request.id) || typeof request.code !== "string" || typeof request.language !== "string") {
        throw new TypeError("Invalid highlight worker request");
      }
      const grammar = registry.get(normalizeGrammarIdentifier(request.language));
      if (!grammar) throw new RangeError(`Unknown language "${request.language}"`);
      const limits = copyLimits(request);
      for (const name of limitNames) {
        if (ceilings[name] !== undefined) limits[name] = Math.min(limits[name] ?? Infinity, ceilings[name]!);
      }
      return { id, ok: true, tokens: tokenize(request.code, grammar, limits) };
    } catch (error) {
      return { id, ok: false, error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      } };
    }
  };
}

/** Install a selected-grammar worker. The returned function removes its listener. */
export function installHighlightWorker(scope: HighlightWorkerScope, options: HighlightWorkerOptions): () => void {
  const handle = createHighlightWorkerHandler(options);
  const listener = (event: MessageEvent<unknown>) => scope.postMessage(handle(event.data));
  scope.addEventListener("message", listener);
  return () => scope.removeEventListener("message", listener);
}
