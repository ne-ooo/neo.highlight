import type { Grammar } from "../core/types";

export const wasm: Grammar = {
  name: "wasm",
  aliases: ["wat", "wast"],
  tokens: {
    comment: [
      { pattern: /;;.*/, greedy: true },
      { pattern: /\(;[\s\S]*?;\)/, greedy: true },
    ],
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
    },
    keyword:
      /\b(?:module|func|param|result|local|global|table|memory|type|import|export|start|elem|data|offset|mut|block|loop|if|then|else|end|br|br_if|br_table|return|call|call_indirect|drop|select|unreachable|nop|memory\.size|memory\.grow|get_local|set_local|tee_local|get_global|set_global|local\.get|local\.set|local\.tee|global\.get|global\.set)\b/,
    builtin: {
      pattern:
        /\b(?:i32|i64|f32|f64|v128|funcref|externref|anyfunc)\b/,
      alias: "type",
    },
    instruction: {
      pattern:
        /\b(?:i32|i64|f32|f64)\.(?:const|load|store|add|sub|mul|div_[su]|rem_[su]|and|or|xor|shl|shr_[su]|rotl|rotr|clz|ctz|popcnt|eqz|eq|ne|lt_[su]|gt_[su]|le_[su]|ge_[su]|abs|neg|ceil|floor|trunc|nearest|sqrt|min|max|copysign|wrap_i64|extend_i32_[su]|trunc_f\d+_[su]|convert_i\d+_[su]|demote_f64|promote_f32|reinterpret_[fi]\d+|load8_[su]|load16_[su]|load32_[su]|store8|store16|store32)\b/,
      alias: "function",
    },
    variable: /\$[\w!#$%&'*+\-./:<=>?@\\^`|~]+/,
    number:
      /[+-]?\b(?:0[xX][\dA-Fa-f]+(?:\.[\dA-Fa-f]+)?(?:[pP][+-]?\d+)?|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    punctuation: /[()]/,
  },
};
