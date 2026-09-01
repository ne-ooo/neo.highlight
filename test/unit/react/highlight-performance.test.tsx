import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import * as tokenizer from "../../../src/core/tokenizer";
import * as renderer from "../../../src/core/renderer";
import * as scanner from "../../../src/core/scanner";
import { Highlight } from "../../../src/react/highlight";
import { AutoHighlight } from "../../../src/react/auto-highlight";
import { useHighlight } from "../../../src/react/use-highlight";
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

  it("does not render again for equivalent line-option arrays", () => {
    const renderSpy = vi.spyOn(renderer, "renderToHTML");
    const code = "const x = 42;\nlet y = 10;";
    const { rerender } = render(
      <Highlight
        language={javascript}
        highlightLines={[2]}
        diffHighlight={{ added: [1], modified: [2] }}
      >
        {code}
      </Highlight>,
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(
      <Highlight
        language={javascript}
        highlightLines={[2]}
        diffHighlight={{ added: [1], modified: [2] }}
      >
        {code}
      </Highlight>,
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("stabilizes equivalent line options in useHighlight", () => {
    const renderSpy = vi.spyOn(renderer, "renderToHTML");
    const Consumer = ({ lines }: { lines: number[] }) => {
      const result = useHighlight("const x = 42;", javascript, {
        highlightLines: lines,
        diffHighlight: { added: [1] },
      });
      return <div dangerouslySetInnerHTML={{ __html: result.html }} />;
    };
    const { rerender } = render(<Consumer lines={[1]} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Consumer lines={[1]} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("does not restart AutoHighlight for an equivalent language array", () => {
    const observeSpy = vi.spyOn(scanner, "observe");
    const source = "const x = 42;";
    const { rerender } = render(
      <AutoHighlight languages={[javascript]}>
        <pre><code className="language-js">{source}</code></pre>
      </AutoHighlight>,
    );
    expect(observeSpy).toHaveBeenCalledTimes(1);

    rerender(
      <AutoHighlight languages={[javascript]}>
        <pre><code className="language-js">{source}</code></pre>
      </AutoHighlight>,
    );
    expect(observeSpy).toHaveBeenCalledTimes(1);
  });
});
