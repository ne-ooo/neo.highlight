/**
 * Smoke tests for all grammars — verifies each grammar:
 * 1. Exports a valid Grammar object with a tokens map
 * 2. Can tokenize a hello-world snippet without throwing
 * 3. Produces at least one non-empty token
 * 4. Never produces an infinite tokenizer loop (completes in <100ms)
 */
import { describe, it, expect } from 'vitest'
import { tokenize, createRegistry } from '../../../src/core/tokenizer.js'
import * as grammars from '../../../src/grammars/index.js'
import type { Grammar } from '../../../src/core/types.js'

// Representative snippet for each language
const SNIPPETS: Record<string, string> = {
  javascript: 'const x = 1;\nfunction hello() { return "world"; }',
  typescript: 'const x: number = 1;\ninterface Foo { bar: string }',
  python: 'def hello():\n    print("world")\n    return 42',
  jsx: 'const App = () => <div className="app">Hello</div>',
  tsx: 'const App: React.FC = () => <div>Hello</div>',
  html: '<!DOCTYPE html>\n<html><body><h1>Hello</h1></body></html>',
  css: 'body { color: red; font-size: 16px; }',
  scss: '$primary: #333;\nbody { color: $primary; }',
  json: '{"name":"hello","value":42,"active":true}',
  yaml: 'name: hello\nvalue: 42\nactive: true',
  markdown: '# Hello\n\nThis is **bold** and *italic* text.',
  graphql: 'type Query { hello: String! }',
  ruby: 'def hello\n  puts "world"\nend',
  go: 'func main() {\n  fmt.Println("hello")\n}',
  rust: 'fn main() {\n  println!("hello");\n}',
  java: 'public class Hello {\n  public static void main(String[] args) {}\n}',
  kotlin: 'fun main() {\n  println("hello")\n}',
  swift: 'func hello() -> String {\n  return "world"\n}',
  php: '<?php\necho "hello world";\n?>',
  c: '#include <stdio.h>\nint main() { printf("hello"); return 0; }',
  cpp: '#include <iostream>\nint main() { std::cout << "hello"; }',
  csharp: 'using System;\nclass Hello { static void Main() { Console.WriteLine("hello"); } }',
  bash: '#!/bin/bash\necho "hello world"',
  shell: 'echo "hello" && ls -la',
  docker: 'FROM node:18\nWORKDIR /app\nCMD ["node", "index.js"]',
  sql: 'SELECT id, name FROM users WHERE active = 1 ORDER BY name;',
  toml: '[package]\nname = "hello"\nversion = "1.0.0"',
  ini: '[section]\nkey=value\nfoo=bar',
  diff: '--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n-old line\n+new line',
  regex: '/^[a-z]+$/gi',
  lua: 'local function hello()\n  print("world")\n  return 42\nend',
  dart: 'void main() {\n  var name = "Dart";\n  print("Hello $name");\n}',
  elixir: 'defmodule Hello do\n  def greet(name) do\n    IO.puts("Hello #{name}")\n  end\nend',
  scala: 'object Hello {\n  def main(args: Array[String]): Unit = {\n    println("hello")\n  }\n}',
  r: 'hello <- function(name) {\n  paste("Hello", name)\n}\nprint(hello("world"))',
  svelte: '<script>\n  let count = 0;\n</script>\n<button on:click={() => count++}>\n  {count}\n</button>',
  vue: '<template>\n  <div v-if="show">{{ message }}</div>\n</template>',
  astro: '---\nconst name = "Astro";\n---\n<h1>Hello {name}</h1>',
  zig: 'const std = @import("std");\npub fn main() void {\n  std.debug.print("hello\\n", .{});\n}',
  wasm: '(module\n  (func $add (param $a i32) (param $b i32) (result i32)\n    local.get $a\n    local.get $b\n    i32.add))',
  haskell: 'module Main where\n\nmain :: IO ()\nmain = putStrLn "hello"',
  erlang: '-module(hello).\n-export([greet/1]).\ngreet(Name) -> io:format("Hello ~s~n", [Name]).',
  clojure: '(ns hello.core)\n(defn greet [name]\n  (str "Hello, " name))',
  ocaml: 'let () =\n  let name = "OCaml" in\n  Printf.printf "Hello %s\\n" name',
  perl: 'use strict;\nmy $name = "Perl";\nprint "Hello $name\\n";',
  objectivec: '#import <Foundation/Foundation.h>\n@interface Hello : NSObject\n@end\n@implementation Hello\n@end',
  powershell: '$name = "PowerShell"\nWrite-Host "Hello $name"\nGet-Process | Where-Object { $_.CPU -gt 10 }',
  terraform: 'resource "aws_instance" "web" {\n  ami           = "ami-12345"\n  instance_type = "t2.micro"\n  tags = {\n    Name = "hello"\n  }\n}',
  prisma: 'model User {\n  id    Int     @id @default(autoincrement())\n  email String  @unique\n  name  String?\n}',
  nix: '{ pkgs ? import <nixpkgs> {} }:\npkgs.mkShell {\n  buildInputs = [ pkgs.nodejs ];\n}',
  latex: '\\documentclass{article}\n\\begin{document}\nHello \\textbf{world} $x^2 + y^2 = z^2$\n\\end{document}',
  less: '@primary: #333;\n.container {\n  color: @primary;\n  &:hover { color: darken(@primary, 10%); }\n}',
  handlebars: '<div class="post">\n  {{#if title}}\n    <h1>{{title}}</h1>\n  {{/if}}\n  <p>{{body}}</p>\n</div>',
  solidity: 'pragma solidity ^0.8.0;\ncontract Hello {\n  string public greeting = "hello";\n  function greet() public view returns (string memory) {\n    return greeting;\n  }\n}',
  csv: 'name,age,active\n"John Doe",30,true\nJane,25,false',
}

