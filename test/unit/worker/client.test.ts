import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHighlightWorkerClient, HighlightWorkerError } from "../../../src/worker/client";
import type { HighlightWorkerClient, HighlightWorkerTransport } from "../../../src/worker/client";
import type { HighlightWorkerRequest } from "../../../src/worker/protocol";

class Transport {
  listeners = new Map<string, Set<(event: any) => void>>();
  sent: HighlightWorkerRequest[] = [];
  terminate = vi.fn();
  postMessage = vi.fn((message: HighlightWorkerRequest) => { this.sent.push(structuredClone(message)); });
  addEventListener = vi.fn((type: string, listener: (event: any) => void) => {
    const listeners = this.listeners.get(type) ?? new Set(); listeners.add(listener); this.listeners.set(type, listeners);
  });
  removeEventListener = vi.fn((type: string, listener: (event: any) => void) => { this.listeners.get(type)?.delete(listener); });
  emit(type: string, data?: unknown) { for (const listener of [...this.listeners.get(type) ?? []]) listener({ data, type }); }
  succeed(tokens: unknown = [this.sent.at(-1)?.code]) { this.emit("message", { id: this.sent.at(-1)?.id, ok: true, tokens }); }
}
const clients: HighlightWorkerClient[] = [];
const tick = async () => { await vi.advanceTimersByTimeAsync(0); };
function setup(options = {}) {
  const workers: Transport[] = [];
  const createWorker = vi.fn(() => { const worker = new Transport(); workers.push(worker); return worker; });
  const client = createHighlightWorkerClient({ createWorker, ...options });
  clients.push(client);
  return { client, workers, createWorker };
}
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
afterEach(() => { for (const client of clients.splice(0)) client.dispose(); vi.useRealTimers(); });

