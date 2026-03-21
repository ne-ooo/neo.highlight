/* -------------------------------------------------------------------------------------------------
 * Comparison Benchmarks — neo.highlight vs Prism.js vs highlight.js
 *
 * Measures end-to-end highlighting (tokenize + render) for each library across
 * multiple languages and input sizes.
 * -----------------------------------------------------------------------------------------------*/

import { bench, describe } from "vitest";

// --- neo.highlight ---
import { tokenize } from "../src/core/tokenizer";
import { renderToHTML } from "../src/core/renderer";
import { javascript } from "../src/grammars/javascript";
import { python } from "../src/grammars/python";
import { html } from "../src/grammars/html";

// --- Prism.js ---
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";

// --- highlight.js ---
import hljs from "highlight.js/lib/core";
import hljsJavascript from "highlight.js/lib/languages/javascript";
import hljsPython from "highlight.js/lib/languages/python";
import hljsXml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("javascript", hljsJavascript);
hljs.registerLanguage("python", hljsPython);
hljs.registerLanguage("xml", hljsXml);

import {
  JS_SMALL,
  JS_MEDIUM,
  JS_LARGE,
  PYTHON_SMALL,
  PYTHON_MEDIUM,
  PYTHON_LARGE,
  HTML_SMALL,
  HTML_MEDIUM,
  HTML_LARGE,
} from "./fixtures";

// Helper: neo.highlight end-to-end
const neoHighlight = (code: string, grammar: Parameters<typeof tokenize>[1]) => {
  const tokens = tokenize(code, grammar);
  return renderToHTML(tokens);
};

// -------------------------------------------------------------------------
// JavaScript
// -------------------------------------------------------------------------

describe("JavaScript small (~100 chars)", () => {
  bench("neo.highlight", () => {
    neoHighlight(JS_SMALL, javascript);
  });

  bench("Prism.js", () => {
    Prism.highlight(JS_SMALL, Prism.languages["javascript"]!, "javascript");
  });

  bench("highlight.js", () => {
    hljs.highlight(JS_SMALL, { language: "javascript" });
  });
});

describe("JavaScript medium (~1KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(JS_MEDIUM, javascript);
  });

  bench("Prism.js", () => {
    Prism.highlight(JS_MEDIUM, Prism.languages["javascript"]!, "javascript");
  });

  bench("highlight.js", () => {
    hljs.highlight(JS_MEDIUM, { language: "javascript" });
  });
});

describe("JavaScript large (~10KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(JS_LARGE, javascript);
  });

  bench("Prism.js", () => {
    Prism.highlight(JS_LARGE, Prism.languages["javascript"]!, "javascript");
  });

  bench("highlight.js", () => {
    hljs.highlight(JS_LARGE, { language: "javascript" });
  });
});

// -------------------------------------------------------------------------
// Python
// -------------------------------------------------------------------------

describe("Python small (~100 chars)", () => {
  bench("neo.highlight", () => {
    neoHighlight(PYTHON_SMALL, python);
  });

  bench("Prism.js", () => {
    Prism.highlight(PYTHON_SMALL, Prism.languages["python"]!, "python");
  });

  bench("highlight.js", () => {
    hljs.highlight(PYTHON_SMALL, { language: "python" });
  });
});

describe("Python medium (~1KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(PYTHON_MEDIUM, python);
  });

  bench("Prism.js", () => {
    Prism.highlight(PYTHON_MEDIUM, Prism.languages["python"]!, "python");
  });

  bench("highlight.js", () => {
    hljs.highlight(PYTHON_MEDIUM, { language: "python" });
  });
});

describe("Python large (~10KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(PYTHON_LARGE, python);
  });

  bench("Prism.js", () => {
    Prism.highlight(PYTHON_LARGE, Prism.languages["python"]!, "python");
  });

  bench("highlight.js", () => {
    hljs.highlight(PYTHON_LARGE, { language: "python" });
  });
});

// -------------------------------------------------------------------------
// HTML
// -------------------------------------------------------------------------

describe("HTML small (~100 chars)", () => {
  bench("neo.highlight", () => {
    neoHighlight(HTML_SMALL, html);
  });

  bench("Prism.js", () => {
    Prism.highlight(HTML_SMALL, Prism.languages["markup"]!, "markup");
  });

  bench("highlight.js", () => {
    hljs.highlight(HTML_SMALL, { language: "xml" });
  });
});

describe("HTML medium (~1KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(HTML_MEDIUM, html);
  });

  bench("Prism.js", () => {
    Prism.highlight(HTML_MEDIUM, Prism.languages["markup"]!, "markup");
  });

  bench("highlight.js", () => {
    hljs.highlight(HTML_MEDIUM, { language: "xml" });
  });
});

describe("HTML large (~10KB)", () => {
  bench("neo.highlight", () => {
    neoHighlight(HTML_LARGE, html);
  });

  bench("Prism.js", () => {
    Prism.highlight(HTML_LARGE, Prism.languages["markup"]!, "markup");
  });

  bench("highlight.js", () => {
    hljs.highlight(HTML_LARGE, { language: "xml" });
  });
});
