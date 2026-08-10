import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const source = String.raw`
  import { renderToHTML, tokenize } from "./dist/index.js";

  const expectLimit = (run, limitName) => {
    try {
      run();
    } catch (error) {
      if (error instanceof RangeError && error.message.includes(limitName)) return;
      throw error;
    }
    throw new Error("Expected " + limitName + " to reject adversarial input");
  };

  const denseGrammar = {
    name: "dense",
    tokens: { first: /a/g, second: /b/g },
  };
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
