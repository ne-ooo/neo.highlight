import { describe, it, expect } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { Highlight } from "../../../src/react/highlight";
import { AutoHighlight } from "../../../src/react/auto-highlight";
import {
  HighlightProvider,
  useHighlightContext,
} from "../../../src/react/context";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { githubDark } from "../../../src/themes/github-dark";
import { githubLight } from "../../../src/themes/github-light";

describe("Highlight component", () => {
  afterEach(() => cleanup());

  it("should render highlighted code", () => {
    const { container } = render(
      <Highlight language={javascript}>{"const x = 42;"}</Highlight>,
    );
    expect(container.innerHTML).toContain("neo-hl-keyword");
    expect(container.innerHTML).toContain("neo-hl-number");
  });

  it("should render pre/code wrapper", () => {
    const { container } = render(
      <Highlight language={javascript}>{"const x = 42;"}</Highlight>,
    );
    expect(container.querySelector("pre")).toBeTruthy();
    expect(container.querySelector("code")).toBeTruthy();
  });

  it("should include data-language attribute", () => {
    const { container } = render(
      <Highlight language={javascript}>{"const x = 42;"}</Highlight>,
    );
    expect(container.querySelector("[data-language]")?.getAttribute("data-language")).toBe("javascript");
  });

  it("should apply theme when provided", () => {
    const { container } = render(
      <Highlight language={javascript} theme={githubDark}>
        {"const x = 42;"}
      </Highlight>,
    );
    expect(container.innerHTML).toContain(githubDark.background);
  });

  it("should show line numbers when enabled", () => {
    const { container } = render(
      <Highlight language={javascript} showLineNumbers>
        {"const x = 42;\nlet y = 10;"}
      </Highlight>,
    );
    expect(container.innerHTML).toContain("neo-hl-line-number");
  });

  it("should highlight specific lines", () => {
    const { container } = render(
      <Highlight language={javascript} highlightLines={[2]}>
        {"line 1\nline 2\nline 3"}
      </Highlight>,
    );
    expect(container.innerHTML).toContain("neo-hl-line-highlighted");
  });

  it("should accept className and style props", () => {
    const { container } = render(
      <Highlight
        language={javascript}
        className="my-code"
        style={{ maxWidth: "600px" }}
      >
        {"const x = 42;"}
      </Highlight>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toBe("my-code");
    expect(wrapper.style.maxWidth).toBe("600px");
  });

  it("should use custom class prefix", () => {
    const { container } = render(
      <Highlight language={javascript} classPrefix="hl">
        {"const x = 42;"}
      </Highlight>,
    );
    expect(container.innerHTML).toContain("hl-keyword");
    expect(container.innerHTML).not.toContain("neo-hl-keyword");
  });
});

describe("HighlightProvider", () => {
  afterEach(() => cleanup());

  it("should provide theme context to Highlight children", () => {
    const { container } = render(
      <HighlightProvider theme={githubDark}>
        <Highlight language={javascript}>{"const x = 42;"}</Highlight>
      </HighlightProvider>,
    );
    expect(container.innerHTML).toContain(githubDark.background);
  });

  it("should provide lineNumbers context", () => {
    const { container } = render(
      <HighlightProvider lineNumbers>
        <Highlight language={javascript}>{"const x = 42;\nlet y = 10;"}</Highlight>
      </HighlightProvider>,
    );
    expect(container.innerHTML).toContain("neo-hl-line-number");
  });

  it("should allow Highlight to override provider settings", () => {
    const { container } = render(
      <HighlightProvider lineNumbers>
        <Highlight language={javascript} showLineNumbers={false}>
          {"const x = 42;\nlet y = 10;"}
        </Highlight>
      </HighlightProvider>,
    );
    expect(container.innerHTML).not.toContain("neo-hl-line-number");
  });

  it("does not redraw memoized consumers when default values stay unchanged", () => {
    let renderCount = 0;
    const Consumer = React.memo(function Consumer() {
      useHighlightContext();
      renderCount++;
      return <span>consumer</span>;
    });

    const { rerender } = render(
      <HighlightProvider>
        <Consumer />
      </HighlightProvider>,
    );
    expect(renderCount).toBe(1);

    rerender(
      <HighlightProvider>
        <Consumer />
      </HighlightProvider>,
    );
    expect(renderCount).toBe(1);
  });
});

describe("AutoHighlight component", () => {
  afterEach(() => cleanup());

  it("should render a container div with children", () => {
    const { container } = render(
      <AutoHighlight languages={[javascript]}>
        <p>Hello world</p>
      </AutoHighlight>,
    );
    expect(container.querySelector("p")?.textContent).toBe("Hello world");
  });

  it("should accept className and style props", () => {
    const { container } = render(
      <AutoHighlight
        languages={[javascript]}
        className="auto-hl"
        style={{ padding: "16px" }}
      >
        <p>Content</p>
      </AutoHighlight>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toBe("auto-hl");
    expect(wrapper.style.padding).toBe("16px");
  });

  it("should highlight code blocks within children", () => {
    const { container } = render(
      <AutoHighlight languages={[javascript]}>
        <pre>
          <code className="language-js">{"const x = 42;"}</code>
        </pre>
      </AutoHighlight>,
    );
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("neo-hl-keyword");
  });

  it("should refresh existing blocks when rendering props and grammars change", () => {
    const source = "const x = 42;\nlet y = 10;";
    const replacement = {
      name: "javascript",
      aliases: ["js"],
      tokens: { marker: /\bx\b/ },
    };
    const { container, rerender } = render(
      <AutoHighlight languages={[javascript]} theme={githubDark}>
        <pre><code className="language-js">{source}</code></pre>
      </AutoHighlight>,
    );

    const code = container.querySelector("code") as HTMLElement;
    expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("const");
    const initialColor = code.style.color;

    rerender(
      <AutoHighlight
        languages={[replacement]}
        theme={githubLight}
        lineNumbers
        classPrefix="refreshed-hl"
      >
        <pre><code className="language-js">{source}</code></pre>
      </AutoHighlight>,
    );

    expect(code.textContent).toContain(source.split("\n")[0]);
    expect(code.querySelector(".refreshed-hl-marker")?.textContent).toBe("x");
    expect(code.querySelectorAll(".refreshed-hl-line-number")).toHaveLength(2);
    expect(code.classList.contains("neo-hl")).toBe(false);
    expect(code.style.color).not.toBe("");
    expect(code.style.color).not.toBe(initialColor);
  });

  it("should refresh when automatic detection is enabled", () => {
    const source = "const greet = (name) => console.log(name);";
    const { container, rerender } = render(
      <AutoHighlight languages={[javascript]} autoDetect={false}>
        <pre><code>{source}</code></pre>
      </AutoHighlight>,
    );
    const code = container.querySelector("code")!;
    expect(code.hasAttribute("data-neo-highlighted")).toBe(false);

    rerender(
      <AutoHighlight languages={[javascript]} autoDetect>
        <pre><code>{source}</code></pre>
      </AutoHighlight>,
    );

    expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("const");
  });
});
