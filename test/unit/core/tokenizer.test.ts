import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAX_INPUT_LENGTH,
  tokenize,
  getPlainText,
  createRegistry,
} from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { python } from "../../../src/grammars/python";
import { css } from "../../../src/grammars/css";
import { cpp } from "../../../src/grammars/cpp";
import { jsx } from "../../../src/grammars/jsx";
import { vue } from "../../../src/grammars/vue";
import { less } from "../../../src/grammars/less";
import { csv } from "../../../src/grammars/csv";
import type { Grammar, TokenNode } from "../../../src/core/types";

/* -------------------------------------------------------------------------------------------------
 * Helper to flatten tokens into a simple representation for assertions
 * -----------------------------------------------------------------------------------------------*/

interface FlatToken {
  type: string;
  content: string;
}

function flattenTokens(tokens: ReturnType<typeof tokenize>): Array<string | FlatToken> {
  return tokens.map((t) => {
    if (typeof t === "string") return t;
    return {
      type: t.type,
      content: typeof t.content === "string" ? t.content : getPlainText([t]),
    };
  });
}

function getTokenTypes(tokens: ReturnType<typeof tokenize>): string[] {
  return tokens
    .filter((t): t is TokenNode => typeof t !== "string")
    .map((t) => t.type);
}

function getAllTokenTypes(tokens: ReturnType<typeof tokenize>): string[] {
  const types: string[] = [];
  const visit = (items: ReturnType<typeof tokenize>): void => {
    for (const item of items) {
      if (typeof item === "string") continue;
      types.push(item.type);
      if (Array.isArray(item.content)) visit(item.content);
    }
  };
  visit(tokens);
  return types;
}

/* -------------------------------------------------------------------------------------------------
 * Core Tokenizer Tests
 * -----------------------------------------------------------------------------------------------*/

