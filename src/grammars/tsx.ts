import type { Grammar } from "../core/types";
import { typescript } from "./typescript";
import { withJavaScriptExpressions } from "./shared/javascript-tokens";

export const tsx: Grammar = {
  name: "tsx",
  aliases: [],
  tokens: withJavaScriptExpressions(typescript.tokens, true),
};
