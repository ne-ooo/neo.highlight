import { describe, expect, it } from "vitest";
import { getPlainText, tokenize } from "../../../src/core/tokenizer";
import { css } from "../../../src/grammars/css";
import { csharp } from "../../../src/grammars/csharp";
import { handlebars } from "../../../src/grammars/handlebars";
import { kotlin } from "../../../src/grammars/kotlin";
import { nix } from "../../../src/grammars/nix";
import { perl } from "../../../src/grammars/perl";
import { ruby } from "../../../src/grammars/ruby";
import { vue } from "../../../src/grammars/vue";
import { javascript } from "../../../src/grammars/javascript";
import { php } from "../../../src/grammars/php";
import { rust } from "../../../src/grammars/rust";
import { swift } from "../../../src/grammars/swift";
import { scala } from "../../../src/grammars/scala";
import { ocaml } from "../../../src/grammars/ocaml";
import { haskell } from "../../../src/grammars/haskell";
import { dart } from "../../../src/grammars/dart";
import { bash } from "../../../src/grammars/bash";
import { c } from "../../../src/grammars/c";
import { go } from "../../../src/grammars/go";
import { java } from "../../../src/grammars/java";
import { json } from "../../../src/grammars/json";
import { less } from "../../../src/grammars/less";
import { scss } from "../../../src/grammars/scss";
import { solidity } from "../../../src/grammars/solidity";
import { sql } from "../../../src/grammars/sql";
import { terraform } from "../../../src/grammars/terraform";
import { docker } from "../../../src/grammars/docker";
import { yaml } from "../../../src/grammars/yaml";
import { lua } from "../../../src/grammars/lua";
import { markdown } from "../../../src/grammars/markdown";
import { prisma } from "../../../src/grammars/prisma";
import { erlang } from "../../../src/grammars/erlang";
import { toml } from "../../../src/grammars/toml";
import { cpp } from "../../../src/grammars/cpp";
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

function topLevelTokenTexts(tokens: Token[], type: string): string[] {
  return tokens
    .filter((token) => typeof token !== "string" && token.type === type)
    .map((token) => getPlainText([token]));
}