describe("tokenize", () => {
  it("should return the full string as a single token for empty grammar", () => {
    const grammar: Grammar = { name: "empty", tokens: {} };
    const result = tokenize("hello world", grammar);
    expect(result).toEqual(["hello world"]);
  });

  it("should tokenize a simple keyword", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: { keyword: /\b(?:if|else|while)\b/ },
    };
    const result = tokenize("if (x) { } else { }", grammar);
    const types = getTokenTypes(result);
    expect(types).toContain("keyword");
    expect(flattenTokens(result)).toContainEqual({ type: "keyword", content: "if" });
    expect(flattenTokens(result)).toContainEqual({ type: "keyword", content: "else" });
  });

  it("uses grammar token changes made after an earlier tokenization", () => {
    const grammar: Grammar = {
      name: "mutable",
      tokens: { original: /foo/ },
    };
    expect(flattenTokens(tokenize("foo bar", grammar))).toContainEqual({
      type: "original",
      content: "foo",
    });

    grammar.tokens.original = /bar/;
    grammar.tokens.added = /foo/;
    const updated = flattenTokens(tokenize("foo bar", grammar));

    expect(updated).toContainEqual({ type: "added", content: "foo" });
    expect(updated).toContainEqual({ type: "original", content: "bar" });
  });

  it("should preserve plain text between tokens", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: { keyword: /\blet\b/ },
    };
    const result = tokenize("let x = 1", grammar);
    expect(result.length).toBeGreaterThan(1);
    expect(typeof result[0]).not.toBe("string"); // "let" is a keyword
    expect(result[1]).toBe(" x = 1");
  });

  it("should handle multiple token types", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        keyword: /\b(?:const|let|var)\b/,
        number: /\b\d+\b/,
        operator: /=/,
      },
    };
    const result = tokenize("const x = 42", grammar);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "const" });
    expect(flat).toContainEqual({ type: "number", content: "42" });
    expect(flat).toContainEqual({ type: "operator", content: "=" });
  });

  it("should handle greedy patterns for strings", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        string: { pattern: /"(?:\\[\s\S]|[^\\"])*"/, greedy: true },
        keyword: /\bconst\b/,
      },
    };
    const result = tokenize('const x = "hello world"', grammar);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "string", content: '"hello world"' });
    expect(flat).toContainEqual({ type: "keyword", content: "const" });
  });

  it("should handle lookbehind patterns", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        "class-name": {
          pattern: /(\bclass\s+)\w+/,
          lookbehind: true,
        },
        keyword: /\bclass\b/,
      },
    };
    const result = tokenize("class Foo", grammar);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "class-name", content: "Foo" });
  });

  it("should handle nested/inside grammars", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        "template-string": {
          pattern: /`[^`]*`/,
          greedy: true,
          inside: {
            interpolation: /\$\{[^}]*\}/,
          },
        },
      },
    };
    const result = tokenize("`hello ${name}`", grammar);
    expect(result.length).toBe(1);
    const templateToken = result[0] as TokenNode;
    expect(templateToken.type).toBe("template-string");
    expect(Array.isArray(templateToken.content)).toBe(true);

    // The content should contain an interpolation token
    const innerTokens = templateToken.content as ReturnType<typeof tokenize>;
    const innerFlat = flattenTokens(innerTokens);
    expect(innerFlat).toContainEqual({ type: "interpolation", content: "${name}" });
  });

  it("should handle aliases", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        "template-string": {
          pattern: /`[^`]*`/,
          alias: "string",
        },
      },
    };
    const result = tokenize("`hello`", grammar);
    const token = result[0] as TokenNode;
    expect(token.type).toBe("template-string");
    expect(token.alias).toBe("string");
  });

  it("should handle array aliases", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        important: {
          pattern: /\b(?:TODO|FIXME)\b/,
          alias: ["comment", "tag"],
        },
      },
    };
    const result = tokenize("TODO: fix this", grammar);
    const token = result[0] as TokenNode;
    expect(token.alias).toEqual(["comment", "tag"]);
  });

  it("should handle array token definitions", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: {
        string: [
          { pattern: /"(?:\\[\s\S]|[^\\"])*"/, greedy: true },
          { pattern: /'(?:\\[\s\S]|[^\\'])*'/, greedy: true },
        ],
      },
    };
    const result = tokenize(`"hello" 'world'`, grammar);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "string", content: '"hello"' });
    expect(flat).toContainEqual({ type: "string", content: "'world'" });
  });

  it("should handle empty input", () => {
    const result = tokenize("", javascript);
    expect(result).toEqual([""]);
  });

  it("should advance past zero-width Unicode matches without hanging", () => {
    const grammar: Grammar = {
      name: "zero-width-unicode",
      tokens: { empty: /(?:)/u },
    };

    expect(tokenize("😀", grammar)).toEqual(["😀"]);
  });

  it("should advance past zero-width Unicode Sets matches when supported", () => {
    let pattern: RegExp;
    try {
      pattern = new RegExp("(?:)", "v");
    } catch {
      return;
    }
    const grammar: Grammar = {
      name: "zero-width-unicode-sets",
      tokens: { empty: pattern },
    };

    expect(tokenize("😀", grammar)).toEqual(["😀"]);
  });

  it("should handle input with no matches", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: { keyword: /\bxyznotaword\b/ },
    };
    const result = tokenize("hello world", grammar);
    expect(result).toEqual(["hello world"]);
  });

  it("should enforce a configurable input limit", () => {
    const grammar: Grammar = { name: "empty", tokens: {} };

    expect(() =>
      tokenize("12345", grammar, { maxInputLength: 4 }),
    ).toThrow(/maxInputLength/i);
    expect(tokenize("12345", grammar, { maxInputLength: 5 })).toEqual([
      "12345",
    ]);
  });

  it("should reject input above the default safety limit", () => {
    const grammar: Grammar = { name: "empty", tokens: {} };
    const oversized = "x".repeat(DEFAULT_MAX_INPUT_LENGTH + 1);

    expect(() => tokenize(oversized, grammar)).toThrow(/exceeds/i);
  });

  it(
    "should process long unterminated constructs without regex backtracking stalls",
    () => {
      const source = `const value = "${"\\".repeat(50_000)}`;
      expect(getPlainText(tokenize(source, javascript))).toBe(source);
    },
    2_000,
  );

  it("should let a greedy match span tokens produced by earlier rules", () => {
    const result = tokenize('<Button title="hello">x</Button>', jsx);
    expect(getTokenTypes(result).filter((type) => type === "tag")).toHaveLength(2);
  });

  it("should not let a greedy match consume content inside a comment", () => {
    const result = tokenize('// <Button title="hello">', jsx);
    expect(getTokenTypes(result)).toEqual(["comment"]);
  });

  it("should match patterns whose lookahead crosses existing token boundaries", () => {
    const result = tokenize("foo<string>()", typescript);
    expect(getTokenTypes(result)).toContain("generic-function");
  });

  it("should preserve compound greedy tokens in composed grammars", () => {
    expect(getTokenTypes(tokenize('a { src: url("x.png"); }', css))).toContain("url");
    expect(getTokenTypes(tokenize('auto s = R"tag(raw)tag";', cpp))).toContain(
      "raw-string",
    );
  });

  it("should tokenize Vue directives inside HTML tags", () => {
    const result = tokenize('<div v-if="ready">{{ message }}</div>', vue);
    expect(getAllTokenTypes(result)).toContain("directive");
  });

  it("should distinguish Less variables from CSS at-rules", () => {
    const source =
      '@primary: #fff;\n@import "theme.less";\n@media screen { color: @primary; }';
    const result = tokenize(source, less);

    expect(getPlainText(result)).toBe(source);
    expect(getTokenTypes(result).filter((type) => type === "variable")).toHaveLength(
      2,
    );
    expect(getTokenTypes(result).filter((type) => type === "atrule")).toHaveLength(
      2,
    );
  });

  it("should treat only the first CSV row as a header", () => {
    const source = "name,age,active\nAlice,30,true\nBob,25,false";
    const result = tokenize(source, csv);

    expect(getPlainText(result)).toBe(source);
    expect(getTokenTypes(result).filter((type) => type === "header")).toHaveLength(
      1,
    );
    expect(getTokenTypes(result).filter((type) => type === "number")).toHaveLength(
      2,
    );
    expect(getTokenTypes(result).filter((type) => type === "boolean")).toHaveLength(
      2,
    );
  });
});

