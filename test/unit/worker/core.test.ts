import { describe, expect, it, vi } from "vitest";
import { createHighlightWorkerHandler, installHighlightWorker } from "../../../src/worker/core";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { tokenize } from "../../../src/core/tokenizer";

const request = { id: 1, code: "const x = 1;", language: " JS " };
describe("selected worker handlers", () => {
  it("preserves tokens and aliases with isolated grammar registries", () => {
    const handler = createHighlightWorkerHandler({ grammars: [javascript] });
    expect(handler(request)).toEqual({ id: 1, ok: true, tokens: tokenize(request.code, javascript) });
    expect(createHighlightWorkerHandler({ grammars: [python] })(request)).toMatchObject({ ok: false, error: { name: "RangeError" } });
  });
  it.each([null, undefined, {}, { ...request, id: NaN }, { ...request, id: Infinity }, { ...request, code: 3 }, { ...request, language: false }])("returns serializable failures for malformed input %j", input => {
    const response = createHighlightWorkerHandler({ grammars: [javascript] })(input);
    expect(response).toMatchObject({ ok: false, error: { name: "TypeError" } }); expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });
  it.each(["maxInputLength", "maxMatchCount", "maxTokenCount", "maxTokenDepth"] as const)("enforces %s ceilings and allows stricter requests", name => {
    const code = name === "maxTokenDepth" ? '`x ${true}`' : request.code;
    const handler = createHighlightWorkerHandler({ grammars: [javascript], limits: { [name]: 0 } });
    expect(handler({ ...request, code, [name]: Infinity })).toMatchObject({ ok: false, error: { name: "RangeError" } });
    const stricter = createHighlightWorkerHandler({ grammars: [javascript], limits: { [name]: 100 } });
    expect(stricter({ ...request, code, [name]: 0 })).toMatchObject({ ok: false, error: { name: "RangeError" } });
  });
  it("copies ceilings and grammar lists at creation", () => {
    const grammars = [javascript]; const limits = { maxInputLength: 0 }; const handle = createHighlightWorkerHandler({ grammars, limits });
    grammars[0] = python; limits.maxInputLength = 100; expect(handle(request)).toMatchObject({ ok: false, error: { message: expect.stringContaining("maxInputLength 0") } });
  });
  it("validates configuration and request limits", () => {
    expect(() => createHighlightWorkerHandler({ grammars: [], limits: { maxInputLength: -1 } })).toThrow(RangeError);
    expect(createHighlightWorkerHandler({ grammars: [javascript] })({ ...request, maxInputLength: "100" })).toMatchObject({ ok: false });
  });
  it("serializes non-Error grammar failures", () => {
    const handle = createHighlightWorkerHandler({ grammars: [{ name: "bad", tokens: { x: { pattern: /x/, matcher() { throw "failure"; } } } }] });
    expect(handle({ ...request, language: "bad" })).toMatchObject({ ok: false, error: { name: "Error", message: "failure" } });
  });
  it("installs only its own listener and provides cleanup", () => {
    const scope = new EventTarget(); const postMessage = vi.fn(); const dispose = installHighlightWorker(Object.assign(scope, { postMessage }), { grammars: [javascript] });
    scope.dispatchEvent(new MessageEvent("message", { data: request })); expect(postMessage).toHaveBeenCalledWith({ id: 1, ok: true, tokens: tokenize(request.code, javascript) });
    dispose(); dispose(); scope.dispatchEvent(new MessageEvent("message", { data: request })); expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
