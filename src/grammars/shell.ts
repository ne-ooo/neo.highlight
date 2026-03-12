import type { Grammar } from "../core/types";
import { bash } from "./bash";

export const shell: Grammar = {
  name: "shell",
  aliases: ["sh", "posix-shell"],
  tokens: {
    ...bash.tokens,
    keyword:
      /\b(?:if|then|else|elif|fi|for|while|until|do|done|in|case|esac|function|select|break|continue|return|exit|trap|source|export|readonly|local|unset|shift|set|eval|exec|read|printf|echo|test|true|false|command|getopts|hash|type|ulimit|umask|wait|cd|pwd|bg|fg|jobs|kill|suspend|times|newgrp|login)\b/,
    builtin:
      /\b(?:alias|bg|cd|command|echo|eval|exec|exit|export|fc|fg|getopts|hash|jobs|kill|local|printf|pwd|read|readonly|return|set|shift|source|test|times|trap|type|ulimit|umask|unalias|unset|wait|cat|ls|grep|sed|awk|find|sort|uniq|wc|head|tail|cut|tr|xargs|tee|diff|chmod|chown|mkdir|rmdir|rm|cp|mv|ln|touch|which|basename|dirname|expr|nohup|nice|time|env|tput|stty|dd|df|du|mount|umount|ps|top|kill|sleep|date|cal|who|whoami|id|groups|passwd|su|sudo|cron|crontab|at|batch|logger|syslog|uname|hostname)\b/,
  },
};
