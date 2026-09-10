import { describe, expect, it } from "vitest";
import fixtures from "../../fixtures/javascript-context.json";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { jsx } from "../../../src/grammars/jsx";
import { tsx } from "../../../src/grammars/tsx";
import { tokenize } from "../../../src/core/tokenizer";
import { spansOf, verify, type AccuracyFixture } from "./accuracy-helpers";

for (const grammar of [javascript, typescript, jsx, tsx]) {
  describe(`${grammar.name} statement and identifier contexts`, () => {
    it.each([...fixtures.shared, ...(grammar === typescript || grammar === tsx ? fixtures.typed : [])])("$name", fixture => {
      verify(grammar, { spans: [], ...fixture } as AccuracyFixture);
      expect(spansOf(tokenize(fixture.code, grammar)).filter(span => span.type === "regex").map(span => span.text)).toEqual(fixture.regexes);
    });
  });
}

describe("TSX generic boundaries", () => {
  it.each(fixtures.tsx)("$name", fixture => verify(tsx, fixture as AccuracyFixture));
});

it.each(fixtures.jsx)("JSX: $name", fixture => verify(jsx, fixture as AccuracyFixture));