/* -------------------------------------------------------------------------------------------------
 * JavaScript Grammar Tests
 * -----------------------------------------------------------------------------------------------*/

describe("JavaScript grammar", () => {
  it("should tokenize variable declaration", () => {
    const result = tokenize("const x = 42;", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "const" });
    expect(flat).toContainEqual({ type: "number", content: "42" });
    expect(flat).toContainEqual({ type: "punctuation", content: ";" });
  });

  it("should tokenize function declaration", () => {
    const result = tokenize("function hello() {}", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "function" });
    expect(flat).toContainEqual({ type: "function", content: "hello" });
  });

  it("should tokenize arrow function", () => {
    const result = tokenize("const fn = () => {}", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "const" });
    expect(flat).toContainEqual({ type: "operator", content: "=>" });
  });

  it("should tokenize single-line comments", () => {
    const result = tokenize("// this is a comment", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "comment", content: "// this is a comment" });
  });

  it("should tokenize multi-line comments", () => {
    const result = tokenize("/* multi\nline */", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "comment", content: "/* multi\nline */" });
  });

  it("should tokenize strings", () => {
    const result = tokenize(`"hello" + 'world'`, javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "string", content: '"hello"' });
    expect(flat).toContainEqual({ type: "string", content: "'world'" });
  });

  it("should tokenize template literals with interpolation", () => {
    const result = tokenize("`hello ${name}`", javascript);
    const token = result[0] as TokenNode;
    expect(token.type).toBe("string");
    expect(token.alias).toBe("template-string");
  });

  it("should tokenize class declaration", () => {
    const result = tokenize("class MyComponent extends React.Component {}", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "class" });
    expect(flat).toContainEqual({ type: "class-name", content: "MyComponent" });
    expect(flat).toContainEqual({ type: "keyword", content: "extends" });
  });

  it("should tokenize boolean values", () => {
    const result = tokenize("const a = true; const b = false;", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "boolean", content: "true" });
    expect(flat).toContainEqual({ type: "boolean", content: "false" });
  });

  it("should tokenize async/await", () => {
    const result = tokenize("async function fetchData() { await fetch() }", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "async" });
    expect(flat).toContainEqual({ type: "keyword", content: "await" });
    expect(flat).toContainEqual({ type: "function", content: "fetchData" });
    expect(flat).toContainEqual({ type: "function", content: "fetch" });
  });

  it("should tokenize import/export", () => {
    const result = tokenize("import { foo } from './bar'", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "import" });
    expect(flat).toContainEqual({ type: "keyword", content: "from" });
    expect(flat).toContainEqual({ type: "string", content: "'./bar'" });
  });

  it("should tokenize numbers in various formats", () => {
    const tokens1 = tokenize("42", javascript);
    expect(flattenTokens(tokens1)).toContainEqual({ type: "number", content: "42" });

    const tokens2 = tokenize("3.14", javascript);
    expect(flattenTokens(tokens2)).toContainEqual({ type: "number", content: "3.14" });

    const tokens3 = tokenize("0xFF", javascript);
    expect(flattenTokens(tokens3)).toContainEqual({ type: "number", content: "0xFF" });
  });

  it("should tokenize constants (ALL_CAPS)", () => {
    const result = tokenize("const MAX_SIZE = 100", javascript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "constant", content: "MAX_SIZE" });
  });

  it("should handle complex code correctly", () => {
    const code = `
const greet = async (name) => {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return true;
};
`.trim();
    const result = tokenize(code, javascript);
    const text = getPlainText(result);
    expect(text).toBe(code);
  });
});

/* -------------------------------------------------------------------------------------------------
 * TypeScript Grammar Tests
 * -----------------------------------------------------------------------------------------------*/

