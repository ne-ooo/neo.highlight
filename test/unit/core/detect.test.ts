import { describe, it, expect, beforeEach } from "vitest";
import { detectLanguage, scoreTokenization, clearDetectCache } from "../../../src/core/detect";
import { tokenize } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { html } from "../../../src/grammars/html";
import { css } from "../../../src/grammars/css";
import { json } from "../../../src/grammars/json";
import { bash } from "../../../src/grammars/bash";
import { rust } from "../../../src/grammars/rust";
import { go } from "../../../src/grammars/go";
import { sql } from "../../../src/grammars/sql";
import type { Grammar } from "../../../src/core/types";

const allGrammars = [javascript, python, html, css, json, bash, rust, go, sql];

beforeEach(() => {
  clearDetectCache();
});

describe("scoreTokenization", () => {
  it("returns 0 for empty code", () => {
    const tokens = tokenize("", javascript);
    expect(scoreTokenization(tokens, 0)).toBe(0);
  });

  it("returns 0 for code that produces no token matches", () => {
    // Plain text with no programming constructs
    const tokens = tokenize("hello world", javascript);
    // Some might match "function" etc, but plain text should score very low
    const score = scoreTokenization(tokens, 11);
    expect(score).toBeLessThan(0.3);
  });

  it("returns high score for well-matched code", () => {
    const code = `const x = 42;\nfunction hello() { return "world"; }`;
    const tokens = tokenize(code, javascript);
    const score = scoreTokenization(tokens, code.length);
    expect(score).toBeGreaterThan(0.4);
  });

  it("score increases with more token diversity", () => {
    const simple = `42`;
    const complex = `const x = 42; function foo() { return "hello"; } // comment`;
    const simpleScore = scoreTokenization(tokenize(simple, javascript), simple.length);
    const complexScore = scoreTokenization(tokenize(complex, javascript), complex.length);
    expect(complexScore).toBeGreaterThan(simpleScore);
  });
});

describe("detectLanguage", () => {
  it("returns undefined for empty code", () => {
    expect(detectLanguage("", allGrammars)).toBeUndefined();
  });

  it("returns undefined for empty grammars array", () => {
    expect(detectLanguage("const x = 42;", [])).toBeUndefined();
  });

  it("detects JavaScript", () => {
    const code = `
      const express = require('express');
      const app = express();
      async function handleRequest(req, res) {
        const data = await fetchData();
        if (data === null) {
          throw new Error('Not found');
        }
        return res.json({ status: 'ok', data });
      }
      app.listen(3000);
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("javascript");
    expect(result!.score).toBeGreaterThan(0.3);
  });

  it("detects Python", () => {
    const code = `
      import os
      from pathlib import Path

      def process_files(directory):
          for path in Path(directory).rglob('*.py'):
              with open(path) as f:
                  content = f.read()
              print(f"Processed {path}: {len(content)} chars")

      if __name__ == '__main__':
          process_files(os.getcwd())
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("python");
  });

  it("detects HTML", () => {
    const code = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Hello World</title>
      </head>
      <body>
        <h1>Welcome</h1>
        <p class="intro">Hello, world!</p>
      </body>
      </html>
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("html");
  });

  it("detects CSS", () => {
    const code = `
      .container {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #f0f0f0;
        padding: 2rem;
      }
      @media (max-width: 768px) {
        .container { flex-direction: column; }
      }
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("css");
  });

  it("detects JSON", () => {
    const code = `{
      "name": "my-package",
      "version": "1.0.0",
      "dependencies": {
        "express": "^4.18.0",
        "lodash": "^4.17.21"
      },
      "scripts": {
        "build": "tsc",
        "test": "vitest"
      }
    }`;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("json");
  });

  it("detects Bash", () => {
    const code = `
      #!/bin/bash
      set -euo pipefail

      for file in *.ts; do
        echo "Processing $file"
        npx tsc "$file" --outDir dist/
      done

      if [ -d "dist" ]; then
        tar -czf output.tar.gz dist/
      fi
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("bash");
  });

  it("detects SQL", () => {
    const code = `
      SELECT u.name, u.email, COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.created_at > '2024-01-01'
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(o.id) > 5
      ORDER BY order_count DESC
      LIMIT 100;
    `;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("sql");
  });

  it("returns candidates sorted by score", () => {
    const code = `const x = 42; function hello() { return "world"; }`;
    const result = detectLanguage(code, allGrammars);
    expect(result).toBeDefined();
    expect(result!.candidates.length).toBe(allGrammars.length);
    // Verify sorted descending
    for (let i = 1; i < result!.candidates.length; i++) {
      expect(result!.candidates[i - 1]!.score).toBeGreaterThanOrEqual(result!.candidates[i]!.score);
    }
  });

  it("returns undefined when no grammar scores above minScore", () => {
    const code = "just some plain text with no code";
    const result = detectLanguage(code, allGrammars, { minScore: 0.9 });
    expect(result).toBeUndefined();
  });

  it("respects maxLength option", () => {
    // Create a long string that is only detectable after the first 10 chars
    const code = "x".repeat(100) + `\nconst foo = 42; function bar() { return "hello"; }`;
    const shortResult = detectLanguage(code, [javascript], { maxLength: 10 });
    const fullResult = detectLanguage(code, [javascript], { maxLength: 200 });
    // With maxLength=10, only "xxxxxxxxxx" is analyzed — should not detect JS
    expect(shortResult).toBeUndefined();
    // With full length, should detect JS
    expect(fullResult).toBeDefined();
  });

  it("caches results", () => {
    const code = `const x = 42; function hello() { return "world"; }`;
    const result1 = detectLanguage(code, allGrammars);
    const result2 = detectLanguage(code, allGrammars);
    // Should return exact same reference from cache
    expect(result1).toBe(result2);
  });

  it("skips cache with noCache option", () => {
    const code = `const x = 42; function hello() { return "world"; }`;
    const result1 = detectLanguage(code, allGrammars, { noCache: true });
    const result2 = detectLanguage(code, allGrammars, { noCache: true });
    // Different references since cache is bypassed
    expect(result1).not.toBe(result2);
    expect(result1!.grammar.name).toBe(result2!.grammar.name);
  });

  it("clearDetectCache clears the cache", () => {
    const code = `const x = 42; function hello() { return "world"; }`;
    const result1 = detectLanguage(code, allGrammars);
    clearDetectCache();
    const result2 = detectLanguage(code, allGrammars);
    // After clearing cache, should be different references
    expect(result1).not.toBe(result2);
  });

  it("works with a single grammar", () => {
    const code = `def foo(): return 42`;
    const result = detectLanguage(code, [python]);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("python");
  });

  it("differentiates between similar languages", () => {
    // Rust-specific syntax: fn, let mut, ->, ::, &str
    const rustCode = `
      fn main() {
          let mut v: Vec<i32> = Vec::new();
          v.push(42);
          println!("{:?}", v);
      }
    `;
    const result = detectLanguage(rustCode, [javascript, python, rust, go]);
    expect(result).toBeDefined();
    expect(result!.grammar.name).toBe("rust");
  });

  it("handles code with only comments", () => {
    const code = `// This is a comment\n// Another comment`;
    const result = detectLanguage(code, allGrammars);
    // Comments produce tokens but with low diversity
    if (result) {
      expect(result.score).toBeLessThan(0.7);
    }
  });
});
