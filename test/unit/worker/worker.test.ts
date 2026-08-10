import { describe, expect, it } from "vitest";
import { getPlainText } from "../../../src/core/tokenizer";
import { handleHighlightWorkerRequest } from "../../../src/worker/index";

describe("highlight worker", () => {
  it("tokenizes a built-in language by alias", () => {
    const response = handleHighlightWorkerRequest({
      id: 1,
      code: "const x = 42;",
      language: "js",
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(getPlainText(response.tokens)).toBe("const x = 42;");
    }
  });

  it("normalizes case and surrounding whitespace in language names", () => {
    const response = handleHighlightWorkerRequest({
      id: "normalized",
      code: "const x = 42;",
      language: "  JavaScript  ",
    });

    expect(response.ok).toBe(true);
  });

  it("returns a serializable error for an unknown language", () => {
    const response = handleHighlightWorkerRequest({
      id: "unknown",
      code: "hello",
      language: "not-a-language",
    });

    expect(response).toEqual({
      id: "unknown",
      ok: false,
      error: {
        name: "RangeError",
        message: 'Unknown language "not-a-language"',
      },
    });
  });

  it("enforces the requested input limit off the main thread", () => {
    const response = handleHighlightWorkerRequest({
      id: 2,
      code: "const x = 42;",
      language: "javascript",
      maxInputLength: 5,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.name).toBe("RangeError");
      expect(response.error.message).toContain("maxInputLength");
    }
  });

  it("enforces tokenizer work limits off the main thread", () => {
    const response = handleHighlightWorkerRequest({
      id: 3,
      code: "const x = 42;",
      language: "javascript",
      maxMatchCount: 0,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.name).toBe("RangeError");
      expect(response.error.message).toContain("maxMatchCount");
    }
  });
});
