import type { Grammar } from "../core/types";
import { javascript } from "./javascript";
import { json } from "./json";
import { css } from "./css";
import { createMarkupTokens } from "./shared/markup-tokens";

export const html: Grammar = {
  name: "html",
  aliases: ["htm", "xml", "svg", "mathml"],
  tokens: createMarkupTokens("html", { javascript, json, css }),
};
