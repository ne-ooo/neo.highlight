import type { Grammar } from "../core/types";
import { css } from "./css";

export const scss: Grammar = {
  name: "scss",
  aliases: ["sass"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    ...css.tokens,
    variable: /\$[\w-]+|--[\w-]+/,
    interpolation: {
      pattern: /#\{[^}]+\}/,
      inside: {
        punctuation: /^#\{|\}$/,
        variable: /\$[\w-]+/,
      },
    },
    placeholder: {
      pattern: /%[\w-]+/,
      alias: "selector",
    },
    keyword:
      /\b(?:and|not|only|or|from|to|inherit|initial|unset|if|else|for|each|while|mixin|include|extend|function|return|at-root|warn|error|debug|forward|use)\b|@(?:mixin|include|extend|function|return|if|else|for|each|while|at-root|warn|error|debug|use|forward|import|media|content)\b/,
    boolean: /\b(?:true|false)\b/,
    operator: /[=!<>]=?|[+*/%~-]|(?:and|or|not)\b/,
    builtin:
      /\b(?:nth|join|append|zip|index|length|type-of|unit|unitless|comparable|map-get|map-merge|map-remove|map-keys|map-values|map-has-key|selector-nest|selector-append|selector-extend|selector-replace|selector-unify|is-superselector|simple-selectors|selector-parse|feature-exists|variable-exists|global-variable-exists|function-exists|mixin-exists|inspect|if|unique-id|random|min|max|percentage|round|ceil|floor|abs|lighten|darken|saturate|desaturate|mix|complement|invert|grayscale|adjust-hue|rgba|red|green|blue|alpha|opacify|transparentize|hue|saturation|lightness|adjust-color|scale-color|change-color|ie-hex-str|unquote|quote|str-length|str-insert|str-index|str-slice|to-upper-case|to-lower-case)\b/,
    punctuation: /[{}();:,]/,
  },
};
