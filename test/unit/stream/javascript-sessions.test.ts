import { expect, it } from "vitest";
import { createJavaScriptSessionHandler } from "../../../src/experimental/javascript-sessions";
import type { JavaScriptSessionResponse } from "../../../src/experimental/javascript-sessions";
import { getPlainText } from "../../../src/core/tokenizer";

function success(response: JavaScriptSessionResponse) {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(response.error.message);
  return response;
}
const open = (session: string, mode = "stream", source = "", language = "javascript") => ({ id: "open-" + session, operation: "open", session, mode, source, language });

it("isolates document and stream revisions and rejects stale generations after ID reuse", () => {
  const handler = createJavaScriptSessionHandler();
  const first = success(handler.handle(open("preview", "document", "const x=1;\n")));
  success(handler.handle(open("stream")));
  const edit = { id: 2, session: "preview", generation: first.generation, revision: 0, operation: "edit", start: 6, end: 7, text: "value" };
  const changed = success(handler.handle(edit)); expect(changed.revision).toBe(1);
  expect(changed.data && "tokens" in changed.data && getPlainText(changed.data.tokens)).toContain("value");
  expect(handler.handle(edit)).toMatchObject({ ok: false, error: { code: "STALE_REVISION" } });
  success(handler.handle({ ...edit, revision: 1, operation: "close" }));
  const next = success(handler.handle(open("preview"))); expect(next.generation).toBeGreaterThan(first.generation);
  expect(handler.handle({ ...edit, operation: "append", chunk: "stale" })).toMatchObject({ ok: false, error: { code: "STALE_GENERATION" } });
  expect(handler.sessionCount).toBe(2); handler.dispose(); expect(handler.sessionCount).toBe(0); expect(handler.retainedCodeUnits).toBe(0);
});
it("finishes streamed output and releases its session", () => {
  const handler = createJavaScriptSessionHandler(); const first = success(handler.handle(open("x", "stream", "const x = ", "typescript")));
  const second = success(handler.handle({ id: 2, operation: "append", session: "x", generation: first.generation, revision: 0, chunk: "1;\n" }));
  expect(second.revision).toBe(1);
  const result = success(handler.handle({ id: 3, operation: "finish", session: "x", generation: first.generation, revision: 1 }));
  expect(result.data).toMatchObject({ done: true }); expect(handler.sessionCount).toBe(0);
  expect(handler.handle({ id: 4, operation: "finish", session: "x", generation: first.generation, revision: 2 })).toMatchObject({ error: { code: "SESSION_NOT_FOUND" } });
});
it("bounds total retained source and rejects excess work without mutating accepted sessions", () => {
  const handler = createJavaScriptSessionHandler({ maxSessions: 2, maxTotalCodeUnits: 4 });
  const first = success(handler.handle(open("x", "document", "abc"))); success(handler.handle(open("y", "stream", "d")));
  expect(handler.retainedCodeUnits).toBe(4);
  expect(handler.handle(open("z"))).toMatchObject({ error: { code: "CAPACITY" } });
  expect(handler.handle({ id: 2, operation: "edit", session: "x", generation: first.generation, revision: 0, start: 0, end: 0, text: "z" })).toMatchObject({ error: { code: "CAPACITY" } });
  success(handler.handle({ id: 3, operation: "edit", session: "x", generation: first.generation, revision: 0, start: 0, end: 2, text: "" }));
  expect(handler.retainedCodeUnits).toBe(2);
});
it("closes only the session that exhausts its tokenizer budget", () => {
  const handler = createJavaScriptSessionHandler({ limits: { maxTokenCount: 0 } });
  const first = success(handler.handle(open("x"))); success(handler.handle(open("y")));
  const error = handler.handle({ id: 2, operation: "append", session: "x", generation: first.generation, revision: 0, chunk: "const x=1;\n" });
  expect(error).toMatchObject({ error: { code: "SESSION_FAILED", name: "RangeError" } }); expect(handler.sessionCount).toBe(1);
});
it("bounds total requests and clears sessions on exhaustion", () => {
  const handler = createJavaScriptSessionHandler({ maxRequests: 1 }); success(handler.handle(open("x")));
  expect(handler.handle(open("y"))).toMatchObject({ error: { code: "REQUEST_LIMIT" } });
  expect(handler.sessionCount).toBe(0); expect(handler.handle(open("z"))).toMatchObject({ error: { code: "DISPOSED" } });
});
it("rejects malformed protocol fields and incompatible operations", () => {
  const handler = createJavaScriptSessionHandler(); const first = success(handler.handle(open("x")));
  for (const request of [null, {}, { ...open("z"), id: Infinity }, open(""), open("x".repeat(129)), open("z", "invalid"), open("z", "stream", "", "tsx"),
    { id: 2, operation: "edit", session: "x", generation: first.generation, revision: 0, start: 0, end: 0, text: "bad" },
    { id: 3, operation: "append", session: "x", generation: first.generation, revision: 0, chunk: 1 }]) {
    expect(handler.handle(request)).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  }
  expect(handler.handle(open("x"))).toMatchObject({ error: { code: "SESSION_EXISTS" } });
  expect(() => createJavaScriptSessionHandler({ maxSessions: 0 })).toThrow(RangeError);
  expect(() => createJavaScriptSessionHandler({ maxRequests: Infinity })).toThrow(RangeError);
  expect(createJavaScriptSessionHandler({ limits: { maxInputLength: 0 } }).handle(open("x", "document", "x"))).toMatchObject({ error: { code: "SESSION_FAILED" } });
});
