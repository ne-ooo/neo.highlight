import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/core/tokenizer";
import { html } from "../../../src/grammars/html";
import { vue } from "../../../src/grammars/vue";
import { svelte } from "../../../src/grammars/svelte";
import { verify, type AccuracyFixture } from "./accuracy-helpers";

const htmlFixtures: AccuracyFixture[] = [
  { name: "quoted attribute tag delimiters", code: '<div title="a > b < c" data-x=ok hidden>&CounterClockwiseContourIntegral; &#x1F600;</div>', spans: [["tag", '<div title="a > b < c" data-x=ok hidden>'], ["attr-value", '="a > b < c"'], ["attr-name", "hidden"], ["entity", "&CounterClockwiseContourIntegral;"], ["entity", "&#x1F600;"]] },
  { name: "comments protect apparent embedded blocks", code: '<!-- <script>const x = 1;</script> --><p>ok</p>', spans: [["comment", '<!-- <script>const x = 1;</script> -->'], ["tag", "<p>"]], absent: [["keyword", "const"]] },
  { name: "doctype quotes and internal subset", code: '<!DOCTYPE html PUBLIC "a>b" [<!ENTITY x "y">]><p/>', spans: [["doctype", '<!DOCTYPE html PUBLIC "a>b" [<!ENTITY x "y">]>'], ["string", '"a>b"'], ["tag", "<p/>"]] },
  { name: "CDATA and processing instructions", code: '<?xml version="1.0"?><![CDATA[<script>{literal}</script>]]><svg/>', spans: [["prolog", '<?xml version="1.0"?>'], ["cdata", '<![CDATA[<script>{literal}</script>]]>'], ["tag", "<svg/>"]] },
  { name: "JavaScript and CSS bodies", code: '<script>const x = `hello ${1}`;</script><style>.x { color: #abc; }</style>', spans: [["keyword", "const"], ["interpolation", "${1}"], ["selector", ".x"], ["property", "color"], ["hex-color", "#abc"]] },
  { name: "case-insensitive close and near miss", code: '<SCRIPT>const value = "</scriptish>";</ScRiPt><p>after</p>', spans: [["script", 'const value = "</scriptish>";'], ["string", '"</scriptish>"'], ["tag", "</ScRiPt>"], ["tag", "<p>"]] },
  { name: "host closing tag wins over JavaScript quotes", code: '<script>const value = "</script><p>after</p>', spans: [["script", 'const value = "'], ["tag", "<p>"]] },
  { name: "host closing tag wins over CSS comments", code: '<style>/* </style><p>after</p>', spans: [["style", "/* "], ["comment", "/* "], ["tag", "<p>"]] },
  { name: "JSON scripts and MIME parameters", code: '<script type="application/ld+json; charset=utf-8">{"name": true}</script><script type=importmap>{"imports": {}}</script>', spans: [["property", '"name"'], ["boolean", "true"], ["property", '"imports"']] },
  { name: "unsupported script and style languages", code: '<script type="text/plain">const x = 1; <p></script><style lang="less">@x: red;</style>', spans: [["script", "const x = 1; <p>"], ["style", "@x: red;"]], absent: [["keyword", "const"], ["tag", "<p>"], ["variable", "@x"]] },
  { name: "RCDATA only recognizes entities", code: '<textarea><b>&amp;</b></textarea><title><em>&lt;</title>', spans: [["plain-text", "<b>&amp;</b>"], ["entity", "&amp;"], ["entity", "&lt;"]], absent: [["tag", "<b>"], ["tag", "<em>"]] },
  { name: "raw text does not recognize entities", code: '<xmp><b>&amp;</b></xmp><plaintext><p>&lt;', spans: [["plain-text", "<b>&amp;</b>"], ["plain-text", "<p>&lt;"]], absent: [["entity", "&amp;"], ["tag", "<p>"]] },
  { name: "inline CSS declarations", code: '<p style="color: red; width: calc(100% - 1px)">text</p>', spans: [["special-attr", 'style="color: red; width: calc(100% - 1px)"'], ["property", "color"], ["function", "calc"]] },
  { name: "unfinished tags and embedded bodies", code: '<script>const x = "unfinished', spans: [["script", 'const x = "unfinished'], ["keyword", "const"], ["string", '"unfinished']] },
  { name: "unfinished attribute quotes", code: '<p title="unfinished > &amp;', spans: [["tag", '<p title="unfinished > &amp;'], ["attr-value", '="unfinished > &amp;'], ["entity", "&amp;"]] },
];
const vueFixtures: AccuracyFixture[] = [
  { name: "v-pre textarea remains literal", code: '<textarea v-pre>{{ false }} &amp;</textarea>{{ true }}', spans: [["entity", "&amp;"], ["boolean", "true"]], absent: [["interpolation", "{{ false }}"]] },
  { name: "typed expressions in textarea", code: '<textarea>{{ value as string }}</textarea><script lang="ts"></script>', spans: [["keyword", "as"], ["builtin", "string"]] },
  { name: "nested objects strings and templates in interpolation", code: '<p>{{ format({ a: "}}", b: `x ${1}` }) }}</p>', spans: [["interpolation", '{{ format({ a: "}}", b: `x ${1}` }) }}'], ["function", "format"], ["string", '"}}"'], ["number", "1"]] },
  { name: "regexes comments and division in interpolation", code: '{{ /[}]/g.test(value) ? value / 2 : /* }} */ 0 }}', spans: [["regex", "/[}]/g"], ["comment", "/* }} */"], ["number", "2"]] },
  { name: "directives and expressions", code: '<button v-if="ready && true" :title="format({ x: 1 })" @click.stop="count++">{{ count }}</button>', spans: [["directive", 'v-if="ready && true"'], ["boolean", "true"], ["function", "format"], ["operator", "++"], ["interpolation", "{{ count }}"]] },
  { name: "template uses TypeScript declared later", code: '<template><p :title="value as string">{{ value satisfies string }}</p></template><script setup lang="ts">const value: string = "ok";</script>', spans: [["keyword", "as"], ["keyword", "satisfies"], ["builtin", "string"], ["keyword", "const"]] },
  { name: "SCSS styles and JSON bodies", code: '<style scoped lang="scss">$tone: red; .a { color: $tone; }</style><script type="application/json">{"ok": true}</script>', spans: [["variable", "$tone"], ["property", "color"], ["property", '"ok"']] },
  { name: "unknown preprocessors retain plain bodies", code: '<template lang="pug">p {{ literal }}</template><script lang="coffee">class A</script><style lang="sass">$tone: red</style>', spans: [["plain-text", "p {{ literal }}"], ["script", "class A"], ["style", "$tone: red"]], absent: [["interpolation", "{{ literal }}"], ["keyword", "class"], ["variable", "$tone"]] },
  { name: "v-pre suppresses child interpolation and directives", code: '<div v-pre><span :x="true">{{ literal }}</span><br/></div><p>{{ true }}</p>', spans: [["attr-name", ":x"], ["interpolation", "{{ true }}"], ["boolean", "true", 1]], absent: [["interpolation", "{{ literal }}"], ["directive", ':x="true"']] },
  { name: "textarea contents keep Vue interpolation", code: '<textarea>{{ literal }} &amp;</textarea>{{ true }}', spans: [["plain-text", "{{ literal }} &amp;"], ["entity", "&amp;"], ["interpolation", "{{ literal }}"], ["boolean", "true"]] },
  { name: "unfinished interpolation keeps expression context", code: '<p>{{ fn({ value: true', spans: [["interpolation", "{{ fn({ value: true"], ["function", "fn"], ["boolean", "true"]] },
];
const svelteFixtures: AccuracyFixture[] = [
  { name: "CSS URLs and quoted values preserve host expressions", code: '<p style="background: url({image}); content: \'{label}\'">text</p>', spans: [["expression", "{image}"], ["expression", "{label}"]], absent: [["url", "url({image})"], ["string", "'{label}'"]] },
  { name: "Svelte expressions in inline CSS", code: '<p style="color: {color}; width: {size + 1}px">text</p>', spans: [["expression", "{color}"], ["expression", "{size + 1}"], ["number", "1"]] },
  { name: "nested expressions and regex", code: '<p>{format({ x: /[}]/.test(value), y: "}" })}</p>', spans: [["expression", '{format({ x: /[}]/.test(value), y: "}" })}'], ["function", "format"], ["regex", "/[}]/"], ["string", '"}"']] },
  { name: "unquoted and quoted attribute expressions", code: '<button disabled={false} title="hello {format({ x: 1 })}">{name}</button>', spans: [["boolean", "false"], ["expression", "{format({ x: 1 })}"], ["function", "format"], ["number", "1"]] },
  { name: "shorthand spread and directive attributes", code: '<Component {value} {...props} on:click={() => act(true)} />', spans: [["expression", "{value}"], ["expression", "{...props}"], ["attr-name", "on:click"], ["function", "act"], ["boolean", "true"]] },
  { name: "if and closing block tags", code: '{#if ready}<p>{true}</p>{:else if other}<b/>{:else}<i/>{/if}', spans: [["block", "{#if ready}"], ["block", "{:else if other}"], ["block", "{/if}"], ["keyword", "if"], ["boolean", "true"]] },
  { name: "each await key and snippets", code: '{#each items as item, i (item.id)}{i}{/each}{#await promise}{:then value}{value}{:catch error}{error}{/await}{#key id}{/key}{#snippet row(value)}{value}{/snippet}', spans: [["block", "{#each items as item, i (item.id)}"], ["block", "{:then value}"], ["block", "{:catch error}"], ["block", "{#snippet row(value)}"], ["block", "{/snippet}"]] },
  { name: "html const debug and render tags", code: '{@html markup}{@const value = /[}]/.test(input)}{@debug value}{@render row(value)}', spans: [["block", "{@html markup}"], ["block", "{@const value = /[}]/.test(input)}"], ["regex", "/[}]/"], ["block", "{@debug value}"], ["function", "row"]] },
  { name: "TypeScript expressions and runes", code: '<p>{value as string}</p><script lang="ts">let value: string = $state("ok");</script>', spans: [["keyword", "as"], ["builtin", "string"], ["function", "$state"]] },
  { name: "SCSS bodies", code: '<style lang="scss">$tone: red; .a { color: $tone; }</style>', spans: [["variable", "$tone"], ["property", "color"]] },
  { name: "JavaScript comments cannot close host expression", code: '{(() => { /* } */ return `x ${true}`; })()}', spans: [["comment", "/* } */"], ["keyword", "return"], ["boolean", "true"]] },
  { name: "textarea contents keep Svelte expressions", code: '<textarea>{literal}</textarea>{true}', spans: [["plain-text", "{literal}"], ["expression", "{literal}"], ["boolean", "true"]] },
  { name: "unfinished block and attribute expressions", code: '<p title={format({ x: true', spans: [["attr-value", '={format({ x: true'], ["function", "format"], ["boolean", "true"]] },
];
describe("HTML lexical accuracy", () => { it.each(htmlFixtures)("$name", fixture => verify(html, fixture)); });
describe("Vue lexical accuracy", () => { it.each(vueFixtures)("$name", fixture => verify(vue, fixture)); });
describe("Svelte lexical accuracy", () => { it.each(svelteFixtures)("$name", fixture => verify(svelte, fixture)); });
describe("markup resource limits", () => {
  it.each([html, vue, svelte])("shares token budgets for $name", grammar => {
    for (const limit of ["maxTokenDepth", "maxMatchCount", "maxTokenCount"] as const) expect(() => tokenize('<script>const x = true;</script>', grammar, { [limit]: 0 })).toThrow(limit);
  });
  it.each([vue, svelte])("bounds nested expressions for $name", grammar => {
    expect(() => tokenize((grammar === vue ? '{{ ' : '{ ') + '`x ${'.repeat(10_000), grammar)).toThrow("maxTokenDepth");
  });
});
