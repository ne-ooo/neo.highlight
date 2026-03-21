/* -------------------------------------------------------------------------------------------------
 * Tokenization Benchmarks — Measures tokenize() performance across languages and sizes
 * -----------------------------------------------------------------------------------------------*/

import { bench, describe } from "vitest";
import { tokenize } from "../src/core/tokenizer";
import { javascript } from "../src/grammars/javascript";
import { python } from "../src/grammars/python";
import { html } from "../src/grammars/html";
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

describe("Tokenize - JavaScript", () => {
  bench("small (~100 chars)", () => {
    tokenize(JS_SMALL, javascript);
  });

  bench("medium (~1KB)", () => {
    tokenize(JS_MEDIUM, javascript);
  });

  bench("large (~10KB)", () => {
    tokenize(JS_LARGE, javascript);
  });
});

describe("Tokenize - Python", () => {
  bench("small (~100 chars)", () => {
    tokenize(PYTHON_SMALL, python);
  });

  bench("medium (~1KB)", () => {
    tokenize(PYTHON_MEDIUM, python);
  });

  bench("large (~10KB)", () => {
    tokenize(PYTHON_LARGE, python);
  });
});

describe("Tokenize - HTML", () => {
  bench("small (~100 chars)", () => {
    tokenize(HTML_SMALL, html);
  });

  bench("medium (~1KB)", () => {
    tokenize(HTML_MEDIUM, html);
  });

  bench("large (~10KB)", () => {
    tokenize(HTML_LARGE, html);
  });
});
