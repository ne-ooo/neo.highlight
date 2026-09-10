import type { TokenMatcherContext } from "../../core/types";

/** Lexical boundaries for JavaScript, TypeScript, and their JSX variants. */
export type LexicalKind = "comment" | "string" | "template" | "regex" | "tag" | "text" | "expression" | "interpolation" | "attr-value" | "identifier" | "type-arguments" | "input" | "checkpoint";
export type ScanMode = "code" | "template" | "tag" | "expression";
export interface LexicalRange {
  kind: LexicalKind;
  start: number;
  end: number;
  property?: boolean;
}

/** Internal coroutine input. Only plain JavaScript/TypeScript code supports continuation. */
export interface JavaScriptScanInput {
  source: string;
  final: boolean;
  attachSource(update: (source: string) => void): void;
  available(position: number): Generator<LexicalRange, boolean>;
  readQuoted(start: number): Generator<LexicalRange, number>;
  readRegex(start: number): Generator<LexicalRange, number>;
  readIdentifier(start: number): Generator<LexicalRange, number>;
}

interface CodeFrame {
  mode: "code";
  emit: boolean;
  start: number;
  expression?: "expression" | "interpolation" | "type-arguments";
  angleDepth?: number;
  braces: { regexAfter: boolean; statement: boolean; parens: number }[];
  parens: boolean[];
  brackets: number;
  bodies: { kind: "function" | "class"; expression: boolean; braces: number; parens: number; brackets: number; parameters: "pending" | "open" | "closed"; typeAnnotation: boolean }[];
  statementStart: boolean;
  label: boolean;
  lineBreak: boolean;
  expectExpression: boolean;
  previous: string;
}
interface TemplateFrame {
  mode: "template";
  start: number;
  emit: boolean;
  children: boolean;
}
interface JsxFrame {
  mode: "jsx";
  emit: boolean;
  depth: number;
}
interface TagFrame {
  mode: "tag";
  start: number;
  emit: boolean;
  children: boolean;
  closing: boolean;
}
type Frame = CodeFrame | TemplateFrame | JsxFrame | TagFrame;

const EXPRESSION_KEYWORDS = /^(?:return|throw|case|delete|void|typeof|new|in|instanceof|yield|await|else|do|of|default)$/;
const CONTROL_KEYWORDS = /^(?:if|while|for|for-await|with|switch|catch)$/;
const LINE_END = /[\r\n\u2028\u2029]/;

function codeFrame(emit: boolean, start = 0, expression?: CodeFrame["expression"]): CodeFrame {
  return { mode: "code", emit, start, ...(expression ? { expression } : {}),
    braces: [], parens: [], brackets: 0, bodies: [], statementStart: !expression,
    label: false, lineBreak: false, expectExpression: true, previous: "" };
}

export function skipJavaScriptTrivia(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index]!)) { index++; continue; }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end < 0 ? source.length : end + 2;
    } else if (source.startsWith("//", index)) {
      index += 2;
      while (index < source.length && !LINE_END.test(source[index]!)) index++;
    } else break;
  }
  return index;
}

function quotedEnd(source: string, start: number, jsx: boolean): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    const char = source[index]!;
    if (char === quote) return index + 1;
    if (!jsx && LINE_END.test(char)) return index;
    if (!jsx && char === "\\") {
      index += source[index + 1] === "\r" && source[index + 2] === "\n" ? 3 : 2;
    } else index++;
  }
  return source.length;
}

function regexEnd(source: string, start: number): number {
  let inClass = false;
  let index = start + 1;
  for (; index < source.length; index++) {
    const char = source[index]!;
    if (LINE_END.test(char)) return index;
    if (char === "\\") { index++; continue; }
    if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) {
      index++;
      while (/[a-z]/i.test(source[index] ?? "")) index++;
      return index;
    }
  }
  return source.length;
}

/** Only inspect the tag prefix; the state machine scans attributes once. */
function tagStart(source: string, start: number, typed = false): { end: number; closing: boolean } | undefined {
  let index = start + 1;
  const closing = source[index] === "/";
  if (closing) index++;
  if (source[index] === ">") return { end: index, closing };
  const name = /^[\p{ID_Start}_$][\p{ID_Continue}$.:\-]*/u.exec(source.slice(index));
  if (!name) return undefined;
  index += name[0].length;
  if (index < source.length && !/[\s/<>]/.test(source[index]!)) return undefined;
  if (typed && !closing) {
    const next = skipJavaScriptTrivia(source, index);
    if (source[next] === "," || source[next] === "=") return undefined;
    if (name[0] === "const" && next > index && /[$_\p{ID_Start}]/u.test(source[next] ?? "")) return undefined;
    if (source.startsWith("extends", next) && !/[$\p{ID_Continue}]/u.test(source[next + 7] ?? "")) {
      const constraint = skipJavaScriptTrivia(source, next + 7);
      if (!/[=>/]/.test(source[constraint] ?? "")) return undefined;
    }
  }
  return { end: index, closing };
}

