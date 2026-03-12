import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join } from "path";

function getGrammarEntries(): Record<string, string> {
  const dir = "src/grammars";
  const entries: Record<string, string> = {};
  for (const item of readdirSync(dir)) {
    if (!item.endsWith(".ts")) continue;
    const name = item.replace(".ts", "");
    entries[`grammars/${name}`] = join(dir, item);
  }
  return entries;
}

function getThemeEntries(): Record<string, string> {
  const dir = "src/themes";
  const entries: Record<string, string> = {};
  for (const item of readdirSync(dir)) {
    if (!item.endsWith(".ts")) continue;
    const name = item.replace(".ts", "");
    entries[`themes/${name}`] = join(dir, item);
  }
  return entries;
}

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "vanilla/index": "src/vanilla/index.ts",
    ...getGrammarEntries(),
    ...getThemeEntries(),
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  splitting: true,
  minify: false,
  target: "es2022",
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
