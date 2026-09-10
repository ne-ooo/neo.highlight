import type { Token, TokenizeOptions } from "../core/types";
import type { HighlightWorkerRequest, HighlightWorkerResponse } from "./protocol";
import { copyLimits } from "./protocol";
export type { HighlightWorkerRequest, HighlightWorkerResponse } from "./protocol";

/** A dedicated browser Worker, or an application adapter with the same lifecycle. */
export interface HighlightWorkerTransport {
  postMessage(message: HighlightWorkerRequest): void;
  terminate(): void | Promise<unknown>;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: "error" | "messageerror", listener: (event: Event) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "error" | "messageerror", listener: (event: Event) => void): void;
}
export interface HighlightWorkerClientOptions {
  /** Return a fresh, exclusively owned worker on each call. Creation is lazy. */
  createWorker: () => HighlightWorkerTransport;
  /** Queue-inclusive deadline, including worker startup. Default: 5,000 ms. */
  timeoutMs?: number;
  /** Total active and queued requests. Default: 32. */
  maxPendingRequests?: number;
  /** Total active and queued UTF-16 source units. Default: 1,000,000. */
  maxPendingCodeUnits?: number;
}
export interface HighlightWorkerCallOptions extends TokenizeOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  /** An accepted request supersedes pending requests with the same key. */
  key?: string | undefined;
}
export type HighlightWorkerErrorCode = "ABORTED" | "TIMEOUT" | "QUEUE_FULL" | "DISPOSED" | "WORKER_ERROR" | "PROTOCOL_ERROR" | "SUPERSEDED";
export class HighlightWorkerError extends Error {
  constructor(public readonly code: HighlightWorkerErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = code === "ABORTED" || code === "SUPERSEDED" ? "AbortError" : code === "TIMEOUT" ? "TimeoutError" : "HighlightWorkerError";
  }
}
export interface HighlightWorkerClient {
  tokenize(code: string, language: string, options?: HighlightWorkerCallOptions): Promise<Token[]>;
  readonly pendingCount: number;
  dispose(): void;
}
interface Pending {
  request: HighlightWorkerRequest;
  key?: string | undefined;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal | undefined;
  abort?: () => void;
  resolve(tokens: Token[]): void;
  reject(error: unknown): void;
}
interface Binding {
  worker: HighlightWorkerTransport;
  message(event: MessageEvent<unknown>): void;
  failure(event: Event): void;
}
function integer(value: number, name: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}
function timeout(value: number): number { return integer(value, "timeoutMs", 1, 2_147_483_647); }

