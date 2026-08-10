import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/core/tokenizer";
import { css } from "../../../src/grammars/css";
import { csharp } from "../../../src/grammars/csharp";
import { handlebars } from "../../../src/grammars/handlebars";
import { kotlin } from "../../../src/grammars/kotlin";
import { nix } from "../../../src/grammars/nix";
import { perl } from "../../../src/grammars/perl";
import { ruby } from "../../../src/grammars/ruby";
import { vue } from "../../../src/grammars/vue";
import type { Grammar, Token } from "../../../src/core/types";

function hasTokenType(tokens: Token[], type: string): boolean {
  for (const token of tokens) {
    if (typeof token === "string") continue;
    if (token.type === type) return true;
    if (Array.isArray(token.content) && hasTokenType(token.content, type)) {
      return true;
    }
  }
  return false;
}

function isolateToken(grammar: Grammar, tokenType: string): Grammar {
  const definition = grammar.tokens[tokenType];
  if (definition === undefined) {
    throw new RangeError(`Unknown ${grammar.name} token type: ${tokenType}`);
  }
  return {
    name: `${grammar.name}-${tokenType}`,
    tokens: { [tokenType]: definition },
  };
}

const cases: Array<{
  name: string;
  grammar: Grammar;
  code: string;
  tokenType: string;
}> = [
  {
    name: "CSS functions",
    grammar: isolateToken(css, "function"),
    code: "width: calc(100% - 1rem)",
    tokenType: "function",
  },
  {
    name: "Perl regular expressions",
    grammar: isolateToken(perl, "regex"),
    code: "my $match = qr/foo/i;",
    tokenType: "regex",
  },
  {
    name: "Vue interpolations",
    grammar: isolateToken(vue, "interpolation"),
    code: "<p>{{ format({ message: value }) }}</p>",
    tokenType: "interpolation",
  },
  {
    name: "Nix URLs",
    grammar: isolateToken(nix, "url"),
    code: "url = https://example.com/package.tar.gz;",
    tokenType: "url",
  },
  {
    name: "C# generic types",
    grammar: isolateToken(csharp, "generic-type"),
    code: "List<Dictionary<string, int>> values;",
    tokenType: "generic-type",
  },
  {
    name: "Ruby symbols",
    grammar: isolateToken(ruby, "symbol"),
    code: "options = { enabled: true }",
    tokenType: "symbol",
  },
  {
    name: "Kotlin labels",
    grammar: isolateToken(kotlin, "label"),
    code: "loop@ for (item in items) { break@loop }",
    tokenType: "label",
  },
  {
    name: "Handlebars expressions",
    grammar: isolateToken(handlebars, "expression"),
    code: "<p>{{name}} {{{html}}}</p>",
    tokenType: "expression",
  },
  {
    name: "Handlebars raw blocks",
    grammar: isolateToken(handlebars, "raw-block"),
    code: "{{{{raw}}}}",
    tokenType: "raw-block",
  },
];

describe("grammar performance regressions", () => {
  for (const testCase of cases) {
    it(`preserves ${testCase.name}`, () => {
      expect(hasTokenType(tokenize(testCase.code, testCase.grammar), testCase.tokenType))
        .toBe(true);
    });
  }
});
