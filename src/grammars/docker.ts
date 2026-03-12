import type { Grammar } from "../core/types";

export const docker: Grammar = {
  name: "docker",
  aliases: ["dockerfile"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    string: [
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
      {
        pattern: /'[^']*'/,
        greedy: true,
      },
    ],
    instruction: {
      pattern:
        /^\s*(?:FROM|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/mi,
      alias: "keyword",
    },
    "from-image": {
      pattern: /(\bFROM\s+)[\w./:@-]+(?:\s+(?:AS)\s+\w+)?/i,
      lookbehind: true,
      inside: {
        keyword: /\bAS\b/i,
        punctuation: /[:@/]/,
        tag: /[\w.-]+/,
      },
    },
    variable: [
      /\$\{[^}]+\}/,
      /\$\w+/,
    ],
    "env-pair": {
      pattern: /(\b(?:ENV|ARG|LABEL)\b\s+)\w+(?:\s*=\s*\S+)?/i,
      lookbehind: true,
      inside: {
        property: /^\w+/,
        operator: /=/,
        string: {
          pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
          greedy: true,
        },
      },
    },
    number: /\b\d+(?:\/(?:tcp|udp))?\b/,
    "flag": {
      pattern: /--[\w-]+(?:=\S+)?/,
      alias: "property",
      inside: {
        operator: /=/,
      },
    },
    operator: /\\$/m,
    punctuation: /[[\]{},]/,
  },
};
