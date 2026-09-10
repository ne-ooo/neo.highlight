import type { Grammar } from "../core/types";
import { javascript } from "./javascript";
import { withJavaScriptExpressions } from "./shared/javascript-tokens";

export const jsx: Grammar = {
  name: "jsx",
  aliases: ["react"],
  tokens: withJavaScriptExpressions(javascript.tokens, true),
};
