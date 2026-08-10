import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const TIMEOUT_MS = 2_000;
const MAX_LARGE_RUN_MS = 500;

const cases = [
  { name: "CSS function", module: "css", exportName: "css", unit: "a" },
  { name: "Less inherited CSS", module: "less", exportName: "less", unit: "a" },
  { name: "SCSS inherited CSS", module: "scss", exportName: "scss", unit: "a" },
  { name: "Perl regex", module: "perl", exportName: "perl", unit: " " },
  { name: "Vue interpolation", module: "vue", exportName: "vue", unit: "{" },
  { name: "Nix URL", module: "nix", exportName: "nix", unit: "a" },
  {
    name: "C# generic type",
    module: "csharp",
    exportName: "csharp",
    unit: "a",
  },
  { name: "Ruby symbol", module: "ruby", exportName: "ruby", unit: "a" },
  {
    name: "Kotlin label",
    module: "kotlin",
    exportName: "kotlin",
    unit: "a",
  },
  {
    name: "Handlebars expression",
    module: "handlebars",
    exportName: "handlebars",
    unit: "{",
  },
];

const timings = [];
for (const testCase of cases) {
  const source = `
    import { performance } from "node:perf_hooks";
    import { getPlainText, tokenize } from "./dist/index.js";
    import { ${testCase.exportName} as grammar } from "./dist/grammars/${testCase.module}.js";

    const run = (length) => {
      const code = ${JSON.stringify(testCase.unit)}.repeat(length);
      const start = performance.now();
      const tokens = tokenize(code, grammar, { maxInputLength: length });
      const elapsed = performance.now() - start;
      if (getPlainText(tokens) !== code) throw new Error("Tokenization changed the input");
      return elapsed;
    };

    run(5_000);
    const medium = run(50_000);
    const large = run(100_000);
    console.log(JSON.stringify({ medium, large }));
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: TIMEOUT_MS,
  });

  assert.equal(
    result.error?.code,
    undefined,
    `${testCase.name} exceeded the ${TIMEOUT_MS}ms subprocess timeout`,
  );
  assert.equal(
    result.status,
    0,
    `${testCase.name} failed:\n${result.stderr || result.stdout}`,
  );

  const timing = JSON.parse(result.stdout.trim());
  assert.ok(
    timing.large < MAX_LARGE_RUN_MS,
    `${testCase.name} took ${timing.large.toFixed(1)}ms for 100,000 code units`,
  );
  assert.ok(
    timing.large <= timing.medium * 3 + 20,
    `${testCase.name} scaled non-linearly: ${timing.medium.toFixed(1)}ms to ${timing.large.toFixed(1)}ms`,
  );
  timings.push(`${testCase.name}: ${timing.large.toFixed(1)}ms`);
}

const zeroWidthSource = `
  import { getPlainText, tokenize } from "./dist/index.js";
  const code = "😀".repeat(50_000);
  const patterns = [/(?:)/u];
  try { patterns.push(new RegExp("(?:)", "v")); } catch {}
  for (const pattern of patterns) {
    const grammar = { name: "zero-width-unicode", tokens: { empty: pattern } };
    const tokens = tokenize(code, grammar, { maxInputLength: code.length });
    if (getPlainText(tokens) !== code) throw new Error("Tokenization changed the input");
  }
`;
const zeroWidthResult = spawnSync(
  process.execPath,
  ["--input-type=module", "--eval", zeroWidthSource],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: TIMEOUT_MS,
  },
);
assert.equal(
  zeroWidthResult.error?.code,
  undefined,
  `Zero-width Unicode matching exceeded the ${TIMEOUT_MS}ms subprocess timeout`,
);
assert.equal(
  zeroWidthResult.status,
  0,
  `Zero-width Unicode matching failed:\n${zeroWidthResult.stderr || zeroWidthResult.stdout}`,
);

console.log(`Regex safety checks passed (${timings.join(", ")})`);
