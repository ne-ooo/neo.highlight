import type { Grammar } from "../core/types";
import { javascript } from "./javascript";

export const typescript: Grammar = {
  name: "typescript",
  aliases: ["ts", "mts", "cts"],
  tokens: {
    ...javascript.tokens,
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)[\w.\\]+/,
      lookbehind: true,
    },
    keyword: /\b(?:abstract|as|asserts|async|await|break|case|catch|class|const|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|is|keyof|let|module|namespace|new|null|of|out|package|private|protected|public|readonly|return|require|satisfies|set|static|super|switch|this|throw|try|type|typeof|undefined|unique|var|void|while|with|yield)\b/,
    builtin: /\b(?:string|number|boolean|symbol|bigint|object|any|never|void|unknown|undefined|null|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|InstanceType|Parameters|ConstructorParameters|Awaited)\b/,
    "generic-function": {
      pattern: /\b[a-zA-Z_$][\w$]*(?=\s*<(?:[^<>]|<[^<>]*>)*>\s*\()/,
      alias: "function",
    },
  },
};
