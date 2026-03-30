import type { Grammar } from "../core/types";
import { c } from "./c";

export const objectivec: Grammar = {
  name: "objectivec",
  aliases: ["objc", "obj-c"],
  tokens: {
    ...c.tokens,
    string: [
      {
        pattern: /@"(?:\\[\s\S]|[^\\"])*"/,
        greedy: true,
      },
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
    ],
    keyword:
      /\b(?:auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while|_Bool|_Complex|_Imaginary|bool|true|false|nil|Nil|NULL|YES|NO|self|super|id|Class|SEL|IMP|BOOL|IBOutlet|IBAction|nonatomic|retain|strong|weak|copy|assign|readonly|readwrite|getter|setter|atomic|unsafe_unretained|nullable|nonnull)\b/,
    directive: {
      pattern:
        /@(?:interface|implementation|protocol|end|class|selector|encode|synchronized|try|catch|finally|throw|property|synthesize|dynamic|optional|required|autoreleasepool|compatibility_alias|available)\b/,
      alias: "keyword",
    },
    "class-name": {
      pattern: /(\b(?:@interface|@implementation|@protocol|@class)\s+)\w+/,
      lookbehind: true,
    },
    "message-expression": {
      pattern: /\[[\s\S]*?\]/,
      inside: {
        punctuation: /[[\]]/,
      },
    },
  },
};
