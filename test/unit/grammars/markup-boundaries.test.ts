import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import fixtures from "../../fixtures/markup-boundaries.json";
import { html } from "../../../src/grammars/html";
import { vue } from "../../../src/grammars/vue";
import { svelte } from "../../../src/grammars/svelte";
import { verify, type AccuracyFixture } from "./accuracy-helpers";
import { scanMarkup } from "../../../src/grammars/shared/markup-scanner";

for (const grammar of [html, vue, svelte]) {
  describe(`${grammar.name} host boundaries`, () => {
    it.each(fixtures[grammar.name as keyof typeof fixtures])("$name", fixture => {
      verify(grammar, fixture as AccuracyFixture);
      if (grammar === html && fixture.code.startsWith("<script")) {
        const document = new JSDOM(fixture.code).window.document;
        const body = scanMarkup(fixture.code, "html").find(range => range.kind === "script");
        expect(body && fixture.code.slice(body.start, body.end)).toBe(document.querySelector("script")?.textContent);
        document.defaultView?.close();
      }
    });
  });
}
