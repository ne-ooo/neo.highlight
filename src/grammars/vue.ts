import type { Grammar } from "../core/types";
import { javascript } from "./javascript";
import { typescript } from "./typescript";
import { json } from "./json";
import { css } from "./css";
import { scss } from "./scss";
import { createMarkupTokens } from "./shared/markup-tokens";

export const vue: Grammar = {
  name: "vue",
  aliases: ["vue-html"],
  tokens: createMarkupTokens("vue", { javascript, typescript, json, css, scss }),
};
