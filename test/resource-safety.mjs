import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const source = String.raw`
  import { renderToHTML, tokenize } from "./dist/index.js";
  import { javascript } from "./dist/grammars/javascript.js";
  import { python } from "./dist/grammars/python.js";
  import { css } from "./dist/grammars/css.js";
  import { vue } from "./dist/grammars/vue.js";
  import { svelte } from "./dist/grammars/svelte.js";
  import { tsx } from "./dist/grammars/tsx.js";

  const expectLimit = (run, limitName) => {
    try {
      run();
    } catch (error) {
      if (error instanceof RangeError && error.message.includes(limitName)) return;
      throw error;
    }
    throw new Error("Expected " + limitName + " to reject adversarial input");
  };

  expectLimit(() => tokenize('f"{'.repeat(25_000), python), "maxTokenDepth");
  expectLimit(() => tokenize('f"{x:' + "{".repeat(25_000), python), "maxTokenDepth");
  expectLimit(() => tokenize('a { x: fn(' + "(".repeat(25_000), css), "maxTokenDepth");
  for (const grammar of [vue, svelte]) {
    const prefix = grammar === vue ? "{{ " : "{ ";
    const nested = String.fromCharCode(96) + "x $" + "{";
    expectLimit(() => tokenize(prefix + nested.repeat(25_000), grammar), "maxTokenDepth");
    expectLimit(() => tokenize('<script>const x = 1;</script>', grammar, { maxTokenCount: 1 }), "maxTokenCount");
  }
  expectLimit(
    () => renderToHTML([{ type: "keyword", content: "const", length: 5 }], {
      hooks: { token: () => ({ attributes: { title: "x".repeat(100_000) } }) },
      maxRenderedLength: 1000,
    }), "maxRenderedLength",
  );
  const denseGrammar = {
    name: "dense",
    tokens: { first: /a/g, second: /b/g },
  };
  for (const grammar of [javascript, tsx]) {
    const nestedTemplates = String.fromCharCode(96) + "value $" + "{";
    expectLimit(
      () => tokenize(nestedTemplates.repeat(25_000), grammar),
      "maxTokenDepth",
    );
    const nestedJsx = "<A value={".repeat(20_000);
    if (grammar === tsx) expectLimit(() => tokenize(nestedJsx, grammar), "maxTokenDepth");
  }
  expectLimit(
    () => tokenize("ab".repeat(125_000), denseGrammar),
    "maxMatchCount",
  );

  const nodes = Array.from({ length: 50_000 }, (_, index) => ({
    type: index % 2 === 0 ? "a" : "b",
    content: "x",
    length: 1,
  }));
  expectLimit(
    () => renderToHTML([{ type: "outer", content: nodes, length: nodes.length }], {
      highlightRanges: [{ start: 0, end: nodes.length }],
      maxRenderedLength: 100_000,
    }), "maxRenderedLength",
  );
  expectLimit(
    () => renderToHTML(["x"], { highlightRanges: Array.from({ length: 257 }, () => ({ start: 0, end: 1 })) }),
    "highlightRanges",
  );
  expectLimit(
    () => renderToHTML(nodes, {
      wrapCode: false,
      maxTokenCount: 10_000,
    }),
    "maxTokenCount",
  );
  expectLimit(
    () => renderToHTML(nodes, {
      wrapCode: false,
      maxTokenCount: Infinity,
      maxRenderedLength: 100_000,
    }),
    "maxRenderedLength",
  );
  expectLimit(
    () => renderToHTML(["\n".repeat(100_000)], {
      lineNumbers: true,
    }),
    "maxLines",
  );
`;

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=64", "--input-type=module", "--eval", source],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 5_000,
  },
);

assert.equal(
  result.error?.code,
  undefined,
  "Resource safety checks exceeded the 5,000ms subprocess timeout",
);
assert.equal(
  result.status,
  0,
  "Resource safety checks failed:\n" + (result.stderr || result.stdout),
);

console.log("Heap-limited resource safety checks passed");
