import { describe, expect, it } from 'vitest';
import { renderToHTML, tokenize, normalizeHighlightRanges, MAX_HIGHLIGHT_RANGES, getThemeStylesheet, getDualThemeStylesheet } from '../../../src/index';
import type { Token, TokenRenderContext } from '../../../src/index';
import { javascript } from '../../../src/grammars/javascript';
import { githubDark } from '../../../src/themes/github-dark';
import { githubLight } from '../../../src/themes/github-light';

const dom = (html: string) => { const root = document.createElement('div'); root.innerHTML = html; return root; };
const selected = (root: HTMLElement, prefix = 'neo-hl') => [...root.querySelectorAll(`.${prefix}-word-highlight`)].map(span => span.textContent).join('');

describe('source range highlighting', () => {
  it('merges adjacent, duplicate, and overlapping ranges without mutating input', () => {
    const input = Object.freeze([Object.freeze({ start: 4, end: 6 }), Object.freeze({ start: 1, end: 4 }), Object.freeze({ start: 2, end: 5 })]);
    const result = normalizeHighlightRanges('01234567', input);
    expect(result).toEqual([{ start: 1, end: 6 }]);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(input[0].start).toBe(4);
  });
  it.each([{ start: -1, end: 2 }, { start: 1, end: 1 }, { start: 2, end: 1 }, { start: 0, end: 20 }, { start: .5, end: 2 }, { start: 0, end: Infinity }, null])('rejects invalid bounds %j', range => {
    expect(() => renderToHTML(['abc'], { highlightRanges: [range as never] })).toThrow('highlightRanges');
  });
  it('rejects malformed collections, excessive entries, surrogate splits, and CRLF splits', () => {
    expect(() => renderToHTML(['abc'], { highlightRanges: 'bad' as never })).toThrow(TypeError);
    expect(() => normalizeHighlightRanges('abc', 'bad' as never)).toThrow(TypeError);
    const many = Array.from({ length: MAX_HIGHLIGHT_RANGES + 1 }, () => ({ start: 0, end: 1 }));
    expect(() => renderToHTML(['abc'], { highlightRanges: many })).toThrow('256');
    expect(() => normalizeHighlightRanges('abc', many)).toThrow('256');
    for (const [source, range] of [['😀x', { start: 1, end: 2 }], ['😀x', { start: 0, end: 1 }], ['a\r\nb', { start: 0, end: 2 }]] as const) {
      expect(() => renderToHTML([source], { highlightRanges: [range] })).toThrow('splitting');
    }
  });
  it.each(['inline', 'class'] as const)('preserves nested syntax and text across selections in %s mode', styleMode => {
    const source = 'const label = `hello ${format({value: true})}`;';
    const tokens = tokenize(source, javascript);
    const before = JSON.stringify(tokens);
    const start = source.indexOf('hello');
    const end = source.indexOf('})') + 2;
    const calls: TokenRenderContext[] = [];
    const root = dom(renderToHTML(tokens, { styleMode, theme: githubDark, highlightRanges: [{ start, end }], hooks: { token: ctx => { calls.push(ctx); } } }));
    expect(root.querySelector('code')?.textContent).toBe(source);
    expect(selected(root)).toBe(source.slice(start, end));
    expect(root.querySelector('.neo-hl-interpolation .neo-hl-boolean .neo-hl-word-highlight')?.textContent).toBe('true');
    expect(calls.some(ctx => ctx.type === 'word-highlight')).toBe(false);
    expect(calls.find(ctx => ctx.type === 'boolean')).toMatchObject({ start: source.indexOf('true'), end: source.indexOf('true') + 4 });
    expect(JSON.stringify(tokens)).toBe(before);
    if (styleMode === 'class') expect(root.querySelector('[style]')).toBeNull();
  });
  it('preserves escaped HTML, non-BMP characters, combining marks, and adjacent split plain leaves', () => {
    const source = '😀 e\u0301 <&> 🇬🇧';
    const root = dom(renderToHTML(['\ud83d', '\ude00', source.slice(2)], { highlightRanges: [{ start: 0, end: source.length }], wrapCode: false }));
    expect(root.textContent).toBe(source);
    expect(selected(root)).toBe(source);
    expect(root.querySelectorAll('.neo-hl-word-highlight')).toHaveLength(1);
    expect(root.querySelector('img, script')).toBeNull();
  });
  it('keeps multiline spans out of line terminators and gutters', () => {
    const source = 'alpha\r\nβeta\n';
    const root = dom(renderToHTML([{ type: 'comment', content: source, length: 999 }], {
      highlightRanges: [{ start: 2, end: source.length }], lineNumbers: true, startLine: 20, diffHighlight: { removed: [2] },
    }));
    expect(selected(root)).toBe('phaβeta');
    expect([...root.querySelectorAll('.neo-hl-line-content')].map(line => line.textContent).join('\n')).toBe('alpha\nβeta\n');
    expect(root.querySelector('.neo-hl-word-highlight .neo-hl-line-number, .neo-hl-word-highlight .neo-hl-diff-gutter')).toBeNull();
    expect(root.querySelector('.neo-hl-line:last-child .neo-hl-word-highlight')).toBeNull();
  });
  it('uses actual source content rather than token lengths and keeps depth-zero leaves valid', () => {
    const tokens: Token[] = [{ type: 'keyword', content: ['con', 'st'], length: 999 }, ' name'];
    const root = dom(renderToHTML(tokens, { maxTokenDepth: 0, highlightRanges: [{ start: 2, end: 8 }] }));
    expect(selected(root)).toBe('nst na');
  });
  it('keeps disabled output identical and supports range-only and newline-only selections', () => {
    const tokens = tokenize('const x = 1\n', javascript);
    expect(renderToHTML(tokens, { highlightRanges: [] })).toBe(renderToHTML(tokens));
    const root = dom(renderToHTML(['a\r\nb'], { wrapCode: false, highlightRanges: [{ start: 1, end: 3 }] }));
    expect(selected(root)).toBe('');
    expect(root.textContent).toBe('a\nb');
  });
  it('bounds nested decorated output and respects token, depth, and line budgets', () => {
    const nodes: Token[] = [{ type: 'outer', content: Array.from({ length: 1000 }, () => ({ type: 'inner', content: 'x', length: 1 })), length: 1000 }];
    expect(() => renderToHTML(nodes, { highlightRanges: [{ start: 0, end: 1000 }], maxRenderedLength: 1000 })).toThrow('maxRenderedLength');
    expect(() => renderToHTML(nodes, { highlightRanges: [{ start: 0, end: 1000 }], maxTokenCount: 5 })).toThrow('maxTokenCount');
    expect(() => renderToHTML(nodes, { highlightRanges: [{ start: 0, end: 1000 }], maxTokenDepth: 0 })).toThrow('maxTokenDepth');
    expect(() => renderToHTML(['a\nb'], { highlightRanges: [{ start: 0, end: 3 }], maxLines: 1 })).toThrow('maxLines');
    const cycle: Token[] = []; cycle.push({ type: 'cycle', content: cycle, length: 1 });
    expect(() => renderToHTML(cycle, { highlightRanges: [{ start: 0, end: 1 }] })).toThrow('cycle');
  });
  it('supplies word styles for single and dual themes and custom prefixes', () => {
    expect(getThemeStylesheet(githubDark, 'example')).toContain('.example-word-highlight');
    expect(getDualThemeStylesheet(githubLight, githubDark, { classPrefix: 'example' })).toContain('--example-word-highlight-bg');
    const root = dom(renderToHTML(['abc'], { classPrefix: 'example', highlightRanges: [{ start: 1, end: 2 }] }));
    expect(selected(root, 'example')).toBe('b');
  });
  it('matches source slices for a deterministic set of nested-token selections', () => {
    const source = 'const x = `😀 ${fn({ a: true, b: "<&>" })}`;\r\n// done\n';
    const tokens = tokenize(source, javascript);
    const boundaries = Array.from({ length: source.length + 1 }, (_, i) => i).filter(i => !(source[i - 1] === '\r' && source[i] === '\n') && !(source.charCodeAt(i) >= 0xdc00 && source.charCodeAt(i) <= 0xdfff));
    for (let i = 0; i < 100; i++) {
      const a = boundaries[i % (boundaries.length - 1)]!;
      const endIndex = (i * 17) % (boundaries.length - 1) + 1;
      const b = boundaries[endIndex]!;
      if (a === b) continue;
      const start = Math.min(a, b), end = Math.max(a, b);
      const root = dom(renderToHTML(tokens, { highlightRanges: [{ start, end }], lineNumbers: true }));
      expect(selected(root)).toBe(source.slice(start, end).replace(/[\r\n]/g, ''));
      expect([...root.querySelectorAll('.neo-hl-line-content')].map(line => line.textContent).join('\n')).toBe(source.replace(/\r\n/g, '\n'));
    }
  });
});
