import { createJavaScriptStream } from "./javascript-stream";
import type { JavaScriptStream, JavaScriptStreamOptions, JavaScriptStreamUpdate } from "./javascript-stream";
import { createJavaScriptDocument } from "./javascript-document";
import type { JavaScriptDocument, JavaScriptDocumentUpdate } from "./javascript-document";
import { validRequestId } from "../worker/protocol";

type Identity = { id: string | number; session: string };
type Version = { generation: number; revision: number };
export type JavaScriptSessionRequest = Identity & (
  | { operation: "open"; mode: "stream" | "document"; language: "javascript" | "typescript"; source: string }
  | Version & { operation: "append"; chunk: string }
  | Version & { operation: "edit"; start: number; end: number; text: string }
  | Version & { operation: "finish" | "close" }
);
export type JavaScriptSessionResponse =
  | Identity & Version & { ok: true; data: JavaScriptStreamUpdate | JavaScriptDocumentUpdate | ReturnType<JavaScriptDocument["snapshot"]> | null }
  | { id: string | number; ok: false; error: { code: string; name: string; message: string } };
interface Entry {
  generation: number; revision: number;
  value: { mode: "stream"; session: JavaScriptStream } | { mode: "document"; session: JavaScriptDocument };
}
export interface JavaScriptSessionOptions {
  maxSessions?: number;
  maxTotalCodeUnits?: number;
  maxRequests?: number;
  limits?: Omit<JavaScriptStreamOptions, "language">;
}
class SessionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "SessionError"; }
}
function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer`);
  return value;
}
function retained(entry: Entry): number {
  return entry.value.mode === "stream" ? entry.value.session.metrics.pendingCodeUnits : entry.value.session.metrics.sourceLength;
}

/** Experimental synchronous worker handler. A worker replacement starts with no sessions. */
export function createJavaScriptSessionHandler(options: JavaScriptSessionOptions = {}): {
  handle(request: unknown): JavaScriptSessionResponse;
  dispose(): void;
  readonly sessionCount: number;
  readonly retainedCodeUnits: number;
} {
  const maxSessions = positive(options.maxSessions ?? 8, "maxSessions");
  const maxTotal = positive(options.maxTotalCodeUnits ?? 500_000, "maxTotalCodeUnits");
  const maxRequests = positive(options.maxRequests ?? 10_000, "maxRequests");
  const limits = { ...options.limits };
  const entries = new Map<string, Entry>();
  let generation = 0, requests = 0, disposed = false;
  const total = () => [...entries.values()].reduce((sum, entry) => sum + retained(entry), 0);
  const close = (key: string) => { entries.get(key)?.value.session.dispose(); entries.delete(key); };
  const dispose = () => { disposed = true; for (const key of entries.keys()) close(key); };
  return {
    get sessionCount() { return entries.size; },
    get retainedCodeUnits() { return total(); },
    dispose,
    handle(input) {
      const request = input as Partial<JavaScriptSessionRequest> & Partial<Version> | null;
      const id = validRequestId(request?.id) ? request.id : "invalid-request";
      try {
        if (disposed) throw new SessionError("DISPOSED", "JavaScript session handler is disposed");
        if (requests >= maxRequests) { dispose(); throw new SessionError("REQUEST_LIMIT", "Worker session request limit reached"); }
        requests++;
        if (!request || !validRequestId(request.id) || typeof request.session !== "string" || !request.session.length || request.session.length > 128) {
          throw new SessionError("INVALID_REQUEST", "Invalid JavaScript session request");
        }
        const key = request.session;
        if (request.operation === "open") {
          if (typeof request.source !== "string" || !["stream", "document"].includes(request.mode ?? "")
            || !["javascript", "typescript"].includes(request.language ?? "")) throw new SessionError("INVALID_REQUEST", "Invalid session options");
          if (entries.has(key)) throw new SessionError("SESSION_EXISTS", "JavaScript session already exists");
          if (entries.size >= maxSessions || request.source.length > maxTotal - total()) throw new SessionError("CAPACITY", "Worker session capacity exceeded");
          if (generation >= Number.MAX_SAFE_INTEGER) throw new SessionError("CAPACITY", "Worker session generation limit reached");
          const sessionOptions = { ...limits, language: request.language as "javascript" | "typescript" };
          let entry: Entry;
          let data: Extract<JavaScriptSessionResponse, { ok: true }>["data"];
          if (request.mode === "stream") {
            const session = createJavaScriptStream(sessionOptions);
            data = session.append(request.source);
            entry = { generation: ++generation, revision: 0, value: { mode: "stream", session } };
          } else {
            const session = createJavaScriptDocument(request.source, sessionOptions);
            data = session.snapshot();
            entry = { generation: ++generation, revision: 0, value: { mode: "document", session } };
          }
          entries.set(key, entry);
          return { id, session: key, generation: entry.generation, revision: 0, ok: true, data };
        }
        const entry = entries.get(key);
        if (!entry) throw new SessionError("SESSION_NOT_FOUND", "JavaScript session does not exist");
        if (request.generation !== entry.generation) throw new SessionError("STALE_GENERATION", "JavaScript session generation is stale");
        if (request.revision !== entry.revision) throw new SessionError("STALE_REVISION", "JavaScript session revision is stale");
        if (request.operation === "close") {
          close(key); return { id, session: key, generation: entry.generation, revision: entry.revision, ok: true, data: null };
        }
        const active = entry.value;
        let added: number;
        if (request.operation === "append" && active.mode === "stream" && typeof request.chunk === "string") added = request.chunk.length;
        else if (request.operation === "finish" && active.mode === "stream") added = 0;
        else if (request.operation === "edit" && active.mode === "document" && typeof request.text === "string"
          && Number.isSafeInteger(request.start) && Number.isSafeInteger(request.end) && request.start! >= 0
          && request.end! >= request.start! && request.end! <= active.session.metrics.sourceLength) {
          added = request.text.length - (request.end! - request.start!);
        } else throw new SessionError("INVALID_REQUEST", "Invalid JavaScript session operation");
        if (added > maxTotal - total()) throw new SessionError("CAPACITY", "Worker session source capacity exceeded");
        try {
          let data: Extract<JavaScriptSessionResponse, { ok: true }>["data"];
          if (active.mode === "document" && request.operation === "edit") {
            data = active.session.edit({ revision: entry.revision, start: request.start!, end: request.end!, text: request.text! });
          } else if (active.mode === "stream" && request.operation === "append") data = active.session.append(request.chunk!);
          else if (active.mode === "stream") data = active.session.finish();
          else throw new SessionError("INVALID_REQUEST", "Invalid JavaScript session operation");
          entry.revision++;
          if (request.operation === "finish") close(key);
          return { id, session: key, generation: entry.generation, revision: entry.revision, ok: true, data };
        } catch (error) { close(key); throw error; }
      } catch (error) {
        return { id, ok: false, error: { code: error instanceof SessionError ? error.code : "SESSION_FAILED",
          name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) } };
      }
    },
  };
}