describe("TypeScript grammar", () => {
  it("should tokenize type annotations", () => {
    const result = tokenize("const x: string = 'hello'", typescript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "const" });
    expect(flat).toContainEqual({ type: "builtin", content: "string" });
  });

  it("should tokenize interface declaration", () => {
    const result = tokenize("interface Props { name: string }", typescript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "interface" });
    expect(flat).toContainEqual({ type: "class-name", content: "Props" });
    expect(flat).toContainEqual({ type: "builtin", content: "string" });
  });

  it("should tokenize type keyword", () => {
    const result = tokenize("type ID = string | number", typescript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "type" });
    expect(flat).toContainEqual({ type: "builtin", content: "string" });
    expect(flat).toContainEqual({ type: "builtin", content: "number" });
  });

  it("should tokenize readonly and declare keywords", () => {
    const result = tokenize("declare const x: readonly string[]", typescript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "declare" });
    expect(flat).toContainEqual({ type: "keyword", content: "readonly" });
  });

  it("should tokenize utility types", () => {
    const result = tokenize("type X = Partial<Record<string, number>>", typescript);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "builtin", content: "Partial" });
    expect(flat).toContainEqual({ type: "builtin", content: "Record" });
  });
});

/* -------------------------------------------------------------------------------------------------
 * Python Grammar Tests
 * -----------------------------------------------------------------------------------------------*/

describe("Python grammar", () => {
  it("should tokenize def statement", () => {
    const result = tokenize("def hello():", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "def" });
    expect(flat).toContainEqual({ type: "function", content: "hello" });
  });

  it("should tokenize class statement", () => {
    const result = tokenize("class MyClass:", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "class" });
    expect(flat).toContainEqual({ type: "class-name", content: "MyClass" });
  });

  it("should tokenize Python comments", () => {
    const result = tokenize("# this is a comment", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "comment", content: "# this is a comment" });
  });

  it("should tokenize Python booleans (True/False/None)", () => {
    const result = tokenize("x = True; y = False; z = None", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "boolean", content: "True" });
    expect(flat).toContainEqual({ type: "boolean", content: "False" });
    expect(flat).toContainEqual({ type: "boolean", content: "None" });
  });

  it("should tokenize triple-quoted strings", () => {
    const result = tokenize('"""hello\nworld"""', python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "triple-string", content: '"""hello\nworld"""' });
  });

  it("should tokenize builtins", () => {
    const result = tokenize("print(len(items))", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "builtin", content: "print" });
    expect(flat).toContainEqual({ type: "builtin", content: "len" });
  });

  it("should tokenize decorators", () => {
    const result = tokenize("@staticmethod\ndef foo():", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "decorator", content: "@staticmethod" });
  });

  it("should tokenize import statements", () => {
    const result = tokenize("from os import path", python);
    const flat = flattenTokens(result);
    expect(flat).toContainEqual({ type: "keyword", content: "from" });
    expect(flat).toContainEqual({ type: "keyword", content: "import" });
  });
});

/* -------------------------------------------------------------------------------------------------
 * getPlainText Tests
 * -----------------------------------------------------------------------------------------------*/

describe("getPlainText", () => {
  it("should reconstruct original text from tokens", () => {
    const code = 'const x = 42; // hello\nconst y = "world";';
    const tokens = tokenize(code, javascript);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("should handle empty tokens", () => {
    expect(getPlainText([])).toBe("");
  });

  it("should handle plain string tokens only", () => {
    expect(getPlainText(["hello ", "world"])).toBe("hello world");
  });
});

/* -------------------------------------------------------------------------------------------------
 * createRegistry Tests
 * -----------------------------------------------------------------------------------------------*/

describe("createRegistry", () => {
  it("should create a registry from grammars", () => {
    const registry = createRegistry([javascript, python]);
    expect(registry.get("javascript")).toBe(javascript);
    expect(registry.get("python")).toBe(python);
  });

  it("should register aliases", () => {
    const registry = createRegistry([javascript]);
    expect(registry.get("js")).toBe(javascript);
    expect(registry.get("mjs")).toBe(javascript);
    expect(registry.get("cjs")).toBe(javascript);
  });

  it("should handle empty array", () => {
    const registry = createRegistry([]);
    expect(registry.size).toBe(0);
  });

  it("normalizes names and aliases", () => {
    const grammar: Grammar = {
      name: "  ExampleLang  ",
      aliases: ["  EX  "],
      tokens: {},
    };
    const registry = createRegistry([grammar]);

    expect(registry.get("examplelang")).toBe(grammar);
    expect(registry.get("ex")).toBe(grammar);
    expect(registry.has("  ExampleLang  ")).toBe(false);
  });
});