describe("worker client lifecycle", () => {
  it("starts lazily, preserves FIFO order, and reuses its worker", async () => {
    const { client, workers, createWorker } = setup();
    expect(createWorker).not.toHaveBeenCalled();
    const first = client.tokenize("one", "js", { maxTokenCount: 9 });
    const second = client.tokenize("two", "js");
    expect(client.pendingCount).toBe(2); await tick();
    expect(workers[0].sent).toEqual([{ id: 1, code: "one", language: "js", maxTokenCount: 9 }]);
    workers[0].succeed(); expect(await first).toEqual(["one"]); await tick();
    expect(workers[0].sent[1].code).toBe("two"); workers[0].succeed(); expect(await second).toEqual(["two"]);
    expect(client.pendingCount).toBe(0); expect(createWorker).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects remote tokenization errors and continues with the same worker", async () => {
    const { client, workers } = setup(); const result = client.tokenize("x", "unknown").catch(e => e); await tick();
    workers[0].emit("message", { id: 1, ok: false, error: { name: "RangeError", message: "Unknown language" } });
    expect(await result).toMatchObject({ name: "RangeError", message: "Unknown language" });
    const next = client.tokenize("ok", "js"); await tick(); workers[0].succeed(); await next; expect(workers).toHaveLength(1);
  });
  it("ignores unrelated, duplicate, and retired-worker replies", async () => {
    const { client, workers } = setup(); const controller = new AbortController();
    const old = client.tokenize("old", "js", { signal: controller.signal }).catch(e => e); await tick();
    const oldListener = [...workers[0].listeners.get("message")!][0];
    workers[0].emit("message", null); workers[0].emit("message", { id: 99, ok: true, tokens: ["bad"] });
    expect(client.pendingCount).toBe(1); controller.abort(); expect(await old).toMatchObject({ code: "ABORTED" });
    const next = client.tokenize("new", "js"); await tick(); oldListener({ data: { id: 2, ok: true, tokens: ["stale"] } });
    workers[1].emit("message", { id: 1, ok: true, tokens: ["duplicate"] });
    expect(client.pendingCount).toBe(1); workers[1].succeed(); expect(await next).toEqual(["new"]);
  });
  it("aborts only queued work without terminating an active worker", async () => {
    const { client, workers } = setup(); const controller = new AbortController();
    const first = client.tokenize("one", "js"); const second = client.tokenize("two", "js", { signal: controller.signal }).catch(e => e);
    await tick(); controller.abort("reason"); expect(await second).toMatchObject({ code: "ABORTED", cause: "reason" });
    expect(workers[0].terminate).not.toHaveBeenCalled(); workers[0].succeed(); await first; expect(client.pendingCount).toBe(0);
  });
  it("rejects already-aborted requests without creating a worker", async () => {
    const { client, createWorker } = setup(); const controller = new AbortController(); controller.abort();
    await expect(client.tokenize("x", "js", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    await tick(); expect(createWorker).not.toHaveBeenCalled();
  });
  it("enforces a queue-inclusive deadline and preserves unrelated work", async () => {
    const { client, workers } = setup({ timeoutMs: 100 });
    const first = client.tokenize("active", "js").catch(e => e);
    const queued = client.tokenize("queued", "js", { timeoutMs: 10 }).catch(e => e);
    const surviving = client.tokenize("next", "js", { timeoutMs: 1000 });
    await tick(); await vi.advanceTimersByTimeAsync(10); expect(await queued).toMatchObject({ code: "TIMEOUT" });
    expect(workers[0].terminate).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(90);
    expect(await first).toMatchObject({ name: "TimeoutError" }); expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(workers[1].sent[0].code).toBe("next"); workers[1].succeed(); await surviving;
  });
  it("rejects expired replies even before the timeout callback runs", async () => {
    const { client, workers } = setup({ timeoutMs: 10 }); const result = client.tokenize("x", "js").catch(e => e); await tick();
    vi.spyOn(performance, "now").mockReturnValueOnce(20); workers[0].succeed();
    expect(await result).toMatchObject({ code: "TIMEOUT" });
  });
  it("drops expired queue entries before worker creation", async () => {
    const { client, createWorker } = setup({ timeoutMs: 10 }); const result = client.tokenize("x", "js").catch(e => e);
    vi.spyOn(performance, "now").mockReturnValueOnce(20); await tick(); expect(await result).toMatchObject({ code: "TIMEOUT" });
    expect(createWorker).not.toHaveBeenCalled();
  });
  it("counts worker startup against the deadline", async () => {
    const worker = new Transport(); const client = createHighlightWorkerClient({ timeoutMs: 10, createWorker: () => {
      vi.spyOn(performance, "now").mockReturnValueOnce(20); return worker;
    } }); clients.push(client);
    const result = client.tokenize("x", "js").catch(e => e); await tick(); expect(await result).toMatchObject({ code: "TIMEOUT" });
    expect(worker.postMessage).not.toHaveBeenCalled(); expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it("coalesces accepted requests by key and keeps unrelated requests", async () => {
    const { client, workers } = setup({ maxPendingRequests: 2, maxPendingCodeUnits: 6 });
    const old = client.tokenize("old", "js", { key: "editor" }).catch(e => e);
    const other = client.tokenize("xyz", "js", { key: "other" });
    const replacement = client.tokenize("new", "js", { key: "editor" });
    expect(await old).toMatchObject({ code: "SUPERSEDED" }); await tick();
    workers[0].succeed(); expect(await other).toEqual(["xyz"]); await tick(); workers[0].succeed(); expect(await replacement).toEqual(["new"]);
  });
  it("replaces active requests by key and terminates stale computation", async () => {
    const { client, workers } = setup(); const old = client.tokenize("old", "js", { key: "editor" }).catch(e => e); await tick();
    const next = client.tokenize("new", "js", { key: "editor" }); expect(await old).toMatchObject({ code: "SUPERSEDED" }); await tick();
    expect(workers[0].terminate).toHaveBeenCalledTimes(1); workers[1].succeed(); expect(await next).toEqual(["new"]);
  });
  it("keeps the original request when a replacement is rejected", async () => {
    const { client, workers } = setup({ maxPendingRequests: 1, maxPendingCodeUnits: 3 }); const original = client.tokenize("abc", "js", { key: "x" });
    await expect(client.tokenize("abcd", "js", { key: "x" })).rejects.toMatchObject({ code: "QUEUE_FULL" });
    await expect(client.tokenize("a", "js")).rejects.toMatchObject({ code: "QUEUE_FULL" });
    await expect(client.tokenize("a", "js", { key: "x", timeoutMs: 0 })).rejects.toBeInstanceOf(RangeError);
    await tick(); workers[0].succeed(); await original;
  });
  it.each(["error", "messageerror"])("recovers after %s without retrying failed work", async type => {
    const { client, workers } = setup(); const result = client.tokenize("x", "js").catch(e => e); const next = client.tokenize("y", "js");
    await tick(); const oldFailure = [...workers[0].listeners.get(type)!][0]; workers[0].emit(type);
    expect(await result).toMatchObject({ code: "WORKER_ERROR" }); await tick(); oldFailure({ type }); workers[1].succeed(); expect(await next).toEqual(["y"]);
  });
  it("replaces an idle crashed worker on the next request", async () => {
    const { client, workers } = setup(); const result = client.tokenize("x", "js"); await tick(); workers[0].succeed(); await result;
    workers[0].emit("error"); const next = client.tokenize("y", "js"); await tick(); workers[1].succeed(); await next;
  });
  it.each([{ ok: true, tokens: {} }, { ok: false, error: {} }, { ok: "yes" }])("rejects malformed matching responses: %j", async response => {
    const { client, workers } = setup(); const result = client.tokenize("x", "js").catch(e => e); await tick(); workers[0].emit("message", { id: 1, ...response });
    expect(await result).toMatchObject({ code: "PROTOCOL_ERROR" }); expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
  it("recovers after a postMessage cloning error", async () => {
    const { client, workers } = setup(); const first = client.tokenize("x", "js"); await tick(); workers[0].succeed(); await first;
    workers[0].postMessage.mockImplementationOnce(() => { throw new Error("clone"); });
    const failed = client.tokenize("bad", "js").catch(e => e); const next = client.tokenize("ok", "js"); await tick();
    expect(await failed).toMatchObject({ code: "WORKER_ERROR" }); workers[1].succeed(); await next;
  });
  it("settles factory failures without leaving pending requests", async () => {
    const client = createHighlightWorkerClient({ createWorker: () => { throw new Error("factory"); } }); clients.push(client);
    const result = client.tokenize("x", "js").catch(e => e); await tick(); expect(await result).toMatchObject({ code: "WORKER_ERROR" }); expect(client.pendingCount).toBe(0);
  });
  it("rejects a reused terminated worker", async () => {
    const worker = new Transport(); const client = createHighlightWorkerClient({ createWorker: () => worker, timeoutMs: 1 }); clients.push(client);
    const first = client.tokenize("x", "js").catch(e => e); await vi.advanceTimersByTimeAsync(1); await first;
    const second = client.tokenize("x", "js").catch(e => e); await tick(); expect(await second).toMatchObject({ code: "WORKER_ERROR" });
  });
  it("cleans up partial listener installation", async () => {
    const worker = new Transport(); worker.addEventListener.mockImplementationOnce(() => { throw new Error("listen"); });
    const client = createHighlightWorkerClient({ createWorker: () => worker }); clients.push(client);
    const result = client.tokenize("x", "js").catch(e => e); await tick(); expect(await result).toMatchObject({ code: "WORKER_ERROR" }); expect(worker.terminate).toHaveBeenCalled();
  });
  it("disposes active and queued requests and removes listeners and timers", async () => {
    const { client, workers } = setup(); const controller = new AbortController(); const remove = vi.spyOn(controller.signal, "removeEventListener");
    const first = client.tokenize("x", "js", { signal: controller.signal }).catch(e => e); const second = client.tokenize("y", "js").catch(e => e);
    await tick(); client.dispose(); client.dispose(); expect(await first).toMatchObject({ code: "DISPOSED" }); expect(await second).toMatchObject({ code: "DISPOSED" });
    expect(remove).toHaveBeenCalled(); expect(workers[0].terminate).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0); expect(client.pendingCount).toBe(0);
    await expect(client.tokenize("z", "js")).rejects.toMatchObject({ code: "DISPOSED" });
  });
  it("does not create a worker after immediate disposal", async () => {
    const { client, createWorker } = setup(); const result = client.tokenize("x", "js").catch(e => e); client.dispose(); await tick(); await result; expect(createWorker).not.toHaveBeenCalled();
  });
  it("releases queue capacity after partial abort listener installation fails", async () => {
    const { client, workers } = setup({ maxPendingRequests: 1, maxPendingCodeUnits: 3 });
    const controller = new AbortController();
    const listen = controller.signal.addEventListener.bind(controller.signal);
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    vi.spyOn(controller.signal, "addEventListener").mockImplementation((...args) => { listen(...args); throw new Error("signal listener"); });
    await expect(client.tokenize("bad", "js", { signal: controller.signal })).rejects.toThrow("signal listener");
    expect(remove).toHaveBeenCalledTimes(1); expect(client.pendingCount).toBe(0); expect(vi.getTimerCount()).toBe(0);
    const next = client.tokenize("ok", "js"); await tick(); workers[0].succeed(); expect(await next).toEqual(["ok"]);
  });
  it("settles every request even when abort listener removal throws", async () => {
    const { client, workers } = setup(); const controller = new AbortController();
    const first = client.tokenize("one", "js", { signal: controller.signal }).catch(e => e);
    const second = client.tokenize("two", "js").catch(e => e); await tick();
    vi.spyOn(controller.signal, "removeEventListener").mockImplementation(() => { throw new Error("signal cleanup"); });
    client.dispose(); expect(await first).toMatchObject({ code: "DISPOSED" }); expect(await second).toMatchObject({ code: "DISPOSED" });
    controller.abort(); expect(client.pendingCount).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
  it("terminates a worker if the factory disposes its client", async () => {
    const worker = new Transport();
    const client = createHighlightWorkerClient({ createWorker: () => { client.dispose(); return worker; } }); clients.push(client);
    const result = client.tokenize("x", "js").catch(e => e); await tick();
    expect(await result).toMatchObject({ code: "DISPOSED" }); expect(client.pendingCount).toBe(0);
    expect(worker.terminate).toHaveBeenCalledTimes(1); expect(worker.postMessage).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("tolerates application teardown failures", async () => {
    const { client, workers } = setup(); const result = client.tokenize("x", "js").catch(e => e); await tick();
    workers[0].removeEventListener.mockImplementation(() => { throw new Error("remove"); }); workers[0].terminate.mockImplementation(() => { throw new Error("terminate"); });
    client.dispose(); expect(await result).toMatchObject({ code: "DISPOSED" });
  });
  it("tolerates a rejected asynchronous termination", async () => {
    const { client, workers } = setup(); const result = client.tokenize("x", "js").catch(e => e); await tick();
    workers[0].terminate.mockReturnValue(Promise.reject(new Error("terminate"))); client.dispose(); await result; await tick();
  });
  it.each([{ timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 2147483648 }, { maxPendingRequests: 0 }, { maxPendingCodeUnits: -1 }])("rejects invalid configuration %j", options => {
    expect(() => createHighlightWorkerClient({ createWorker: () => new Transport(), ...options })).toThrow(RangeError);
  });
  it("rejects a missing factory and malformed call options", async () => {
    expect(() => createHighlightWorkerClient({} as any)).toThrow(TypeError);
    const { client } = setup();
    for (const args of [[1, "js"], ["x", null], ["x", "js", { key: 1 }], ["x", "js", { signal: {} }], ["x", "js", { maxTokenDepth: -1 }]] as any[]) {
      await expect(client.tokenize(args[0], args[1], args[2])).rejects.toBeInstanceOf(Error);
    }
    expect(client.pendingCount).toBe(0);
  });
  it("retains standard Error behavior and error codes", () => {
    const error = new HighlightWorkerError("TIMEOUT", "deadline"); expect(error).toBeInstanceOf(Error); expect(error.code).toBe("TIMEOUT");
  });
});
