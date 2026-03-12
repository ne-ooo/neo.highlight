import { describe, it, expect } from "vitest";
import { tokenize, getPlainText, createRegistry } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { python } from "../../../src/grammars/python";
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

  it("should handle input with no matches", () => {
    const grammar: Grammar = {
      name: "test",
      tokens: { keyword: /\bxyznotaword\b/ },
    };
    const result = tokenize("hello world", grammar);
    expect(result).toEqual(["hello world"]);
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
});
