import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const temporaryRoot = await mkdtemp(join(tmpdir(), "neo-highlight-package-"));
const consumerRoot = join(temporaryRoot, "consumer");
const nodeModulesRoot = join(consumerRoot, "node_modules");
const packageDirectory = join(
  nodeModulesRoot,
  "@lpm.dev",
  "neo.highlight",
);

try {
  await mkdir(packageDirectory, { recursive: true });

  for (const entry of ["package.json", ...manifest.files]) {
    await cp(join(packageRoot, entry), join(packageDirectory, entry), {
      recursive: true,
    });
  }

  for (const peer of ["react", "react-dom"]) {
    const source = await realpath(join(packageRoot, "node_modules", peer));
    const target = join(nodeModulesRoot, peer);
    await symlink(source, target, process.platform === "win32" ? "junction" : "dir");
  }

  await access(join(packageDirectory, "dist", "index.js"));
  await access(join(packageDirectory, "dist", "index.cjs"));
  await access(join(packageDirectory, "dist", "index.d.ts"));
  await access(join(packageDirectory, "dist", "index.d.cts"));
  await access(join(packageDirectory, "dist", "worker", "index.js"));
  await access(join(packageDirectory, "dist", "worker", "index.cjs"));

  const skillsDirectory = join(packageDirectory, ".lpm", "skills");
  const skills = (await readdir(skillsDirectory)).filter((file) =>
    file.endsWith(".md"),
  );
  assert.ok(skills.length > 0, "The package must contain LPM skills");

  for (const skill of skills) {
    const source = await readFile(join(skillsDirectory, skill), "utf8");
    assert.match(
      source,
      new RegExp(`^version: ["']${manifest.version}["']$`, "m"),
      `${skill} does not match package version ${manifest.version}`,
    );
  }

  await assert.rejects(
    access(join(packageDirectory, ".lpm", "audit-cache.json")),
  );

  runNode([
    "--input-type=module",
    "--eval",
    `
      import assert from "node:assert/strict";
      import { renderToHTML, tokenize } from "@lpm.dev/neo.highlight";
      import { javascript as groupedGrammar } from "@lpm.dev/neo.highlight/grammars";
      import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
      import { githubDark as groupedTheme } from "@lpm.dev/neo.highlight/themes";
      import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";
      import { highlight } from "@lpm.dev/neo.highlight/vanilla";
      import { Highlight } from "@lpm.dev/neo.highlight/react";
      import { handleHighlightWorkerRequest } from "@lpm.dev/neo.highlight/worker";

      assert.equal(groupedGrammar, javascript);
      assert.equal(groupedTheme, githubDark);
      assert.equal(typeof highlight, "function");
      assert.equal(typeof Highlight, "function");

      const tokens = tokenize("const answer = 42;", javascript);
      assert.match(renderToHTML(tokens), /neo-hl-keyword/);

      const response = handleHighlightWorkerRequest({
        id: "esm",
        code: "const answer = 42;",
        language: "javascript",
      });
      assert.equal(response.ok, true);
    `,
  ]);

  runNode([
    "--eval",
    `
      const assert = require("node:assert/strict");
      const { renderToHTML, tokenize } = require("@lpm.dev/neo.highlight");
      const { javascript: groupedGrammar } = require("@lpm.dev/neo.highlight/grammars");
      const { javascript } = require("@lpm.dev/neo.highlight/grammars/javascript");
      const { githubDark: groupedTheme } = require("@lpm.dev/neo.highlight/themes");
      const { githubDark } = require("@lpm.dev/neo.highlight/themes/github-dark");
      const { highlight } = require("@lpm.dev/neo.highlight/vanilla");
      const { Highlight } = require("@lpm.dev/neo.highlight/react");
      const { handleHighlightWorkerRequest } = require("@lpm.dev/neo.highlight/worker");

      assert.equal(groupedGrammar, javascript);
      assert.equal(groupedTheme, githubDark);
      assert.equal(typeof highlight, "function");
      assert.equal(typeof Highlight, "function");

      const tokens = tokenize("const answer = 42;", javascript);
      assert.match(renderToHTML(tokens), /neo-hl-keyword/);

      const response = handleHighlightWorkerRequest({
        id: "cjs",
        code: "const answer = 42;",
        language: "js",
      });
      assert.equal(response.ok, true);
    `,
  ]);

  console.log("Built ESM and CommonJS package consumers passed");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function runNode(arguments_) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: consumerRoot,
    encoding: "utf8",
    env: process.env,
  });

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
}
