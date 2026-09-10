import { describe, expect, it } from 'vitest';
import { renderToHTML } from '../../../src/core/renderer';
import { tokenize } from '../../../src/core/tokenizer';
import { javascript } from '../../../src/grammars/javascript';
import type { Token } from '../../../src/core/types';

function rendered(tokens: Token[], options = {}) {
  const root = document.createElement('div');
  root.innerHTML = renderToHTML(tokens, { wrapLines: 'source', ...options });
  return root;
}

describe('source-preserving line layout', () => {
  it('preserves exact DOM source through every prefix, including blank lines and Unicode', () => {
    const source = 'const text = `😀 é\n\n日本語`;\n/* first\n\nlast */\n\n';
    for (let end = 0; end <= source.length; end++) {
      const current = source.slice(0, end);
      for (const styleMode of ['inline', 'class'] as const) {
        const root = rendered(tokenize(current, javascript), { styleMode });
        expect(root.querySelector('code')?.textContent).toBe(current);
        const expectedLines = current ? current.split('\n').length - Number(current.endsWith('\n')) : 0;
        expect(root.querySelectorAll('.neo-hl-line-source')).toHaveLength(expectedLines);
      }
    }
  });

  it('retains CR and CRLF boundaries across nested token markup', () => {
    const tokens: Token[] = [{ type: 'string', content: ['a\r', { type: 'comment', content: '\n', length: 1 }, 'b\rc\n'], length: 7 }];
    const root = rendered(tokens, { wrapCode: false, classPrefix: 'test-hl' });
    expect(root.textContent).toBe('a\r\nb\rc\n');
    expect([...root.children].map(line => line.textContent)).toEqual(['a\r\n', 'b\r', 'c\n']);
    expect(root.querySelectorAll('.test-hl-line-source')).toHaveLength(3);
  });

  it('composes with line hooks, numbering, focus, ranges, and diff markers', () => {
    const source = 'const a = 1;\n\nconst b = 2;';
    const seen: number[] = [];
    const root = rendered(tokenize(source, javascript), {
      lineNumbers: true, startLine: 8, highlightLines: [2],
      highlightRanges: [{ start: 6, end: 7 }],
      diffHighlight: { added: [3] }, hooks: { line: ({ line }: { line: number }) => { seen.push(line); } },
    });
    expect([...root.querySelectorAll('.neo-hl-line-content')].map(line => line.textContent).join('')).toBe(source);
    expect(seen).toEqual([1, 2, 3]);
    expect(root.querySelector('.neo-hl-line-highlighted')?.textContent).toBe('9\n');
    expect(root.querySelector('.neo-hl-diff-gutter')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.neo-hl-word-highlight')?.textContent).toBe('a');
  });

  it('enforces source line and output limits and rejects unsupported modes', () => {
    expect(() => rendered(['a\n'], { maxLines: 1 })).toThrow(/maxLines/);
    const html = renderToHTML(['\r\n'], { wrapLines: 'source' });
    expect(() => renderToHTML(['\r\n'], { wrapLines: 'source', maxRenderedLength: html.length - 1 })).toThrow(/maxRenderedLength/);
    expect(() => rendered(['x'], { wrapLines: 'invalid' })).toThrow(/wrapLines/);
  });
});
