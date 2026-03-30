import type { Grammar } from "../core/types";

export const powershell: Grammar = {
  name: "powershell",
  aliases: ["ps1", "posh"],
  tokens: {
    comment: [
      { pattern: /<#[\s\S]*?#>/, greedy: true },
      { pattern: /#.*/, greedy: true },
    ],
    string: [
      {
        pattern: /@"[\s\S]*?"@/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$(?:\([^)]*\)|[\w{][^}]*\}?|\w+)/,
          },
        },
      },
      { pattern: /@'[\s\S]*?'@/, greedy: true },
      {
        pattern: /"(?:[^"`$]|`[\s\S]|\$(?!\(|[\w{]))*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$(?:\([^)]*\)|[\w{][^}]*\}?|\w+)/,
          },
        },
      },
      { pattern: /'(?:[^']|'')*'/, greedy: true },
    ],
    variable: /\$(?:[\w]+|(?:\{[^}]+\}))/,
    keyword:
      /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Enum|Exit|Filter|Finally|For|ForEach|From|Function|Hidden|If|In|InlineScript|Param|Parallel|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
    boolean: /\$(?:true|false|null)\b/i,
    function: {
      pattern:
        /\b(?:Add|Clear|Close|Compare|Complete|Convert|Copy|Debug|Disable|Disconnect|Enable|Enter|Exit|Export|Find|Format|Get|Grant|Group|Import|Initialize|Install|Invoke|Join|Limit|Lock|Measure|Merge|Move|New|Open|Optimize|Out|Ping|Pop|Protect|Publish|Push|Read|Receive|Redo|Register|Remove|Rename|Repair|Request|Reset|Resize|Resolve|Restart|Restore|Resume|Revoke|Save|Search|Select|Send|Set|Show|Skip|Sort|Split|Start|Step|Stop|Submit|Suspend|Switch|Sync|Test|Trace|Unblock|Undo|Uninstall|Unlock|Unprotect|Unregister|Update|Use|Wait|Watch|Write)-\w+/i,
    },
    operator:
      /-(?:and|or|not|band|bor|bnot|bxor|eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split|join|is|isnot|as|f|shl|shr)\b|[+\-*\/%]=?|[=!<>]=?|&&|\|\||[|&^~]/i,
    punctuation: /[{}[\];(),.@:]/,
  },
};