/** Own one worker, run one request at a time, and bound retained queue state. */
export function createHighlightWorkerClient(options: HighlightWorkerClientOptions): HighlightWorkerClient {
  if (typeof options?.createWorker !== "function") throw new TypeError("createWorker must be a function");
  const createWorker = options.createWorker;
  const defaultTimeout = timeout(options.timeoutMs ?? 5_000);
  const maxRequests = integer(options.maxPendingRequests ?? 32, "maxPendingRequests", 1);
  const maxCodeUnits = integer(options.maxPendingCodeUnits ?? 1_000_000, "maxPendingCodeUnits", 0);
  const pending = new Set<Pending>();
  const queue: Pending[] = [];
  const retired = new WeakSet<HighlightWorkerTransport>();
  let active: Pending | undefined;
  let binding: Binding | undefined;
  let codeUnits = 0;
  let sequence = 0;
  let disposed = false;
  let scheduled = false;

  function retire(): void {
    const old = binding;
    binding = undefined;
    if (!old) return;
    retired.add(old.worker);
    // Cleanup must settle requests even if an application transport throws.
    for (const type of ["message", "error", "messageerror"] as const) {
      try {
        if (type === "message") old.worker.removeEventListener(type, old.message);
        else old.worker.removeEventListener(type, old.failure);
      } catch { /* Transport teardown is best effort. */ }
    }
    try { Promise.resolve(old.worker.terminate()).catch(() => {}); } catch { /* Already stopped. */ }
  }
  function schedule(): void {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; pump(); });
  }
  function finish(task: Pending, error?: unknown, tokens?: Token[]): void {
    if (!pending.delete(task)) return;
    codeUnits -= task.request.code.length;
    if (task.timer !== undefined) clearTimeout(task.timer);
    try { if (task.abort) task.signal?.removeEventListener("abort", task.abort); } catch { /* Signal cleanup must not prevent settlement. */ }
    if (active === task) active = undefined;
    else {
      const index = queue.indexOf(task);
      if (index >= 0) queue.splice(index, 1);
    }
    if (tokens !== undefined) task.resolve(tokens);
    else task.reject(error);
    schedule();
  }
  function cancel(task: Pending, error: HighlightWorkerError): void {
    if (!pending.has(task)) return;
    if (active === task) retire();
    finish(task, error);
  }
  function expired(task: Pending): boolean {
    if (performance.now() < task.deadline) return false;
    cancel(task, new HighlightWorkerError("TIMEOUT", "Highlight request exceeded its deadline"));
    return true;
  }
  function connect(): Binding {
    const worker = createWorker();
    if (!worker || (typeof worker !== "object" && typeof worker !== "function") || retired.has(worker)
      || ["postMessage", "terminate", "addEventListener", "removeEventListener"].some(name => typeof worker[name as keyof HighlightWorkerTransport] !== "function")) throw new TypeError("createWorker must return a fresh worker");
    const next: Binding = {
      worker,
      message(event) {
        if (binding !== next || !active) return;
        const task = active;
        if (expired(task)) return;
        const data = event.data as Partial<HighlightWorkerResponse> | null;
        if (!data || data.id !== task.request.id) return;
        if (data.ok === true && Array.isArray(data.tokens)) finish(task, undefined, data.tokens);
        else if (data.ok === false && typeof data.error?.name === "string" && typeof data.error.message === "string") {
          const error = new Error(data.error.message);
          error.name = data.error.name;
          finish(task, error);
        } else cancel(task, new HighlightWorkerError("PROTOCOL_ERROR", "Worker returned an invalid highlight response"));
      },
      failure(event) {
        if (binding !== next) return;
        retire();
        if (active) finish(active, new HighlightWorkerError("WORKER_ERROR", "Highlight worker failed", { cause: event }));
      },
    };
    binding = next;
    if (disposed) { retire(); throw new HighlightWorkerError("DISPOSED", "Highlight worker client is disposed"); }
    try {
      worker.addEventListener("message", next.message);
      worker.addEventListener("error", next.failure);
      worker.addEventListener("messageerror", next.failure);
    } catch (error) { retire(); throw error; }
    return next;
  }
  function pump(): void {
    while (!disposed && !active && queue.length) {
      const task = queue.shift()!;
      if (expired(task)) continue;
      active = task;
      try {
        const current = binding ?? connect();
        if (!pending.has(task) || expired(task)) continue;
        current.worker.postMessage(task.request);
      } catch (error) {
        retire();
        finish(task, new HighlightWorkerError("WORKER_ERROR", "Could not start highlight request", { cause: error }));
      }
    }
  }
  return {
    get pendingCount() { return pending.size; },
    tokenize(code, language, call = {}) {
      return new Promise<Token[]>((resolve, reject) => {
        if (disposed) throw new HighlightWorkerError("DISPOSED", "Highlight worker client is disposed");
        if (typeof code !== "string" || typeof language !== "string") throw new TypeError("Code and language must be strings");
        if (call.key !== undefined && typeof call.key !== "string") throw new TypeError("Request key must be a string");
        if (call.signal !== undefined && (!call.signal || typeof call.signal.aborted !== "boolean"
          || typeof call.signal.addEventListener !== "function" || typeof call.signal.removeEventListener !== "function")) {
          throw new TypeError("signal must be an AbortSignal");
        }
        const limits = copyLimits(call);
        const duration = timeout(call.timeoutMs ?? defaultTimeout);
        if (call.signal?.aborted) throw new HighlightWorkerError("ABORTED", "Highlight request was aborted", { cause: call.signal.reason });
        const replaced = call.key === undefined ? [] : [...pending].filter(task => task.key === call.key);
        const retained = codeUnits - replaced.reduce((sum, task) => sum + task.request.code.length, 0);
        if (pending.size - replaced.length >= maxRequests || code.length > maxCodeUnits - retained) {
          throw new HighlightWorkerError("QUEUE_FULL", "Highlight request exceeds the pending queue limits");
        }
        if (sequence >= Number.MAX_SAFE_INTEGER) throw new RangeError("Highlight request ID limit reached");
        const task: Pending = { request: { id: ++sequence, code, language, ...limits },
          key: call.key, signal: call.signal, deadline: performance.now() + duration, resolve, reject };
        for (const previous of replaced) cancel(previous, new HighlightWorkerError("SUPERSEDED", "Highlight request was superseded"));
        pending.add(task);
        codeUnits += code.length;
        queue.push(task);
        if (task.signal) {
          task.abort = () => cancel(task, new HighlightWorkerError("ABORTED", "Highlight request was aborted", { cause: task.signal?.reason }));
          try {
            task.signal.addEventListener("abort", task.abort, { once: true });
            if (task.signal.aborted) task.abort();
          } catch (error) { finish(task, error); return; }
        }
        if (!pending.has(task)) return;
        task.timer = setTimeout(() => cancel(task, new HighlightWorkerError("TIMEOUT", "Highlight request exceeded its deadline")), duration);
        schedule();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      retire();
      for (const task of pending) finish(task, new HighlightWorkerError("DISPOSED", "Highlight worker client is disposed"));
    },
  };
}