/**
 * Walk once with an explicit stack. Nested delimiters never recurse in the scanner.
 * Emit only the current grammar layer; nested templates/expressions are tokenized
 * through `inside`, which shares the tokenizer's match, node, and depth limits.
 */
export function* scanJavaScript(source: string, jsx: boolean, mode: ScanMode = "code", context?: TokenMatcherContext, startIndex = 0, contentStart = startIndex + 1, typed = false, closingSequence = "}", input?: JavaScriptScanInput): Iterable<LexicalRange> {
  if (input && (jsx || mode !== "code" || startIndex !== 0)) throw new TypeError("JavaScript continuation requires plain code mode");
  const stack: Frame[] = [];
  const identifier = /(?:[$_\p{ID_Start}]|\\u(?:[\da-fA-F]{4}|\{[\da-fA-F]{1,6}\}))(?:[$\u200c\u200d\p{ID_Continue}]|\\u(?:[\da-fA-F]{4}|\{[\da-fA-F]{1,6}\}))*/uy;
  const remainingDepth = (context?.maxTokenDepth ?? 100) - (context?.depth ?? 0);
  let index = 0;
  let openAngles = 0;
  input?.attachSource(updated => { source = updated; });
  if (mode === "expression") {
    stack.push(codeFrame(true, startIndex, "expression"));
    index = contentStart;
  } else if (mode === "template") {
    stack.push({ mode: "template", start: 0, emit: false, children: true });
    index = source[0] === "`" ? 1 : 0;
  } else if (mode === "tag") {
    const tag = tagStart(source, 0, typed);
    stack.push({ mode: "tag", start: 0, emit: false, children: true, closing: tag?.closing ?? false });
    index = tag?.end ?? 0;
  } else stack.push(codeFrame(true));

  while ((index < source.length || input && !input.final) && stack.length) {
    if (input && !(yield* input!.available(index))) break;
    // Each template/expression grammar layer uses at least half this many frames.
    // Bound temporary scanner state before it can allocate a deeply nested tree.
    if (stack.length > 2 * (remainingDepth + 1) + 4) {
      throw new RangeError(`JavaScript nesting exceeds maxTokenDepth ${context?.maxTokenDepth ?? 100}`);
    }
    const frame = stack[stack.length - 1]!;
    const char = source[index]!;

    if (frame.mode === "template") {
      if (input && (char === "\\" || char === "$")) yield* input!.available(index + 1);
      if (char === "\\") { index = Math.min(index + 2, source.length); continue; }
      if (char === "`") {
        index++;
        stack.pop();
        if (frame.emit) yield { kind: "template", start: frame.start, end: index };
      } else if (char === "$" && source[index + 1] === "{") {
        stack.push(codeFrame(frame.children, index, "interpolation"));
        index += 2;
      } else index++;
      continue;
    }

    if (frame.mode === "tag") {
      if (char === "<") {
        stack.push({ ...codeFrame(frame.children, index, "type-arguments"), angleDepth: 1 });
        index++;
      } else if (char === '"' || char === "'") {
        const end = quotedEnd(source, index, true);
        if (frame.children) yield { kind: "attr-value", start: index, end };
        index = end;
      } else if (char === "{") {
        stack.push(codeFrame(frame.children, index, "expression"));
        index++;
      } else if (char === ">") {
        const selfClosing = source[index - 1] === "/";
        index++;
        stack.pop();
        const parent = stack[stack.length - 1];
        if (parent?.mode === "jsx") {
          parent.depth += frame.closing ? -1 : selfClosing ? 0 : 1;
          if (parent.depth <= 0) stack.pop();
        }
        if (frame.emit) yield { kind: "tag", start: frame.start, end: index };
      } else index++;
      continue;
    }

    if (frame.mode === "jsx") {
      if (char === "{") {
        stack.push(codeFrame(frame.emit, index, "expression"));
        index++;
        continue;
      }
      const tag = char === "<" ? tagStart(source, index) : undefined;
      if (tag) {
        stack.push({ mode: "tag", start: index, emit: frame.emit, children: false, closing: tag.closing });
        index = tag.end;
        continue;
      }
      const start = index++;
      while (index < source.length && source[index] !== "<" && source[index] !== "{") index++;
      if (frame.emit) yield { kind: "text", start, end: index };
      continue;
    }

    if (/\s/.test(char)) {
      frame.lineBreak ||= LINE_END.test(char);
      if (frame.lineBreak && /^(?:return|yield|break|continue)$/.test(frame.previous)) {
        frame.statementStart = frame.expectExpression = true;
      }
      index++;
      continue;
    }
    const start = index;
    // Code inside an emitted expression belongs to the next grammar layer.
    const emit = frame.emit && !frame.expression;
    if (input && /[/#?=+\-]/.test(char)) yield* input!.available(index + 1);
    if ((char === "/" && /[/*]/.test(source[index + 1] ?? "")) || (index === 0 && source.startsWith("#!"))) {
      if (source[index + 1] === "*") {
        let search = index + 2;
        let close = source.indexOf("*/", search);
        while (input && !input.final && close < 0) {
          search = Math.max(search, source.length - 1);
          yield* input!.available(source.length);
          close = source.indexOf("*/", search);
        }
        index = close === -1 ? source.length : close + 2;
      } else {
        index += 2;
        while ((input ? yield* input!.available(index) : index < source.length) && !LINE_END.test(source[index]!)) index++;
      }
      if (emit) yield { kind: "comment", start, end: index };
      frame.lineBreak ||= LINE_END.test(source.slice(start, index));
      continue;
    }
    if (char === '"' || char === "'") {
      index = input ? yield* input!.readQuoted(index) : quotedEnd(source, index, false);
      frame.expectExpression = false;
      frame.previous = "literal";
      frame.statementStart = frame.label = frame.lineBreak = false;
      if (emit) yield { kind: "string", start, end: index };
      continue;
    }
    if (char === "`") {
      stack.push({ mode: "template", start, emit, children: false });
      frame.expectExpression = false;
      frame.previous = "literal";
      frame.statementStart = frame.label = frame.lineBreak = false;
      index++;
      continue;
    }
    if (char === "/" && frame.expectExpression) {
      index = input ? yield* input!.readRegex(index) : regexEnd(source, index);
      frame.expectExpression = false;
      frame.previous = "literal";
      frame.statementStart = frame.label = frame.lineBreak = false;
      if (emit) yield { kind: "regex", start, end: index };
      continue;
    }
    if (jsx && char === "<" && frame.expectExpression && frame.angleDepth === undefined) {
      const tag = tagStart(source, index, typed);
      if (tag && !tag.closing) {
        stack.push({ mode: "jsx", emit, depth: 0 });
        stack.push({ mode: "tag", start, emit, children: false, closing: false });
        frame.expectExpression = false;
        frame.previous = "literal";
        frame.statementStart = frame.label = frame.lineBreak = false;
        index = tag.end;
        continue;
      }
    }
    identifier.lastIndex = index;
    let word: readonly string[] | null;
    if (input) {
      const end = yield* input!.readIdentifier(index);
      word = end > index ? [source.slice(index, end)] : null;
      identifier.lastIndex = end;
    } else word = identifier.exec(source);
    if (word) {
      index = identifier.lastIndex;
      const property = frame.previous === "." || frame.previous === "?.";
      const declaration = frame.statementStart || (frame.lineBreak && !frame.expectExpression);
      if (!property && (word[0] === "function" || word[0] === "class")) {
        frame.bodies.push({ kind: word[0], expression: !declaration, braces: frame.braces.length,
          parens: frame.parens.length, brackets: frame.brackets, parameters: "pending", typeAnnotation: false });
      }
      frame.label = frame.statementStart && !property;
      frame.statementStart = !property && (/^(?:else|do|try|finally)$/.test(word[0]!)
        || (declaration && /^(?:export|default|async|declare|abstract)$/.test(word[0]!)));
      frame.expectExpression = !property && EXPRESSION_KEYWORDS.test(word[0]!);
      frame.previous = property ? "property" : word[0] === "await" && frame.previous === "for" ? "for-await" : word[0]!;
      frame.lineBreak = false;
      if (emit) yield { kind: "identifier", start, end: index, property };
      continue;
    }
    if (/\d/.test(char)) {
      index++;
      while ((input ? yield* input!.available(index) : index < source.length) && /[\w.]/.test(source[index]!)) index++;
      frame.expectExpression = false;
      frame.previous = "literal";
      frame.statementStart = frame.label = frame.lineBreak = false;
      continue;
    }
    if (input && typed && emit) {
      if (char === "<") openAngles++;
      else if (char === ">" && source[index - 1] !== "=") openAngles = Math.max(0, openAngles - 1);
    }
    if (frame.angleDepth !== undefined && char === "<") {
      frame.angleDepth++;
      frame.expectExpression = true;
    } else if (frame.angleDepth !== undefined && char === ">") {
      frame.angleDepth--;
      if (frame.angleDepth === 0) {
        stack.pop();
        index++;
        if (frame.emit) yield { kind: "type-arguments", start: frame.start, end: index };
        continue;
      }
      frame.expectExpression = false;
    } else if (char === "{") {
      const body = frame.bodies.at(-1);
      const atBodyDepth = body && body.braces === frame.braces.length && body.parens === frame.parens.length
        && body.brackets === frame.brackets && (body.kind === "class" || body.parameters === "closed");
      const typeObject = atBodyDepth && body.typeAnnotation && /^(?::|\?|&|\||=>|<|,)$/.test(frame.previous);
      const beginsBody = atBodyDepth && !typeObject;
      const statement = !typeObject && (Boolean(beginsBody) || frame.statementStart || /^(?:=>|\)|else|try|finally|do)$/.test(frame.previous));
      const regexAfter = beginsBody ? !body.expression : frame.previous !== "=>" && statement;
      if (beginsBody) frame.bodies.pop();
      frame.braces.push({ regexAfter, statement, parens: frame.parens.length });
      frame.expectExpression = true;
      frame.statementStart = statement;
    } else if (char === "}") {
      if (frame.braces.length === 0 && frame.expression && frame.angleDepth === undefined) {
        const closing = mode === "expression" && stack.length === 1 ? closingSequence : "}";
        if (!source.startsWith(closing, index)) { index++; continue; }
        stack.pop();
        index += closing.length;
        if (frame.emit) yield { kind: frame.expression, start: frame.start, end: index };
        continue;
      }
      frame.expectExpression = frame.braces.pop()?.regexAfter ?? true;
      frame.statementStart = frame.expectExpression;
      while (frame.bodies.length && frame.bodies.at(-1)!.braces > frame.braces.length) frame.bodies.pop();
    } else if (char === "(") {
      const body = frame.bodies.at(-1);
      if (body?.kind === "function" && body.parameters === "pending" && body.braces === frame.braces.length
        && body.parens === frame.parens.length && body.brackets === frame.brackets) body.parameters = "open";
      frame.parens.push(CONTROL_KEYWORDS.test(frame.previous));
      frame.expectExpression = true;
      frame.statementStart = false;
    } else if (char === ")") {
      frame.expectExpression = frame.parens.pop() ?? false;
      frame.statementStart = frame.expectExpression;
      const body = frame.bodies.at(-1);
      if (body?.kind === "function" && body.parameters === "open" && body.parens === frame.parens.length
        && body.braces === frame.braces.length && body.brackets === frame.brackets) body.parameters = "closed";
    } else if (char === "[") {
      frame.brackets++;
      frame.expectExpression = true;
      frame.statementStart = false;
    } else if (char === "]" || char === ".") {
      if (char === "]") frame.brackets = Math.max(0, frame.brackets - 1);
      frame.expectExpression = frame.statementStart = false;
    }
    else if ((char === "+" || char === "-") && source[index + 1] === char) {
      frame.previous = char + char;
      frame.statementStart = frame.label = frame.lineBreak = false;
      index += 2;
      continue;
    } else {
      frame.expectExpression = true;
      const body = frame.bodies.at(-1);
      if (typed && char === ":" && body?.kind === "function" && body.parameters === "closed"
        && body.braces === frame.braces.length && body.parens === frame.parens.length && body.brackets === frame.brackets) body.typeAnnotation = true;
      frame.statementStart = char === ":" && frame.label
        || char === ";" && (frame.parens.length === 0 || Boolean(frame.braces.at(-1)?.statement && frame.braces.at(-1)?.parens === frame.parens.length));
    }
    frame.label = frame.lineBreak = false;
    frame.previous = source.startsWith("=>", index) ? "=>" : source.startsWith("?.", index) ? "?." : char;
    index += frame.previous.length;
    if (input && (char === ";" || char === "}" && frame.expectExpression && frame.statementStart)
      && stack.length === 1 && !frame.braces.length && !frame.parens.length
      && !frame.brackets && !frame.bodies.length && !openAngles) {
      yield* input!.available(index);
      if (LINE_END.test(source[index] ?? "")) yield { kind: "checkpoint", start: index, end: index };
    }
  }

  // Keep unfinished input in its active lexical context, without rescanning it.
  for (const frame of stack) {
    if (!frame.emit || frame.mode === "jsx") continue;
    if (frame.mode === "tag" || frame.mode === "template") {
      yield { kind: frame.mode, start: frame.start, end: source.length };
    } else if (frame.expression) {
      yield { kind: frame.expression, start: frame.start, end: source.length };
    }
  }
}

/** Find a host-language brace expression without copying the remaining document. */
export function javascriptExpressionEnd(source: string, start: number, context?: TokenMatcherContext, contentStart = start + 1, closingSequence = "}"): number {
  for (const range of scanJavaScript(source, false, "expression", context, start, contentStart, false, closingSequence)) {
    if (range.kind === "expression") return range.end;
  }
  return source.length;
}
