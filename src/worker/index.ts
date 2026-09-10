import type { Grammar } from "../core/types";
import { createHighlightWorkerHandler } from "./core";
import type { HighlightWorkerRequest, HighlightWorkerResponse } from "./protocol";
import * as grammarExports from "../grammars/index";
export type * from "./protocol";

const bundledGrammars = Object.values(grammarExports).filter(
  (value): value is Grammar => typeof value === "object" && value !== null && "name" in value && "tokens" in value,
);
const handle = createHighlightWorkerHandler({ grammars: bundledGrammars });

/** Legacy all-grammar handler and automatic Web Worker listener. */
export function handleHighlightWorkerRequest(request: HighlightWorkerRequest): HighlightWorkerResponse {
  return handle(request);
}

interface WorkerScope {
  document?: unknown;
  addEventListener?: (type: "message", listener: (event: MessageEvent<HighlightWorkerRequest>) => void) => void;
  postMessage?: (response: HighlightWorkerResponse) => void;
}
const workerScope = globalThis as unknown as WorkerScope;
if (workerScope.document === undefined && typeof workerScope.addEventListener === "function" && typeof workerScope.postMessage === "function") {
  workerScope.addEventListener("message", (event) => {
    workerScope.postMessage?.(handleHighlightWorkerRequest(event.data));
  });
}
