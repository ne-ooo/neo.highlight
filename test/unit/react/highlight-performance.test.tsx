import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import * as tokenizer from "../../../src/core/tokenizer";
import { Highlight } from "../../../src/react/highlight";
import { javascript } from "../../../src/grammars/javascript";

describe("Highlight memoization", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not tokenize again when only rendering options change", () => {
    const tokenizeSpy = vi.spyOn(tokenizer, "tokenize");
    const code = "const x = 42;\nlet y = 10;";
    const { rerender } = render(
      <Highlight language={javascript} highlightLines={[1]}>
        {code}
      </Highlight>,
    );
    expect(tokenizeSpy).toHaveBeenCalledTimes(1);

    rerender(
      <Highlight
        language={javascript}
        highlightLines={[2]}
        diffHighlight={{ added: [1] }}
      >
        {code}
      </Highlight>,
    );
    expect(tokenizeSpy).toHaveBeenCalledTimes(1);
  });
});
