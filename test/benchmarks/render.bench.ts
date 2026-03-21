/* -------------------------------------------------------------------------------------------------
 * Rendering Benchmarks — Measures renderToHTML() performance with various options
 *
 * Tokens are pre-computed so we isolate render cost from tokenization cost.
 * -----------------------------------------------------------------------------------------------*/

import { bench, describe } from "vitest";
import { tokenize } from "../src/core/tokenizer";
import { renderToHTML } from "../src/core/renderer";
import { javascript } from "../src/grammars/javascript";
import { python } from "../src/grammars/python";
import {
  JS_MEDIUM,
  JS_LARGE,
  PYTHON_MEDIUM,
  PYTHON_LARGE,
} from "./fixtures";

// Pre-tokenize to isolate render performance
const jsTokensMedium = tokenize(JS_MEDIUM, javascript);
const jsTokensLarge = tokenize(JS_LARGE, javascript);
const pyTokensMedium = tokenize(PYTHON_MEDIUM, python);
const pyTokensLarge = tokenize(PYTHON_LARGE, python);

describe("Render - Plain", () => {
  bench("JS medium", () => {
    renderToHTML(jsTokensMedium);
  });

  bench("JS large", () => {
    renderToHTML(jsTokensLarge);
  });

  bench("PY medium", () => {
    renderToHTML(pyTokensMedium);
  });

  bench("PY large", () => {
    renderToHTML(pyTokensLarge);
  });
});

describe("Render - With Line Numbers", () => {
  bench("JS medium", () => {
    renderToHTML(jsTokensMedium, { lineNumbers: true });
  });

  bench("JS large", () => {
    renderToHTML(jsTokensLarge, { lineNumbers: true });
  });
});

describe("Render - With Line Highlighting", () => {
  bench("JS medium", () => {
    renderToHTML(jsTokensMedium, {
      lineNumbers: true,
      highlightLines: [1, 3, 5, 7, 9],
    });
  });
});
