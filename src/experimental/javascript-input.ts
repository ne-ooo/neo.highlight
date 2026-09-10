import type { JavaScriptScanInput, LexicalRange } from "../grammars/shared/javascript-scanner";
const LINE_END = /[\r\n\u2028\u2029]/;

/** Experimental input reader. Each generator suspends with its cursor intact. */
export function createJavaScriptInput(initial: string): JavaScriptScanInput {
  let source = initial;
  let updateSource = (_source: string): void => {};
  const input: JavaScriptScanInput = {
    source, final: false,
    attachSource(update) { updateSource = update; },
    available, readQuoted, readRegex, readIdentifier,
  };
  // Suspensions retain the lexical stack and local cursor inside unfinished lexemes.
  function* available(position: number): Generator<LexicalRange, boolean> {
    while (input && !input.final && position >= input.source.length) {
      yield { kind: "input", start: position, end: position };
    }
    source = input.source;
    updateSource(source);
    return position < source.length;
  }
  function* readQuoted(start: number): Generator<LexicalRange, number> {
    const quote = source[start];
    let cursor = start + 1;
    while (yield* available(cursor)) {
      const char = source[cursor]!;
      if (char === quote) return cursor + 1;
      if (LINE_END.test(char)) return cursor;
      if (char === "\\") {
        yield* available(cursor + 1);
        if (source[cursor + 1] === "\r") yield* available(cursor + 2);
        cursor += source[cursor + 1] === "\r" && source[cursor + 2] === "\n" ? 3 : 2;
      } else cursor++;
    }
    return source.length;
  }
  function* readRegex(start: number): Generator<LexicalRange, number> {
    let cursor = start + 1, inClass = false;
    while (yield* available(cursor)) {
      const char = source[cursor]!;
      if (LINE_END.test(char)) return cursor;
      if (char === "\\") { yield* available(cursor + 1); cursor += 2; continue; }
      if (char === "[") inClass = true;
      else if (char === "]") inClass = false;
      else if (char === "/" && !inClass) {
        cursor++;
        while ((yield* available(cursor)) && /[a-z]/i.test(source[cursor]!)) cursor++;
        return cursor;
      }
      cursor++;
    }
    return source.length;
  }
  function* identifierAtom(cursor: number, first: boolean): Generator<LexicalRange, number> {
    if (!(yield* available(cursor))) return cursor;
    if (source[cursor] === "\\") {
      if (!(yield* available(cursor + 1)) || source[cursor + 1] !== "u") return cursor;
      if (!(yield* available(cursor + 2))) return cursor;
      if (source[cursor + 2] === "{") {
        let end = cursor + 3;
        while (end < cursor + 9 && (yield* available(end)) && /[\da-f]/i.test(source[end]!)) end++;
        yield* available(end);
        return end > cursor + 3 && source[end] === "}" ? end + 1 : cursor;
      }
      for (let end = cursor + 2; end < cursor + 6; end++) {
        if (!(yield* available(end)) || !/[\da-f]/i.test(source[end]!)) return cursor;
      }
      return cursor + 6;
    }
    const unit = source.charCodeAt(cursor);
    if (unit >= 0xd800 && unit <= 0xdbff) yield* available(cursor + 1);
    const char = String.fromCodePoint(source.codePointAt(cursor)!);
    return (first ? /[$_\p{ID_Start}]/u : /[$\u200c\u200d\p{ID_Continue}]/u).test(char) ? cursor + char.length : cursor;
  }
  function* readIdentifier(start: number): Generator<LexicalRange, number> {
    let cursor = yield* identifierAtom(start, true);
    if (cursor === start) return start;
    for (;;) {
      const next = yield* identifierAtom(cursor, false);
      if (next === cursor) return cursor;
      cursor = next;
    }
  }
  return input;
}
