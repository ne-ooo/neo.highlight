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

describe("output mode transitions", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("rerenders component markup without retokenizing when the style mode changes", () => {
    const tokenizeSpy = vi.spyOn(tokenizer, "tokenize");
    const props = { language: javascript, showLineNumbers: true, children: "const x = 1" };
    const { container, rerender } = render(<Highlight {...props} />);
    expect(container.querySelector("[style]")).not.toBeNull();
    rerender(<Highlight {...props} styleMode="class" />);
    expect(container.querySelector("[style]")).toBeNull();
    expect(tokenizeSpy).toHaveBeenCalledTimes(1);
  });

  it("updates the hook and observer when the style mode changes", () => {
    const Consumer = ({ styleMode }: { styleMode: "inline" | "class" }) => {
      const { html } = useHighlight("const x = 1", javascript, { lineNumbers: true, styleMode });
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };
    const { container, rerender, unmount } = render(<Consumer styleMode="inline" />);
    expect(container.querySelector("[style]")).not.toBeNull();
    rerender(<Consumer styleMode="class" />);
    expect(container.querySelector("[style]")).toBeNull();
    unmount();
    const observeSpy = vi.spyOn(scanner, "observe");
    const auto = render(<AutoHighlight languages={[javascript]} styleMode="inline"><pre><code className="language-js">const x = 1</code></pre></AutoHighlight>);
    auto.rerender(<AutoHighlight languages={[javascript]} styleMode="class"><pre><code className="language-js">const x = 1</code></pre></AutoHighlight>);
    expect(observeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ styleMode: "class" }));
  });
});

describe("structured hook options", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("updates word ranges in both React APIs without retokenizing", () => {
    const spy = vi.spyOn(tokenizer, 'tokenize');
    const code = 'const name = 1';
    const component = render(<Highlight language={javascript} highlightRanges={[{ start: 0, end: 5 }]}>{code}</Highlight>);
    expect(component.container.querySelector('.neo-hl-word-highlight')?.textContent).toBe('const');
    component.rerender(<Highlight language={javascript} highlightRanges={[{ start: 6, end: 10 }]}>{code}</Highlight>);
    expect(component.container.querySelector('.neo-hl-word-highlight')?.textContent).toBe('name');
    expect(spy).toHaveBeenCalledTimes(1);
    component.unmount(); spy.mockClear();
    const Consumer = ({ end }: { end: number }) => {
      const { html } = useHighlight(code, javascript, { highlightRanges: [{ start: 0, end }] });
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };
    const hook = render(<Consumer end={3} />);
    expect(hook.container.querySelector('.neo-hl-word-highlight')?.textContent).toBe('con');
    hook.rerender(<Consumer end={5} />);
    expect(hook.container.querySelector('.neo-hl-word-highlight')?.textContent).toBe('const');
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("updates decorators and line numbering without retokenizing", () => {
    const spy = vi.spyOn(tokenizer, "tokenize");
    const code = "const x = 1";
    const { container, rerender } = render(<Highlight language={javascript} showLineNumbers startLine={10} hooks={{ pre: () => ({ class: "first" }) }}>{code}</Highlight>);
    expect(container.querySelector('.neo-hl-line-number')?.textContent).toBe('10');
    rerender(<Highlight language={javascript} showLineNumbers startLine={20} hooks={{ pre: () => ({ class: "second" }) }}>{code}</Highlight>);
    expect(container.querySelector('pre.second')).not.toBeNull();
    expect(container.querySelector('.neo-hl-line-number')?.textContent).toBe('20');
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("forwards decorators through useHighlight", () => {
    const Consumer = () => {
      const result = useHighlight('const x = 1', javascript, { startLine: 5, lineNumbers: true, hooks: { line: ctx => ({ attributes: { 'data-line': ctx.displayLine } }) } });
      return <div dangerouslySetInnerHTML={{ __html: result.html }} />;
    };
    expect(render(<Consumer />).container.querySelector('[data-line="5"]')).not.toBeNull();
  });
});
