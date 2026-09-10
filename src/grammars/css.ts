import type { Grammar } from "../core/types";
import { createCssTokens } from "./shared/css-tokens";

export const css: Grammar = {
  name: "css",
  aliases: [],
  tokens: createCssTokens(),
};
