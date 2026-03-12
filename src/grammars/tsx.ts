import type { Grammar } from "../core/types";
import { typescript } from "./typescript";
import { jsx } from "./jsx";

export const tsx: Grammar = {
  name: "tsx",
  aliases: [],
  tokens: {
    ...typescript.tokens,
    tag: jsx.tokens["tag"]!,
  },
};
