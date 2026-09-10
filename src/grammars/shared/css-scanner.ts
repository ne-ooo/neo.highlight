import type { TokenMatcherContext } from "../../core/types";

export const CSS_IDENTIFIER = String.raw`(?:--|-?(?:[_a-zA-Z\u0080-\uffff]|\\(?:[\da-fA-F]{1,6}\s?|[^\r\n\da-fA-F])))(?:[-\w\u0080-\uffff]|\\(?:[\da-fA-F]{1,6}\s?|[^\r\n\da-fA-F]))*`;
export interface CssRange { kind: "comment" | "string" | "url" | "atrule" | "selector" | "property"; start: number; end: number }

export function cssQuotedEnd(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === quote) return index + 1;
    if (source[index] === "\r" || source[index] === "\n" || source[index] === "\f") return index;
    if (source[index] === "\\") index += source[index + 1] === "\r" && source[index + 2] === "\n" ? 3 : 2;
    else index++;
  }
  return source.length;
}

/** Index lexical regions and block preludes without rescanning failed openers. */
export function scanCSS(source: string, context?: TokenMatcherContext, dialect: "css" | "scss" | "less" = "css"): CssRange[] {
  const ranges: CssRange[] = [];
  const property = new RegExp(`^(${CSS_IDENTIFIER})(?:\\s|/\\*[^*]*(?:\\*(?!/)[^*]*)*\\*/)*:`);
  let start = -1;
  let parens = 0;
  let brackets = 0;
  let customDepth = 0;
  let index = 0;
  const remaining = (context?.maxTokenDepth ?? 100) - (context?.depth ?? 0);
  const prelude = (end: number, block: boolean): boolean => {
    if (start < 0) return false;
    while (end > start && /\s/.test(source[end - 1]!)) end--;
    const raw = source.slice(start, end);
    const name = property.exec(raw);
    if (source[start] === "@") ranges.push({ kind: "atrule", start, end });
    else if (name && (!block || name[1]!.startsWith("--"))) ranges.push({ kind: "property", start, end: start + name[1]!.length });
    else if (block && end > start) ranges.push({ kind: "selector", start, end });
    return block && Boolean(name?.[1]?.startsWith("--"));
  };
  while (index < source.length) {
    const char = source[index]!;
    if (dialect !== "css" && source.startsWith("//", index)) {
      const begin = index;
      while (index < source.length && !/[\r\n]/.test(source[index]!)) index++;
      ranges.push({ kind: "comment", start: begin, end: index }); continue;
    }
    if (source.startsWith("/*", index)) {
      const close = source.indexOf("*/", index + 2);
      const end = close < 0 ? source.length : close + 2;
      ranges.push({ kind: "comment", start: index, end }); index = end; continue;
    }
    if (start < 0 && !/\s/.test(char) && char !== "}" && char !== ";") start = index;
    if (char === '"' || char === "'") {
      const end = cssQuotedEnd(source, index);
      ranges.push({ kind: "string", start: index, end }); index = end; continue;
    }
    if ((char === "u" || char === "U") && !/[-\w\u0080-\uffff]/.test(source[index - 1] ?? "") && /^url\(/i.test(source.slice(index, index + 4))) {
      const begin = index; index += 4;
      while (index < source.length) {
        if (source[index] === "\\") index = Math.min(source.length, index + 2);
        else if (source[index] === '"' || source[index] === "'") {
          const end = cssQuotedEnd(source, index);
          ranges.push({ kind: "string", start: index, end }); index = end;
        }
        else if (source[index++] === ")") break;
      }
      ranges.push({ kind: "url", start: begin, end: index }); continue;
    }
    if ((dialect === "scss" && source.startsWith("#{", index)) || (dialect === "less" && source.startsWith("@{", index))) {
      const close = source.indexOf("}", index + 2);
      index = close < 0 ? source.length : close + 1; continue;
    }
    if (char === "\\") { index += Math.min(2, source.length - index); continue; }
    if (char === "(") parens++;
    else if (char === ")") parens = Math.max(0, parens - 1);
    else if (char === "[") brackets++;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    if (parens + brackets + customDepth > remaining + 100) throw new RangeError(`CSS nesting exceeds maxTokenDepth ${context?.maxTokenDepth ?? 100}`);
    if (!parens && !brackets) {
      if (customDepth) {
        if (char === "{") customDepth++;
        else if (char === "}" && --customDepth === 0) start = -1;
      } else if (char === "{" || char === ";" || char === "}") {
        customDepth = prelude(index, char === "{") ? 1 : 0;
        start = -1;
      }
    }
    index++;
  }
  if (!customDepth) prelude(source.length, false);
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}