function recursiveTokenTexts(tokens: Token[], type: string): string[] {
  const texts: string[] = [];
  for (const token of tokens) {
    if (typeof token === "string") continue;
    if (token.type === type) texts.push(getPlainText([token]));
    if (Array.isArray(token.content)) {
      texts.push(...recursiveTokenTexts(token.content, type));
    }
  }
  return texts;
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

describe("grammar correctness regressions", () => {
  it.each([
    {
      name: "Bash",
      grammar: bash,
      code: "echo foo#literal\n# real comment",
    },
    {
      name: "Dockerfile",
      grammar: docker,
      code: "RUN echo foo#literal\n  # real comment",
    },
    {
      name: "YAML",
      grammar: yaml,
      code: "url: https://example.test/#anchor\nkey: value # real comment",
    },
  ])("recognizes context-sensitive # comments in $name", ({ grammar, code }) => {
    const comments = topLevelTokenTexts(tokenize(code, grammar), "comment");

    expect(comments).toHaveLength(1);
    expect(comments[0]).toContain("# real comment");
    expect(comments[0]).not.toContain("literal");
    expect(comments[0]).not.toContain("anchor");
  });

  it("matches Lua long-bracket comments with balanced levels", () => {
    const code = "--[=[ comment\nlocal fake = 1\n]=]\nlocal real = 2";
    const tokens = tokenize(code, lua);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([
      "--[=[ comment\nlocal fake = 1\n]=]",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["local"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("matches Lua long-bracket strings with balanced levels", () => {
    const code = "local s = [=[ text ]] local fake = 1 ]=]\nlocal real = 2";
    const tokens = tokenize(code, lua);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      "[=[ text ]] local fake = 1 ]=]",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["local", "local"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    {
      name: "longer backtick",
      code: "````js\n```\n# fake heading\n````\n# real heading",
    },
    {
      name: "tilde",
      code: "~~~js\n# fake heading\n~~~\n# real heading",
    },
  ])("matches CommonMark $name fences", ({ code }) => {
    const tokens = tokenize(code, markdown);

    expect(topLevelTokenTexts(tokens, "code-block")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "heading")).toEqual(["# real heading"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps SCSS line comments after inherited CSS tokens", () => {
    const code = "// $fake: red;\n$real: blue;";
    const tokens = tokenize(code, scss);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual(["// $fake: red;"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("preserves CSS delimiters around lookbehind tokens", () => {
    const code = "a { color: red; margin: 0; }";
    const tokens = tokenize(code, css);

    expect(topLevelTokenTexts(tokens, "property")).toEqual(["color", "margin"]);
    expect(topLevelTokenTexts(tokens, "punctuation").join("")).toContain("{");
    expect(topLevelTokenTexts(tokens, "punctuation").join("")).toContain(";");
    expect(getPlainText(tokens)).toBe(code);
  });

  it("preserves TOML inline-table delimiters around keys", () => {
    const code = "inline = { first = 1, second = 2 }";
    const tokens = tokenize(code, toml);
    const keys = topLevelTokenTexts(tokens, "key");

    expect(keys).toHaveLength(3);
    expect(keys.every((key) => !/[{,]/.test(key))).toBe(true);
    expect(topLevelTokenTexts(tokens, "punctuation").join("")).toContain("{");
    expect(topLevelTokenTexts(tokens, "punctuation").join("")).toContain(",");
    expect(getPlainText(tokens)).toBe(code);
  });

  it("preserves Less mixin boundary punctuation", () => {
    const code = ".mixin() { color: red; }\na { .mixin(); }";
    const tokens = tokenize(code, less);
    const mixins = topLevelTokenTexts(tokens, "mixin");

    expect(mixins).toHaveLength(2);
    expect(mixins.every((mixin) => !/[{;]/.test(mixin))).toBe(true);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("recognizes Prisma triple-slash comments as documentation", () => {
    const tokens = tokenize("/// model documentation", prisma);
    const docComment = tokens.find(
      (token) => typeof token !== "string" && token.type === "triple-comment",
    );

    expect(docComment).toBeDefined();
    expect(typeof docComment === "string" ? undefined : docComment?.alias)
      .toBe("doc-comment");
  });

  it("keeps Erlang keywords, booleans, and functions ahead of atoms", () => {
    const code = "case true of true -> greet(Name); false -> error end.";
    const tokens = tokenize(code, erlang);

    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["case", "of", "end"]);
    expect(topLevelTokenTexts(tokens, "boolean")).toEqual([
      "true",
      "true",
      "false",
    ]);
    expect(topLevelTokenTexts(tokens, "function")).toEqual(["greet"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    {
      name: "Ruby",
      grammar: ruby,
      code: "value = %Q{outer { inner } if fake}; if real then end",
      string: "%Q{outer { inner } if fake}",
    },
    {
      name: "Perl",
      grammar: perl,
      code: 'my $value = q{outer { inner } if fake}; if ($real) { say "ok"; }',
      string: "q{outer { inner } if fake}",
    },
  ])("matches nested paired delimiters in $name quotes", ({
    grammar,
    code,
    string,
  }) => {
    const tokens = tokenize(code, grammar);

    expect(topLevelTokenTexts(tokens, "string")).toContain(string);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === "if"),
    ).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("matches exact Swift extended multiline delimiters", () => {
    const code = 'let value = ##"""inner """# let fake = 1"""##; let real = 2';
    const tokens = tokenize(code, swift);

    expect(topLevelTokenTexts(tokens, "string-literal")).toEqual([
      '##"""inner """# let fake = 1"""##',
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["let", "let"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    {
      name: "single-line",
      code: String.raw`let value = #"literal \(plain) \#(one)"#`,
      interpolation: String.raw`\#(one)`,
    },
    {
      name: "multiline",
      code: String.raw`let value = #"""literal \(plain) \#(one)"""#`,
      interpolation: String.raw`\#(one)`,
    },
    {
      name: "multiple hashes",
      code: String.raw`let value = ##"literal \#(one) \##(two) \###(three)"##`,
      interpolation: String.raw`\##(two)`,
    },
  ])("uses the exact hash count for Swift $name interpolation", ({
    code,
    interpolation,
  }) => {
    const tokens = tokenize(code, swift);

    expect(recursiveTokenTexts(tokens, "interpolation")).toEqual([
      interpolation,
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("matches C# raw strings with delimiters longer than three quotes", () => {
    const code = 'var value = """"inner """ var fake = 1""""; var real = 2;';
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      '""""inner """ var fake = 1""""',
    ]);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === "var"),
    ).toHaveLength(2);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    {
      name: "one dollar",
      code: '$"""hello {name}"""',
      interpolation: "{name}",
    },
    {
      name: "two dollars",
      code: '$$"""literal {name} and {{value}}"""',
      interpolation: "{{value}}",
    },
  ])("matches C# interpolated raw strings with $name", ({
    code,
    interpolation,
  }) => {
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([code]);
    expect(recursiveTokenTexts(tokens, "interpolation")).toEqual([
      interpolation,
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    ['""""""', "raw-string"],
    ['$""""""', ["raw-string", "interpolated-string"]],
  ] as const)("matches an empty C# raw string: %s", (code, aliases) => {
    const tokens = tokenize(code, csharp);
    const raw = tokens.find(
      (token) => typeof token !== "string" && token.type === "string",
    );

    expect(raw).toBeDefined();
    expect(typeof raw === "string" ? [] : raw?.alias).toEqual(aliases);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    '$$$$$$$$$"""hello""" + 1',
    '"""""""""hello""""""""" + 1',
  ])("stops a large C# raw delimiter before following code: %s", (code) => {
    const tokens = tokenize(code, csharp);
    const strings = topLevelTokenTexts(tokens, "string");

    expect(strings).toHaveLength(1);
    expect(strings[0]).not.toContain(" + 1");
    expect(topLevelTokenTexts(tokens, "number")).toEqual(["1"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("requires an exact large C# raw-string closing delimiter", () => {
    const delimiter = '"'.repeat(10);
    const code = `${delimiter}hello ${'"'.repeat(9)} still raw${delimiter} + 1`;
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      `${delimiter}hello ${'"'.repeat(9)} still raw${delimiter}`,
    ]);
    expect(topLevelTokenTexts(tokens, "number")).toEqual(["1"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not let a commented C# raw opener conceal a later string", () => {
    const fakeDelimiter = '"'.repeat(9);
    const realDelimiter = '"'.repeat(10);
    const realString = `${realDelimiter}body${realDelimiter}`;
    const code =
      `// fake ${fakeDelimiter}\nvar value = ${realString};\n` +
      `${fakeDelimiter}\nvar real = 1;`;
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([
      `// fake ${fakeDelimiter}`,
    ]);
    expect(topLevelTokenTexts(tokens, "string")).toContain(realString);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps large C# raw strings after URLs in ordinary strings", () => {
    const delimiter = '"'.repeat(10);
    const rawString = `${delimiter}body${delimiter}`;
    const code = `var url = "http://example"; var value = ${rawString}; var real = 1;`;
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      '"http://example"',
      rawString,
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("ignores nested opener text while indexing C# block comments", () => {
    const fakeDelimiter = '"'.repeat(9);
    const realDelimiter = '"'.repeat(10);
    const realString = `${realDelimiter}body${realDelimiter}`;
    const code =
      `/* fake ${fakeDelimiter} /* marker */\nvar value = ${realString};\n` +
      `${fakeDelimiter}\nvar real = 1;`;
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([
      `/* fake ${fakeDelimiter} /* marker */`,
    ]);
    expect(topLevelTokenTexts(tokens, "string")).toContain(realString);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("ignores large quote runs inside C# verbatim strings", () => {
    const fakeDelimiter = '"'.repeat(10);
    const realDelimiter = '"'.repeat(9);
    const realString = `${realDelimiter}body${realDelimiter}`;
    const verbatimString = `@"fake ${fakeDelimiter} marker"`;
    const code =
      `var value = ${verbatimString}; var raw = ${realString};\n` +
      `${fakeDelimiter}\nvar real = 1;`;
    const tokens = tokenize(code, csharp);
    const strings = topLevelTokenTexts(tokens, "string");

    expect(strings).toContain(verbatimString);
    expect(strings.filter((text) => text === realString)).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "number")).toContain("1");
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    '$"{new Uri("https://example.test/path")}"',
    '$@"{new Uri("https://example.test/path")}"',
    '@$"{new Uri("https://example.test/path")}"',
    '$"{Get("/* fake */")}"',
  ])("keeps nested strings inside a C# interpolation: %s", (interpolated) => {
    const delimiter = '"'.repeat(10);
    const rawString = `${delimiter}body${delimiter}`;
    const code = `var text = ${interpolated}; var raw = ${rawString}; var real = 1;`;
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toContain(interpolated);
    expect(topLevelTokenTexts(tokens, "string")).toContain(rawString);
    expect(topLevelTokenTexts(tokens, "number")).toContain("1");
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps comment markers inside a C# raw string", () => {
    const code = 'var value = """"text /* not comment */"""";';
    const tokens = tokenize(code, csharp);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      '""""text /* not comment */""""',
    ]);
    expect(topLevelTokenTexts(tokens, "comment")).toEqual([]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("accepts tab-indented Bash <<- heredoc closers", () => {
    const code = "cat <<-EOF\ntext\n\tEOF\nif real; then :; fi";
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toHaveLength(1);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === "if"),
    ).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    "cat <<<word\nif real; then :; fi",
    "cat <<< hello\nif real; then :; fi",
    'cat <<<"word"\nif real; then :; fi',
  ])("does not treat a Bash here-string as a heredoc: %s", (code) => {
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([]);
    expect(topLevelTokenTexts(tokens, "keyword")).toContain("if");
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each(["<< bits", "<<-bits"])(
    "does not treat Bash arithmetic %s as a heredoc",
    (shiftExpression) => {
      const code = `a=8; bits=1; (( result = a ${shiftExpression}\n)); if real; then :; fi`;
      const tokens = tokenize(code, bash);

      expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([]);
      expect(topLevelTokenTexts(tokens, "keyword")).toContain("if");
      expect(getPlainText(tokens)).toBe(code);
    },
  );

  it.each([
    "echo $((1 + 1)) <<EOF\nbody\nEOF",
    "((x += 1)); cat <<EOF\nbody\nEOF",
  ])("matches a Bash heredoc after completed arithmetic: %s", (code) => {
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    "echo '(( literal' <<EOF\nbody\nEOF",
    'echo "(( literal" <<EOF\nbody\nEOF',
  ])("matches a Bash heredoc after quoted arithmetic text: %s", (code) => {
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([
      "<<EOF\nbody\nEOF",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not start a Bash heredoc inside a comment", () => {
    const code = "# cat <<EOF\nif fake\nEOF\nif real; then :; fi";
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual(["# cat <<EOF"]);
    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([]);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === "if"),
    ).toHaveLength(2);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not let a commented Bash opener conceal a later heredoc", () => {
    const code =
      "# fake <<FAKE\ncat <<REAL\nbody\nREAL\nFAKE\nif ok; then :; fi";
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([
      "# fake <<FAKE",
    ]);
    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([
      "<<REAL\nbody\nREAL",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("matches a Bash heredoc after an escaped separator before a hash", () => {
    const code = "echo foo\\ #fake <<REAL\nbody\nREAL";
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([]);
    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([
      "<<REAL\nbody\nREAL",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    "cat <<EOF | sed s/x/y/\nx\nEOF\necho done",
    "cat <<EOF; echo queued\nx\nEOF\necho done",
  ])("matches a Bash heredoc before trailing command syntax: %s", (code) => {
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    ["<<EOF-X", "EOF-X"],
    ['<<E"OF-X"', "EOF-X"],
    ["<<EOF\\-X", "EOF-X"],
    ['<<"E\\Q"', "E\\Q"],
  ])("matches a Bash heredoc with delimiter word %s", (opener, closer) => {
    const code = `cat ${opener}\nx\n${closer}\necho done`;
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("groups multiple Bash heredocs without misattributing their bodies", () => {
    const code =
      "cat <<FIRST <<SECOND\none\nFIRST\ntwo\nSECOND\necho done";
    const tokens = tokenize(code, bash);

    expect(topLevelTokenTexts(tokens, "heredoc")).toEqual([
      "<<FIRST <<SECOND\none\nFIRST\ntwo\nSECOND",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not treat a Ruby lowercase shift operand as a heredoc", () => {
    const code = "items <<value\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each(["<<-bits", "<<~bits"])(
    "does not treat a Ruby %s shift operand as a heredoc",
    (operatorAndOperand) => {
      const code = `result = mask ${operatorAndOperand}\nif real\nend`;
      const tokens = tokenize(code, ruby);

      expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([]);
      expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
      expect(getPlainText(tokens)).toBe(code);
    },
  );

  it("matches a terminated lowercase Ruby heredoc", () => {
    const code = "value = <<text\nbody\ntext\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<text\nbody\ntext\n",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("allows opener-like lines in a terminated lowercase Ruby heredoc", () => {
    const code = "puts <<doc\ntext <<other\nif fake\ndoc\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<doc\ntext <<other\nif fake\ndoc\n",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("allows an opener-like final body line in a lowercase Ruby heredoc", () => {
    const code = "puts <<doc\ntext <<other\ndoc\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<doc\ntext <<other\ndoc\n",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("allows many opener-like lines in a lowercase Ruby heredoc", () => {
    const body = Array.from({ length: 6 }, (_, index) => `text <<other${index}`)
      .join("\n");
    const code = `puts <<doc\n${body}\ndoc\nif real\nend`;
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("allows an opener-like line immediately before a Ruby heredoc closer", () => {
    const code = "puts <<doc\ntext <<other\ndoc\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<doc\ntext <<other\ndoc\n",
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("allows more than four opener-like lines in a Ruby heredoc", () => {
    const body = Array.from(
      { length: 5 },
      (_, index) => `text <<other${index}`,
    ).join("\n");
    const code = `puts <<doc\n${body}\nif fake\ndoc\nif real\nend`;
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      `<<doc\n${body}\nif fake\ndoc\n`,
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["if", "end"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not start a Ruby heredoc inside a comment", () => {
    const code = "# puts <<DOC\nif fake\nDOC\nif real\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual(["# puts <<DOC"]);
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([]);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === "if"),
    ).toHaveLength(2);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not let a commented Ruby opener conceal a later heredoc", () => {
    const code =
      "# fake <<FAKE\nputs <<REAL\nbody\nREAL\nFAKE\nif ok\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "comment")).toEqual([
      "# fake <<FAKE",
    ]);
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<REAL\nbody\nREAL\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    'puts "# fake"; puts <<REAL\nbody\nREAL\nif ok\nend',
    "puts '# fake'; puts <<REAL\nbody\nREAL\nif ok\nend",
  ])("matches a Ruby heredoc after a quoted hash: %s", (code) => {
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<REAL\nbody\nREAL\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not let a multiline Ruby string conceal a later heredoc", () => {
    const code =
      'text = "<<FAKE\ninside"\nputs <<REAL\nbody\nREAL\nFAKE\nif ok\nend';
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "string")).toContain(
      '"<<FAKE\ninside"',
    );
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<REAL\nbody\nREAL\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    "pattern = /# not comment/; puts <<REAL\nbody\nREAL\nif ok\nend",
    "puts /# not comment/; puts <<REAL\nbody\nREAL\nif ok\nend",
    "pattern = /foo\n# not comment/; puts <<REAL\nbody\nREAL\nif ok\nend",
    "%q|# not comment|; puts <<REAL\nbody\nREAL\nif ok\nend",
    "cmd = `echo # not ruby comment`; puts <<REAL\nbody\nREAL\nif ok\nend",
    "cmd = `echo <<FAKE`; puts <<REAL\nbody\nREAL\nFAKE\nif ok\nend",
  ])("matches a Ruby heredoc after a literal hash: %s", (code) => {
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<REAL\nbody\nREAL\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    "value %= divisor # closing =; puts <<FAKE\nreal = true",
    "value = left / divisor # slash /; puts <<FAKE\nreal = true",
    "left = 9; divisor = 2; value = left /divisor # slash /; puts <<FAKE\nreal = true",
    "def divide(left, divisor)\nvalue = left /divisor # slash /; puts <<FAKE\nreal = true\nend",
    "def emit(foo, divisor)\npattern = /end/\nvalue = foo /divisor # slash /; puts <<FAKE\nreal = true\nend",
    "def emit(divisor)\nwhile ready do\nleft = 9\nend\nvalue = left /divisor # slash /; puts <<FAKE\nreal = true\nend",
    "def emit(foo, divisor)\nresult = if ready\n1\nend\nvalue = foo /divisor # slash /; puts <<FAKE\nreal = true\nend",
    "items.each { |left, divisor| value = left /divisor # slash /; puts <<FAKE\nreal = true }",
    "left, divisor = 9, 2; value = left /divisor # slash /; puts <<FAKE\nreal = true",
    "value = left /divisor # slash /; puts <<FAKE\nleft = 9; divisor = 2",
  ])("does not confuse a Ruby operator with a literal: %s", (code) => {
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "comment")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps a real Ruby heredoc before compact local division", () => {
    const code =
      "def emit(foo, divisor)\ndoc = <<TEXT\nend\nTEXT\nvalue = foo /divisor # slash /; puts <<FAKE\nreal = true\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "comment")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<TEXT\nend\nTEXT\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("skips every Ruby heredoc body while indexing local scopes", () => {
    const code =
      "def emit(foo, divisor)\nputs(<<FIRST, <<SECOND)\none\nFIRST\nend\nSECOND\nvalue = foo /divisor # slash /; puts <<FAKE\nreal = true\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "comment")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<FIRST, <<SECOND)\none\nFIRST\nend\nSECOND\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not treat a Ruby writer method as a local assignment", () => {
    const code =
      "obj.foo = 1; foo /# not comment/; puts <<REAL\nbody\nREAL\nif ok\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "regex")).toContain("/# not comment/");
    expect(topLevelTokenTexts(tokens, "triple-string")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not leak Ruby locals into a method scope", () => {
    const code =
      "foo = 1\ndef emit\nfoo /# not comment/; puts <<REAL\nbody\nREAL\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "regex")).toContain("/# not comment/");
    expect(topLevelTokenTexts(tokens, "triple-string")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each(["/foo/x", "//", "/foo/imxounes"]) (
    "matches Ruby regex options and empty bodies: %s",
    (regex) => {
      const code = `pattern = ${regex}`;
      expect(topLevelTokenTexts(tokenize(code, ruby), "regex")).toEqual([
        regex,
      ]);
    },
  );

  it.each([
    'puts <<"REAL"\nbody\nREAL\nif ok\nend',
    'puts <<"END-MARK"\nbody\nEND-MARK\nif ok\nend',
    "puts(<<REAL)\nbody\nREAL\nif ok\nend",
    "puts <<REAL.upcase\nbody\nREAL\nif ok\nend",
  ])("matches a Ruby heredoc with surrounding syntax: %s", (code) => {
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("groups multiple Ruby heredocs in body order", () => {
    const code =
      "puts(<<FIRST, <<SECOND)\none\nFIRST\ntwo\nSECOND\nif ok\nend";
    const tokens = tokenize(code, ruby);

    expect(topLevelTokenTexts(tokens, "triple-string")).toEqual([
      "<<FIRST, <<SECOND)\none\nFIRST\ntwo\nSECOND\n",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    ["heredoc", "<<<TEXT", "  TEXT;"],
    ["nowdoc", "<<<'TEXT'", "\tTEXT;"],
  ] as const)("accepts indented PHP %s closers", (_name, opener, closer) => {
    const code = `<?php\n$value = ${opener}\nbody\n${closer}\nfunction real() {}`;
    const tokens = tokenize(code, php);

    expect(topLevelTokenTexts(tokens, "string")).toHaveLength(1);
    expect(topLevelTokenTexts(tokens, "keyword")).toContain("function");
    expect(getPlainText(tokens)).toBe(code);
  });

  it("recognizes Rust 'static as a lifetime", () => {
    const code = "fn borrow(value: &'static str, other: &'a str) {}";
    const tokens = tokenize(code, rust);

    expect(topLevelTokenTexts(tokens, "lifetime")).toEqual(["'static", "'a"]);
    expect(topLevelTokenTexts(tokens, "keyword")).not.toContain("static");
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    ["C++", cpp, "true false nil", ["true", "false"]],
    ["Bash", bash, "true false", ["true", "false"]],
    ["SQL", sql, "SELECT TRUE, FALSE", ["TRUE", "FALSE"]],
    ["Ruby", ruby, "true false nil", ["true", "false", "nil"]],
  ] as const)("keeps %s literals in boolean tokens", (_name, grammar, code, expected) => {
    expect(topLevelTokenTexts(tokenize(code, grammar), "boolean")).toEqual(
      expected,
    );
  });

  it.each([
    ["C", c],
    ["C#", csharp],
    ["CSS", css],
    ["Go", go],
    ["Java", java],
    ["JavaScript", javascript],
    ["JSONC", json],
    ["Less", less],
    ["PHP", php],
    ["SCSS", scss],
    ["Solidity", solidity],
    ["SQL", sql],
    ["Terraform", terraform],
  ] as const)(
    "treats an inner opener as content in non-nesting %s block comments",
    (_name, grammar) => {
      const code = "/* prefix /* marker */ suffix";
      const tokens = tokenize(code, grammar);

      expect(topLevelTokenTexts(tokens, "comment")).toEqual([
        "/* prefix /* marker */",
      ]);
      expect(getPlainText(tokens)).toBe(code);
    },
  );

  it.each([
    ["C block comment", c, "/* prefix /* marker", "comment"],
    ["Bash heredoc", bash, "<<EOF\nbody", "heredoc"],
    ["PHP heredoc", php, "<<<EOF\nbody", "string"],
    ["Ruby heredoc", ruby, "<<EOF\nbody", "triple-string"],
    ["Terraform heredoc", terraform, "<<EOF\nbody", "heredoc-string"],
    ["Lua long string", lua, "[[body", "string"],
  ] as const)(
    "keeps an unfinished %s token through end of input",
    (_name, grammar, code, tokenType) => {
      const tokens = tokenize(code, grammar);

      expect(topLevelTokenTexts(tokens, tokenType)).toEqual([code]);
      expect(getPlainText(tokens)).toBe(code);
    },
  );

  it.each([
    {
      name: "Bash",
      grammar: bash,
      tokenType: "heredoc",
      keyword: "if",
      code: "cat <<EOF\ntext << value\nif fake\nEOF\nif real; then :; fi",
    },
    {
      name: "Ruby",
      grammar: ruby,
      tokenType: "triple-string",
      keyword: "if",
      code: "doc = <<TEXT\ntext << value\nif fake\nTEXT\nif real\nend",
    },
    {
      name: "Terraform",
      grammar: terraform,
      tokenType: "heredoc-string",
      keyword: "resource",
      code: "value = <<EOF\ntext << value\nresource fake\nEOF\nresource real {}",
    },
    {
      name: "PHP",
      grammar: php,
      tokenType: "string",
      keyword: "function",
      code: "<?php\n$value = <<<TEXT\ntext <<< value\nfunction fake() {}\nTEXT;\nfunction real() {}",
    },
  ])("allows opener-like text inside $name heredocs", ({
    grammar,
    tokenType,
    keyword,
    code,
  }) => {
    const tokens = tokenize(code, grammar);

    expect(topLevelTokenTexts(tokens, tokenType)).toHaveLength(1);
    expect(
      topLevelTokenTexts(tokens, "keyword").filter((text) => text === keyword),
    ).toHaveLength(1);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each([
    {
      name: "Rust",
      grammar: rust,
      code: "/* outer /* inner */ fn fake() */ fn real() {}",
      comment: "/* outer /* inner */ fn fake() */",
      keyword: "fn",
    },
    {
      name: "Swift",
      grammar: swift,
      code: "/* outer /* inner */ let fake = 1 */ let real = 2",
      comment: "/* outer /* inner */ let fake = 1 */",
      keyword: "let",
    },
    {
      name: "Scala",
      grammar: scala,
      code: "/* outer /* inner */ val fake = 1 */ val real = 2",
      comment: "/* outer /* inner */ val fake = 1 */",
      keyword: "val",
    },
    {
      name: "OCaml",
      grammar: ocaml,
      code: "(* outer (* inner *) let fake = 1 *) let real = 2",
      comment: "(* outer (* inner *) let fake = 1 *)",
      keyword: "let",
    },
    {
      name: "Haskell",
      grammar: haskell,
      code: "{- outer {- inner -} let fake = 1 -} let real = 2",
      comment: "{- outer {- inner -} let fake = 1 -}",
      keyword: "let",
    },
    {
      name: "Kotlin",
      grammar: kotlin,
      code: "/* outer /* inner */ val fake = 1 */ val real = 2",
      comment: "/* outer /* inner */ val fake = 1 */",
      keyword: "val",
    },
    {
      name: "Dart",
      grammar: dart,
      code: "/* outer /* inner */ final fake = 1; */ final real = 2;",
      comment: "/* outer /* inner */ final fake = 1; */",
      keyword: "final",
    },
    {
      name: "Nix",
      grammar: nix,
      code: "/* outer /* inner */ let fake = 1; */ let real = 2;",
      comment: "/* outer /* inner */ let fake = 1; */",
      keyword: "let",
    },
  ])("keeps nested $name block comments intact", ({
    grammar,
    code,
    comment,
    keyword,
  }) => {
    const tokens = tokenize(code, grammar);
    const comments = tokens.filter(
      (token) => typeof token !== "string" && token.type === "comment",
    );
    const keywords = tokens.filter(
      (token) => typeof token !== "string" && token.type === "keyword",
    );

    expect(comments).toHaveLength(1);
    expect(getPlainText(comments)).toBe(comment);
    expect(keywords).toHaveLength(1);
    expect(getPlainText(keywords)).toBe(keyword);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("distinguishes PHP 8 attributes and PHPDoc from comments", () => {
    const attributeTokens = tokenize(
      '#[Route("/users")] function listUsers() {}',
      php,
    );
    expect(hasTokenType(attributeTokens, "attribute")).toBe(true);
    expect(hasTokenType(attributeTokens, "function")).toBe(true);

    const docTokens = tokenize("/** @param string $value */", php);
    expect(hasTokenType(docTokens, "doc-comment")).toBe(true);
    expect(hasTokenType(docTokens, "tag")).toBe(true);
  });

  it("requires matching Rust raw-string hash delimiters", () => {
    const code = 'let value = r##"a"# still raw"##;';
    const tokens = tokenize(code, rust);
    const rawString = tokens.find(
      (token) => typeof token !== "string" && token.type === "string",
    );

    expect(rawString).toBeDefined();
    expect(
      typeof rawString === "string" || rawString === undefined
        ? undefined
        : getPlainText([rawString]),
    ).toBe('r##"a"# still raw"##');
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps Swift extended string delimiters balanced", () => {
    const code = 'let s = #"quote " let fake = 1"#; let real = 2';
    const tokens = tokenize(code, swift);

    expect(topLevelTokenTexts(tokens, "string")).toContain(
      '#"quote " let fake = 1"#',
    );
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["let", "let"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("does not treat backslashes as escapes in Dart raw strings", () => {
    const code = String.raw`final path = r"C:\"; final real = "ok";`;
    const tokens = tokenize(code, dart);

    expect(topLevelTokenTexts(tokens, "string")).toEqual([
      String.raw`r"C:\"`,
      '"ok"',
    ]);
    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["final", "final"]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it("keeps Rust raw identifiers out of keyword tokens", () => {
    const code = 'let r#match = 1; println!("{}", r#match);';
    const tokens = tokenize(code, rust);

    expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["let"]);
    expect(topLevelTokenTexts(tokens, "raw-identifier")).toEqual([
      "r#match",
      "r#match",
    ]);
    expect(getPlainText(tokens)).toBe(code);
  });

  it.each(["@", "$@", "@$"])(
    "does not treat backslashes as escapes in C# %s verbatim strings",
    (prefix) => {
      const code = String.raw`var path = ${prefix}"C:\"; var real = "ok";`;
      const tokens = tokenize(code, csharp);

      expect(topLevelTokenTexts(tokens, "string")).toEqual([
        `${prefix}"C:\\"`,
        '"ok"',
      ]);
      expect(topLevelTokenTexts(tokens, "keyword")).toEqual(["var", "var"]);
      expect(getPlainText(tokens)).toBe(code);
    },
  );

  it("recognizes JavaScript regular expressions with the v flag", () => {
    const tokens = tokenize("const value = /[a&&b]/v;", javascript);
    expect(hasTokenType(tokens, "regex")).toBe(true);
  });
});