function isGrammar(v: unknown): v is Grammar {
  return typeof v === 'object' && v !== null && 'tokens' in v
}

describe('Grammar exports', () => {
  const grammarNames = Object.keys(grammars) as (keyof typeof grammars)[]

  it('exports at least 20 grammars', () => {
    expect(grammarNames.length).toBeGreaterThanOrEqual(20)
  })

  for (const name of grammarNames) {
    const grammar = grammars[name] as unknown
    describe(`${name} grammar`, () => {
      it('is a valid Grammar object', () => {
        expect(isGrammar(grammar)).toBe(true)
        if (isGrammar(grammar)) {
          expect(grammar.tokens).toBeDefined()
        }
      })

      const snippet = SNIPPETS[name] ?? `${name} code`

      it('tokenizes without throwing', () => {
        expect(() => tokenize(snippet, grammar as Grammar)).not.toThrow()
      })

      it('produces tokens from snippet', () => {
        const tokens = tokenize(snippet, grammar as Grammar)
        expect(Array.isArray(tokens)).toBe(true)
        expect(tokens.length).toBeGreaterThan(0)
      })

      it('completes tokenization in reasonable time (< 500ms)', () => {
        const start = performance.now()
        tokenize(snippet, grammar as Grammar)
        const elapsed = performance.now() - start
        expect(elapsed).toBeLessThan(500)
      })
    })
  }
})

describe('createRegistry', () => {
  it('creates a Map from an array of grammars', () => {
    const { javascript, typescript } = grammars
    const registry = createRegistry([javascript, typescript])
    expect(registry).toBeInstanceOf(Map)
  })

  it('registry contains registered grammars by name', () => {
    const { javascript } = grammars
    const registry = createRegistry([javascript])
    expect(registry.has(javascript.name)).toBe(true)
  })

  it('registry returns undefined for unregistered language', () => {
    const registry = createRegistry([])
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('creates registry with all grammars', () => {
    const allGrammars = Object.values(grammars) as Grammar[]
    const registry = createRegistry(allGrammars)
    expect(registry.size).toBeGreaterThanOrEqual(20)
  })
})
