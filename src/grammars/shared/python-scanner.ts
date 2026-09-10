import type { TokenMatcherContext } from "../../core/types";

export type PythonMode = "code" | "f-string" | "field" | "format" | "raw-field" | "raw-format";
export interface PythonRange {
  kind: "comment" | "string" | "triple-string" | "f-string" | "raw-f-string" | "interpolation" | "expression" | "format-specifier" | "conversion" | "punctuation";
  start: number;
  end: number;
}
interface StringFrame {
  mode: "string";
  start: number;
  quote: string;
  triple: boolean;
  raw: boolean;
  formatted: boolean;
  emit: boolean;
  children: boolean;
}
interface CodeFrame {
  mode: "code" | "format";
  start: number;
  field: boolean;
  emit: boolean;
  children: boolean;
  brackets: string[];
  bodyStart: number;
  raw: boolean;
  expressionEnd?: number;
  formatStart?: number;
}
type Frame = StringFrame | CodeFrame;

function stringStart(source: string, index: number): { frame: StringFrame; end: number } | undefined {
  const prefix = /^[rRuUbBfF]{0,2}(?:"""|'''|"|')/.exec(source.slice(index));
  if (!prefix) return undefined;
  const value = prefix[0];
  const quoteIndex = value.search(/["']/);
  const letters = value.slice(0, quoteIndex).toLowerCase();
  if (!/^(?:r|u|b|br|rb|f|fr|rf)?$/.test(letters)) return undefined;
  return { frame: { mode: "string", start: index, quote: value[quoteIndex]!, triple: value.length - quoteIndex === 3,
    raw: letters.includes("r"), formatted: letters.includes("f"), emit: false, children: false }, end: index + value.length };
}

/** Scan string and replacement-field boundaries with bounded explicit state. */
export function* scanPython(source: string, mode: PythonMode, context?: TokenMatcherContext): Iterable<PythonRange> {
  const stack: Frame[] = [];
  const identifier = /[_\p{XID_Start}][\p{XID_Continue}]*/uy;
  const remaining = (context?.maxTokenDepth ?? 100) - (context?.depth ?? 0);
  let index = 0;
  const field = (start: number, emit: boolean, children = false, raw = false): CodeFrame => ({ mode: "code", start, field: true, emit, children, raw, brackets: [], bodyStart: start + 1 });
  if (mode === "f-string") {
    const opening = stringStart(source, 0);
    if (!opening) return;
    stack.push({ ...opening.frame, children: true });
    index = opening.end;
  } else if (mode === "field" || mode === "raw-field") {
    stack.push(field(0, false, true, mode === "raw-field"));
    if (source[0] === "{") { yield { kind: "punctuation", start: 0, end: 1 }; index = 1; }
  } else stack.push({ mode: mode.endsWith("format") ? "format" : "code", start: 0, field: false,
    emit: mode === "code", children: mode.endsWith("format"), raw: mode === "raw-format", brackets: [], bodyStart: 0 });

  function* finish(frame: Frame, end: number, closed: boolean): Iterable<PythonRange> {
    if (frame.mode === "string") {
      if (frame.emit) yield { kind: frame.formatted ? frame.raw ? "raw-f-string" : "f-string" : frame.triple ? "triple-string" : "string", start: frame.start, end };
    } else if (frame.field) {
      const bodyEnd = closed ? end - 1 : end;
      if (frame.children) {
        if (frame.formatStart !== undefined) {
          if (bodyEnd > frame.formatStart) yield { kind: "format-specifier", start: frame.formatStart, end: bodyEnd };
        } else if (frame.expressionEnd === undefined && bodyEnd > frame.bodyStart) {
          yield { kind: "expression", start: frame.bodyStart, end: bodyEnd };
        }
        if (closed) yield { kind: "punctuation", start: end - 1, end };
      }
      if (frame.emit && end > frame.start) yield { kind: "interpolation", start: frame.start, end };
    }
  }

  while (index < source.length && stack.length) {
    if (stack.length > 2 * (remaining + 1) + 4) {
      throw new RangeError(`Python nesting exceeds maxTokenDepth ${context?.maxTokenDepth ?? 100}`);
    }
    const frame = stack[stack.length - 1]!;
    const char = source[index]!;
    if (frame.mode === "string") {
      const delimiter = frame.quote.repeat(frame.triple ? 3 : 1);
      if (source.startsWith(delimiter, index)) {
        index += delimiter.length; stack.pop(); yield* finish(frame, index, true);
      } else if (!frame.triple && (char === "\r" || char === "\n")) {
        stack.pop(); yield* finish(frame, index, false);
      } else if (char === "\\") {
        // A backslash does not escape a replacement brace. Named Unicode
        // escapes contain literal braces in non-raw strings.
        if (frame.formatted && !frame.raw && source.startsWith("\\N{", index)) {
          const end = source.indexOf("}", index + 3);
          index = end < 0 ? source.length : end + 1;
        } else if (frame.formatted && /[{}]/.test(source[index + 1] ?? "")) index++;
        else index = Math.min(source.length, index + (source[index + 1] === "\r" && source[index + 2] === "\n" ? 3 : 2));
      } else if (frame.formatted && (char === "{" || char === "}")) {
        if (source[index + 1] === char) index += 2;
        else if (char === "{") { stack.push(field(index, frame.children, false, frame.raw)); index++; }
        else index++;
      } else index++;
      continue;
    }

    if (frame.mode === "format") {
      if (char === "\\" && !frame.raw && source.startsWith("\\N{", index)) {
        const close = source.indexOf("}", index + 3);
        index = close < 0 ? source.length : close + 1;
      } else if (char === "\\" && !/[{}]/.test(source[index + 1] ?? "")) index = Math.min(source.length, index + 2);
      else if (char === "{") { stack.push(field(index, frame.children && !frame.field, false, frame.raw)); index++; }
      else if (char === "}" && frame.field) { index++; stack.pop(); yield* finish(frame, index, true); }
      else index++;
      continue;
    }
    if (frame.field && frame.brackets.length === 0) {
      if (char === "}") { index++; stack.pop(); yield* finish(frame, index, true); continue; }
      const conversion = char === "!" && /[rsa]/.test(source[index + 1] ?? "");
      const debug = char === "=" && !/[=!:<>]/.test(source[index - 1] ?? "") && source[index + 1] !== "=";
      if (char === ":" || conversion || debug) {
        if (frame.children && frame.expressionEnd === undefined && index > frame.bodyStart) {
          yield { kind: "expression", start: frame.bodyStart, end: index };
        }
        frame.expressionEnd ??= index;
        if (char === ":") { frame.mode = "format"; frame.formatStart = index++; }
        else {
          const end = index + (conversion ? 2 : 1);
          if (frame.children) yield { kind: conversion ? "conversion" : "punctuation", start: index, end };
          index = end;
        }
        continue;
      }
    }
    if (char === "#") {
      const start = index++;
      while (index < source.length && !/[\r\n]/.test(source[index]!)) index++;
      if (frame.emit && !frame.field) yield { kind: "comment", start, end: index };
      continue;
    }
    const opening = /[rRuUbBfF"']/.test(char) ? stringStart(source, index) : undefined;
    if (opening) {
      stack.push({ ...opening.frame, emit: frame.emit && !frame.field }); index = opening.end; continue;
    }
    identifier.lastIndex = index;
    const word = identifier.exec(source);
    if (word) { index += word[0].length; continue; }
    if (frame.field) {
      if (char === "(" || char === "[" || char === "{") {
        frame.brackets.push(char);
        if (frame.brackets.length > remaining + 100) throw new RangeError(`Python nesting exceeds maxTokenDepth ${context?.maxTokenDepth ?? 100}`);
      } else if (char === ")" || char === "]" || char === "}") frame.brackets.pop();
    }
    index++;
  }
  while (stack.length) yield* finish(stack.pop()!, source.length, false);
}
