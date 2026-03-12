import type { Grammar } from "../core/types";
import { c } from "./c";

export const cpp: Grammar = {
  name: "cpp",
  aliases: ["c++", "cxx", "cc", "hpp", "hxx", "hh"],
  tokens: {
    ...c.tokens,
    "raw-string": {
      pattern: /R"([^()\s]*)\([\s\S]*?\)\1"/,
      greedy: true,
      alias: "string",
    },
    "class-name": {
      pattern:
        /(\b(?:class|concept|enum|namespace|struct|typename|union)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|long|module|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\b/,
    builtin:
      /\b(?:std|string|vector|map|unordered_map|set|unordered_set|list|deque|array|pair|tuple|optional|variant|any|shared_ptr|unique_ptr|weak_ptr|make_shared|make_unique|make_pair|make_tuple|move|forward|swap|begin|end|size|empty|push_back|pop_back|emplace_back|insert|erase|find|count|sort|reverse|transform|accumulate|reduce|cout|cin|cerr|clog|endl|printf|fprintf|sprintf|snprintf|scanf|malloc|calloc|realloc|free|memcpy|memmove|memset|strlen|strcmp|strcpy|nullptr|NULL|true|false|size_t|ptrdiff_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|string_view|span|ranges|views|format|print|println)\b/,
    boolean: /\b(?:true|false)\b/,
    operator:
      /->|\.\*|->|\+\+|--|<<[=]?|>>[=]?|<=>|&&|\|\||::|[!=<>]=?|[-+*/%&|^~!=]=?|[?:]/,
    "template-parameter": {
      pattern: /<(?:[^<>]|<[^<>]*>)*>/,
      inside: {
        keyword:
          /\b(?:class|typename|auto|const)\b/,
        builtin: /\b\w+/,
        punctuation: /[<>,]/,
      },
    },
    namespace: {
      pattern: /(\b(?:namespace|using namespace)\s+)[\w:]+/,
      lookbehind: true,
    },
  },
};
