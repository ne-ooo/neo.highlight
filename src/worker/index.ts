import type { Grammar, Token, TokenizeOptions } from "../core/types";
import { createRegistry, tokenize } from "../core/tokenizer";
import { normalizeGrammarIdentifier } from "../core/grammar-utils";
import * as grammarExports from "../grammars/index";

export interface HighlightWorkerRequest {
  id: string | number;
  code: string;
  language: string;
  maxInputLength?: TokenizeOptions["maxInputLength"];
}

export interface HighlightWorkerSuccess {
  id: string | number;
  ok: true;
  tokens: Token[];
}

export interface HighlightWorkerFailure {
  id: string | number;
  ok: false;
  error: {
    name: string;
    message: string;
  };
}

export type HighlightWorkerResponse =
  | HighlightWorkerSuccess
  | HighlightWorkerFailure;

const bundledGrammars = Object.values(grammarExports).filter(
  (value): value is Grammar =>
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "tokens" in value,
);
const grammarRegistry = createRegistry(bundledGrammars);

/**
 * Process one worker request. This is exported for custom worker runtimes and
 * tests; importing this entry inside a Web Worker also installs a listener.
 */
export function handleHighlightWorkerRequest(
  request: HighlightWorkerRequest,
): HighlightWorkerResponse {
  try {
    if (
      !request ||
      (typeof request.id !== "string" && typeof request.id !== "number") ||
      typeof request.code !== "string" ||
      typeof request.language !== "string"
    ) {
      throw new TypeError("Invalid highlight worker request");
    }

    const grammar = grammarRegistry.get(
      normalizeGrammarIdentifier(request.language),
    );
    if (!grammar) {
      throw new RangeError(`Unknown language "${request.language}"`);
    }

    return {
      id: request.id,
      ok: true,
      tokens: tokenize(request.code, grammar, {
        maxInputLength: request.maxInputLength,
      }),
    };
  } catch (error) {
    return {
      id: request?.id ?? "invalid-request",
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

interface WorkerScope {
  document?: unknown;
  addEventListener?: (
    type: "message",
    listener: (event: MessageEvent<HighlightWorkerRequest>) => void,
  ) => void;
  postMessage?: (response: HighlightWorkerResponse) => void;
}

const workerScope = globalThis as unknown as WorkerScope;
if (
  workerScope.document === undefined &&
  typeof workerScope.addEventListener === "function" &&
  typeof workerScope.postMessage === "function"
) {
  workerScope.addEventListener("message", (event) => {
    workerScope.postMessage?.(handleHighlightWorkerRequest(event.data));
  });
}
