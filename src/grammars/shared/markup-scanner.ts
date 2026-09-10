import type { TokenMatcherContext } from "../../core/types";
import { javascriptExpressionEnd } from "./javascript-scanner";

export type MarkupMode = "html" | "vue" | "svelte";
export interface Attribute {
  start: number; end: number; name: string; nameEnd: number;
  valueStart?: number; contentStart?: number; contentEnd?: number;
  expression?: boolean;
}
export interface MarkupTag {
  start: number; end: number; name: string; nameEnd: number; closing: boolean; selfClosing: boolean; attributes: Attribute[];
}
export interface MarkupRange {
  kind: "comment" | "doctype" | "cdata" | "prolog" | "tag" | "script" | "style" | "plain-text" | "interpolation" | "expression" | "block";
  start: number; end: number; language?: string;
}
const SPACE = /[\t\n\f\r ]/;
const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

export function svelteContentStart(source: string, start: number): number {
  const marker = /^\{[#:/@](?:if|else|each|await|then|catch|key|snippet|html|debug|const|render)\b/.exec(source.slice(start));
  return marker ? start + marker[0].length : start + 1;
}

/** Parse attributes once, respecting host quotes and Svelte brace expressions. */
export function markupAttributes(source: string, start: number, mode: MarkupMode, context?: TokenMatcherContext): { attributes: Attribute[]; end: number; selfClosing: boolean } {
  const attributes: Attribute[] = [];
  let index = start;
  while (index < source.length) {
    while (SPACE.test(source[index] ?? "")) index++;
    if (source[index] === ">") return { attributes, end: index + 1, selfClosing: false };
    if (source.startsWith("/>", index)) return { attributes, end: index + 2, selfClosing: true };
    if (source[index] === "<") break;
    if (mode === "svelte" && source[index] === "{") {
      const end = javascriptExpressionEnd(source, index, context);
      attributes.push({ start: index, end, name: "", nameEnd: index, expression: true }); index = end; continue;
    }
    const begin = index;
    while (index < source.length && !/[\s=<>/]/.test(source[index]!)) index++;
    if (index === begin) { index++; continue; }
    const nameEnd = index;
    const name = source.slice(begin, nameEnd);
    while (SPACE.test(source[index] ?? "")) index++;
    const attribute: Attribute = { start: begin, end: nameEnd, name, nameEnd };
    if (source[index] === "=") {
      attribute.valueStart = index++;
      while (SPACE.test(source[index] ?? "")) index++;
      const quote = source[index];
      const quoted = quote === '"' || quote === "'";
      if (quoted) index++;
      attribute.contentStart = index;
      while (index < source.length) {
        if (quoted ? source[index] === quote : /[\s>]/.test(source[index]!)) break;
        if (!quoted && mode !== "html" && source.startsWith("/>", index)) break;
        if (mode === "svelte" && source[index] === "{") index = javascriptExpressionEnd(source, index, context);
        else index++;
      }
      attribute.contentEnd = index;
      if (quoted && source[index] === quote) index++;
      attribute.end = index;
    }
    attributes.push(attribute);
  }
  return { attributes, end: Math.min(index, source.length), selfClosing: false };
}

export function markupTag(source: string, start: number, mode: MarkupMode, context?: TokenMatcherContext): MarkupTag | undefined {
  if (source[start] !== "<") return undefined;
  const closing = source[start + 1] === "/";
  const begin = start + (closing ? 2 : 1);
  if (!/[a-zA-Z\u0080-\uffff]/.test(source[begin] ?? "")) return undefined;
  let index = begin + 1;
  while (index < source.length && !/[\s/>=<]/.test(source[index]!)) index++;
  const name = source.slice(begin, index).toLowerCase();
  const parsed = markupAttributes(source, index, mode, context);
  return { start, end: parsed.end, name, nameEnd: index, closing,
    selfClosing: parsed.selfClosing, attributes: parsed.attributes };
}

function htmlScriptEnd(source: string, start: number): number {
  let state: "data" | "escaped" | "double-escaped" = "data";
  for (let index = start; index < source.length; index++) {
    if (state !== "data" && source.startsWith("-->", index)) {
      state = "data";
      index += 2;
    } else if (source[index] === "<") {
      if (state === "data" && source.startsWith("<!--", index)) {
        state = "escaped";
        index += 3;
      } else if (/^<\/script(?=[\t\n\f\r />])/i.test(source.slice(index, index + 10))) {
        if (state !== "double-escaped") return index;
        state = "escaped";
        index += 7;
      } else if (state === "escaped" && /^<script(?=[\t\n\f\r />])/i.test(source.slice(index, index + 9))) {
        state = "double-escaped";
        index += 6;
      }
    }
  }
  return source.length;
}

function attributeValue(source: string, tag: MarkupTag, name: string): string | undefined {
  const attr = tag.attributes.find(attr => attr.name.toLowerCase() === name);
  if (!attr) return undefined;
  return source.slice(attr.contentStart ?? attr.end, attr.contentEnd ?? attr.end)
    .replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (raw, hex: string, decimal: string) => {
      const point = parseInt(hex || decimal, hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : raw;
    }).trim().toLowerCase();
}

function bodyLanguage(source: string, tag: MarkupTag, mode: MarkupMode): string {
  const lang = attributeValue(source, tag, "lang");
  const type = attributeValue(source, tag, "type")?.split(";")[0]?.trim();
  if (tag.name === "style") {
    if (lang && lang !== "css") return mode !== "html" && lang === "scss" ? "scss" : "plain";
    return type && type !== "text/css" ? "plain" : "css";
  }
  if (type && /^(?:application\/(?:ld\+)?json|importmap|speculationrules)$/.test(type)) return "json";
  if (type && !/^(?:module|(?:text|application)\/(?:java|ecma)script(?:1\.[0-5])?)$/.test(type)) return "plain";
  if (lang && !/^(?:js|javascript)$/.test(lang)) return mode !== "html" && /^(?:ts|typescript)$/.test(lang) ? "typescript" : "plain";
  return "javascript";
}

export function scanMarkup(source: string, mode: MarkupMode, context?: TokenMatcherContext): MarkupRange[] {
  const ranges: MarkupRange[] = [];
  let index = 0;
  let typescript = false;
  let verbatimDepth = 0;
  while (index < source.length) {
    const start = index;
    let terminator: string | undefined;
    let kind: MarkupRange["kind"] = "comment";
    let prefix = 0;
    if (source.startsWith("<!--", index)) { terminator = "-->"; prefix = 4; }
    else if (source.startsWith("<![CDATA[", index)) { terminator = "]]>"; kind = "cdata"; prefix = 9; }
    else if (source.startsWith("<?", index)) { terminator = "?>"; kind = "prolog"; prefix = 2; }
    if (terminator) {
      const close = source.indexOf(terminator, index + prefix);
      index = close < 0 ? source.length : close + terminator.length;
      ranges.push({ kind, start, end: index }); continue;
    }
    if (/^<!doctype(?=[\s>])/i.test(source.slice(index, index + 10))) {
      index += 9;
      let quote = ""; let subset = 0;
      while (index < source.length) {
        const char = source[index++]!;
        if (quote) { if (char === quote) quote = ""; }
        else if (char === '"' || char === "'") quote = char;
        else if (char === "[") subset++;
        else if (char === "]") subset = Math.max(0, subset - 1);
        else if (char === ">" && !subset) break;
      }
      ranges.push({ kind: "doctype", start, end: index }); continue;
    }
    const tag = source[index] === "<" ? markupTag(source, index, mode, context) : undefined;
    if (tag) {
      const ownVerbatim = mode === "vue" && tag.attributes.some(attr => attr.name === "v-pre");
      ranges.push({ kind: "tag", start, end: tag.end, ...(verbatimDepth || ownVerbatim ? { language: "plain" } : {}) });
      if (mode === "vue") {
        if (tag.closing && verbatimDepth) verbatimDepth--;
        else if (!tag.closing && !tag.selfClosing && !VOID.test(tag.name) && (verbatimDepth || ownVerbatim)) verbatimDepth++;
      }
      index = tag.end;
      const raw = /^(?:script|style|textarea|title|xmp|iframe|noembed|noframes|plaintext)$/.test(tag.name)
        || (mode === "vue" && tag.name === "template" && Boolean(attributeValue(source, tag, "lang")) && attributeValue(source, tag, "lang") !== "html");
      if (!tag.closing && (mode === "html" || !tag.selfClosing) && source[index - 1] === ">" && raw) {
        const closing = new RegExp(`</${tag.name}(?=[\\t\\n\\f\\r />])`, "ig");
        closing.lastIndex = index;
        const match = tag.name === "plaintext" ? null : closing.exec(source);
        const end = mode === "html" && tag.name === "script" ? htmlScriptEnd(source, index) : match?.index ?? source.length;
        const isCode = tag.name === "script" || tag.name === "style";
        const language = isCode ? bodyLanguage(source, tag, mode) : /^(?:textarea|title)$/.test(tag.name) ? verbatimDepth ? "entities-verbatim" : "entities" : "plain";
        typescript ||= language === "typescript";
        if (end > index) ranges.push({ kind: isCode ? tag.name as "script" | "style" : "plain-text", start: index, end, language });
        index = end;
      }
      continue;
    }
    if (!verbatimDepth && mode === "vue" && source.startsWith("{{", index)) {
      index = javascriptExpressionEnd(source, index, context, index + 2, "}}");
      ranges.push({ kind: "interpolation", start, end: index }); continue;
    }
    if (mode === "svelte" && source[index] === "{") {
      const content = svelteContentStart(source, index);
      index = javascriptExpressionEnd(source, index, context, content);
      ranges.push({ kind: content > start + 1 ? "block" : "expression", start, end: index }); continue;
    }
    index++;
  }
  if (mode !== "html") for (const range of ranges) {
    if (range.language === "entities") range.language = typescript ? "entities-typescript" : "entities-javascript";
    if (range.language === undefined) range.language = typescript ? "typescript" : "javascript";
  }
  return ranges;
}
