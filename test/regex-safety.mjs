import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const TIMEOUT_MS = 2_000;
const MAX_LARGE_RUN_MS = 500;

const cases = [
  ["astro", "<a "],
  ["bash", "<<A\nx\n"],
  ["bash", "$" + "{a", "bash interpolation"],
  ["c", "/*a"],
  ["c", "#define X <\n", "c macro string"],
  ["clojure", "("],
  ["cpp", 'R"x('],
  ["csharp", "["],
  ["csharp", '/// <a x="v" ', "csharp doc tag"],
  ["csharp", "List<A>", "csharp generic"],
  ["css", "a "],
  ["css", "/*a", "css comment"],
  ["csv", '"a,'],
  ["dart", "$" + "{"],
  ["dart", "/*a", "dart comment"],
  ["diff", "@@ -1 +1 "],
  ["docker", "\n"],
  ["elixir", '#{'],
  ["erlang", '"a'],
  ["go", "/*a"],
  ["graphql", '"""a'],
  ["handlebars", "{{a"],
  ["handlebars", "{{!a", "handlebars comment"],
  ["haskell", "{-a"],
  ["html", "<a "],
  ["html", "<!--a", "html comment"],
  ["html", "<!DOCTYPE a", "html doctype"],
  ["html", "<![CDATA[a", "html cdata"],
  ["ini", "\n"],
  ["java", "/*a"],
  ["javascript", "/*a"],
  ["json", "\n"],
  ["jsx", "<a "],
  ["kotlin", "$" + "{"],
  ["kotlin", "/*a", "kotlin comment"],
  ["latex", "["],
  ["less", "a "],
  ["less", "@media a ", "less at-rule"],
  ["lua", "[["],
  ["markdown", "["],
  ["markdown", "[x](", "markdown URL"],
  ["nix", "$" + "{"],
  ["nix", "/*a", "nix comment"],
  ["objectivec", "["],
  ["ocaml", "{a|"],
  ["perl", "q("],
  ["perl", "m/", "perl regex"],
  ["php", "#["],
  ["php", "<<<A\nx\n", "php heredoc"],
  ["powershell", "<#a"],
  ["powershell", '@"a', "powershell here-string"],
  ["prisma", '"a'],
  ["python", '"""a'],
  ["r", '"a'],
  ["regex", "["],
  ["ruby", '#{'],
  ["ruby", "<<A\nx\n", "ruby heredoc"],
  ["rust", "#["],
  ["scala", "$" + "{"],
  ["scala", "/*a", "scala comment"],
  ["scss", "a "],
  ["shell", "<<A\nx\n"],
  ["solidity", "/*a"],
  ["sql", "/*a"],
  ["svelte", "{#if a"],
  ["swift", "\\("],
  ["swift", "/*a", "swift comment"],
  ["terraform", "<<A\nx\n"],
  ["terraform", "$" + "{a", "terraform interpolation"],
  ["toml", "\n"],
  ["tsx", "<a "],
  ["typescript", "/*a"],
  ["vue", "<a "],
  ["vue", "{{a", "vue interpolation"],
  ["wasm", "(;a"],
  ["yaml", "@"],
  ["zig", "\\\\"],
].map(([exportName, unit, name = exportName]) => ({
  name,
  module: exportName,
  exportName,
  unit,
}));

const grammarExports = await import("../dist/grammars/index.js");
const exportedGrammarNames = Object.values(grammarExports)
  .filter((value) => value && typeof value === "object" && "name" in value)
  .map((grammar) => grammar.name)
  .sort();
assert.deepEqual(
  [...new Set(cases.map((testCase) => testCase.exportName))].sort(),
  exportedGrammarNames,
  "Every exported grammar must have an explicit adversarial regex case",
);

const timings = [];
for (const testCase of cases) {
  const source = `
    import { performance } from "node:perf_hooks";
    import { getPlainText, tokenize } from "./dist/index.js";
    import { ${testCase.exportName} as grammar } from "./dist/grammars/${testCase.module}.js";

    const run = (length) => {
      const unit = ${JSON.stringify(testCase.unit)};
      const code = unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
      const start = performance.now();
      const tokens = tokenize(code, grammar, {
        maxInputLength: length,
        maxMatchCount: Infinity,
        maxTokenCount: Infinity,
      });
      const elapsed = performance.now() - start;
      if (getPlainText(tokens, { maxTokenCount: Infinity }) !== code) {
        throw new Error("Tokenization changed the input");
      }
      return elapsed;
    };

    run(2_000);
    const medium = run(20_000);
    const large = run(40_000);
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
    `${testCase.name} took ${timing.large.toFixed(1)}ms for 40,000 code units`,
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
