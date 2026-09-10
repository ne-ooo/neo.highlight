import { describe, expect, it, vi } from 'vitest';
import { renderToHTML } from '../../../src/core/renderer';
import { tokenize } from '../../../src/core/tokenizer';
import { javascript } from '../../../src/grammars/javascript';
import { githubDark } from '../../../src/themes/github-dark';
import type { RenderAttributes, RenderHooks, Token, TokenRenderContext, LineRenderContext } from '../../../src/core/types';

const code = 'const value = `a\r\nb ${true}`;\n';
const tokens = tokenize(code, javascript);
const documentOf = (html: string) => { const root = document.createElement('div'); root.innerHTML = html; return root; };

describe('structured rendering hooks', () => {
  it('keeps no-op depth limits consistent for leaf string arrays', () => {
    const leaf: Token[] = [{ type: 'keyword', content: ['con', 'st'], length: 5 }];
    const options = { maxTokenDepth: 0 };
    expect(renderToHTML(leaf, { ...options, hooks: { token: () => {} } })).toBe(renderToHTML(leaf, options));
    const nested: Token[] = [{ type: 'outer', content: leaf, length: 5 }];
    expect(() => renderToHTML(nested, { ...options, hooks: {} })).toThrow('maxTokenDepth');
  });
  it.each(['inline', 'class'] as const)('keeps no-op output identical in %s mode', styleMode => {
    const options = { theme: githubDark, styleMode, lineNumbers: true, highlightLines: [2], diffHighlight: { added: [1] } };
    expect(renderToHTML(tokens, { ...options, hooks: { token: () => {}, line: () => {}, code: () => {}, pre: () => {} } })).toBe(renderToHTML(tokens, options));
  });
  it('reports actual nested source offsets and invokes tokens after children', () => {
    const seen: TokenRenderContext[] = [];
    renderToHTML(tokens, { hooks: { token: ctx => { seen.push(ctx); expect(Object.isFrozen(ctx)).toBe(true); return { attributes: { 'data-start': ctx.start } }; } } });
    expect(seen.find(c => c.type === 'keyword')).toMatchObject({ start: 0, end: 5, source: code });
    const bool = seen.find(c => c.type === 'boolean')!;
    expect(code.slice(bool.start, bool.end)).toBe('true');
    expect(seen.indexOf(bool)).toBeLessThan(seen.findIndex(c => c.type === 'interpolation'));
    const misleading: Token[] = [{ type: 'x', content: ['😀', { type: 'y', content: 'ok', length: 999 }], length: 1 }];
    const spans: TokenRenderContext[] = [];
    renderToHTML(misleading, { hooks: { token: ctx => { spans.push(ctx); } } });
    expect(spans.map(({ start, end }) => [start, end])).toEqual([[2, 4], [0, 4]]);
  });
  it('preserves source and theme classes while decorating every wrapper', () => {
    const root = documentOf(renderToHTML(tokens, { styleMode: 'class', theme: githubDark, language: 'js', hooks: {
      token: ctx => ({ class: ['decorated'], attributes: { title: '<"&>\' ' + ctx.type } }),
      code: () => ({ class: 'custom-code', attributes: { 'data-ready': false } }),
      pre: () => ({ class: 'custom-pre', attributes: { 'aria-label': 'Code <&>', tabindex: 0 } }),
    } }));
    expect(root.querySelector('code')?.textContent).toBe(code.replace(/\r\n/g, '\n'));
    expect(root.querySelector('.neo-hl-keyword.decorated')).not.toBeNull();
    expect(root.querySelector('pre.custom-pre')?.getAttribute('aria-label')).toBe('Code <&>');
    expect(root.querySelector('code')?.getAttribute('data-ready')).toBe('false');
    expect(root.querySelector('img, script, [style]')).toBeNull();
  });
  it('reports CRLF and trailing-line spans, independent of display numbering', () => {
    const lines: LineRenderContext[] = [];
    const root = documentOf(renderToHTML(['a\r', '\nb\rc\n'], { startLine: 40, lineNumbers: true, highlightLines: [2], diffHighlight: { added: [2], removed: [2] }, hooks: { line: ctx => {
      lines.push(ctx); return { attributes: { id: `line-${ctx.displayLine}`, 'data-line': ctx.line } };
    } } }));
    expect(lines.map(({ line, displayLine, start, end }) => [line, displayLine, start, end])).toEqual([[1, 40, 0, 1], [2, 41, 3, 4], [3, 42, 5, 6], [4, 43, 7, 7]]);
    expect(lines[1]).toMatchObject({ highlighted: true, added: true, removed: true, modified: false });
    expect(root.querySelector('#line-41 .neo-hl-line-number')?.textContent).toBe('41');
  });
  it('wraps lines for a line hook and omits code/pre hooks without wrappers', () => {
    const pre = vi.fn(); const codeHook = vi.fn();
    const html = renderToHTML(['a\nb'], { wrapCode: false, hooks: { line: () => ({ class: 'selected' }), pre, code: codeHook } });
    expect(documentOf(html).querySelectorAll('.neo-hl-line.selected')).toHaveLength(2);
    expect(pre).not.toHaveBeenCalled(); expect(codeHook).not.toHaveBeenCalled();
  });
  it('does not cache callback output across tokens or renders', () => {
    let count = 0;
    const hooks: RenderHooks = { token: () => ({ attributes: { 'data-call': ++count } }) };
    const source: Token[] = [{ type: 'keyword', content: 'if', length: 2 }, ' ', { type: 'keyword', content: 'else', length: 4 }];
    const first = renderToHTML(source, { hooks }); const second = renderToHTML(source, { hooks });
    expect(first).toContain('data-call="1"'); expect(first).toContain('data-call="2"'); expect(second).toContain('data-call="3"');
    expect(source[0]).toEqual({ type: 'keyword', content: 'if', length: 2 });
  });
  it.each(['onclick', 'style', 'href', 'src', 'class', 'ONLOAD', 'data-x" onerror', 'xmlns'])('rejects the attribute %s', name => {
    expect(() => renderToHTML(tokens, { hooks: { pre: () => ({ attributes: { [name]: 'bad' } }) } })).toThrow('Unsupported hook attribute');
  });
  it.each([{ class: ['a"'] }, { class: [1] }, { class: {} }, { attributes: [] }, { attributes: { title: {} } }, { attributes: { title: NaN } }, null, 'html', Promise.resolve({})])('rejects invalid decorator output %#', value => {
    expect(() => renderToHTML(tokens, { hooks: { pre: () => value as RenderAttributes } })).toThrow(TypeError);
  });
  it('rejects attempts to override generated language attributes', () => {
    expect(() => renderToHTML(tokens, { language: 'js', hooks: { pre: () => ({ attributes: { 'data-language': 'other' } }) } })).toThrow('conflicts');
  });
  it('propagates callback errors and validates callback configuration', () => {
    const failure = new Error('decorator');
    expect(() => renderToHTML(tokens, { hooks: { token: () => { throw failure; } } })).toThrow(failure);
    expect(() => renderToHTML(tokens, { hooks: { token: 'bad' } as unknown as RenderHooks })).toThrow('must be a function');
  });
  it('enforces source and generated-output budgets with hooks enabled', () => {
    const hooks: RenderHooks = { token: () => ({ attributes: { title: 'x'.repeat(500) } }), line: () => ({ class: 'custom' }) };
    for (const limit of ['maxTokenCount', 'maxTokenDepth', 'maxLines'] as const) expect(() => renderToHTML(tokens, { hooks, [limit]: 0 })).toThrow(limit);
    expect(() => renderToHTML(tokens, { hooks, maxRenderedLength: 200 })).toThrow('maxRenderedLength');
    expect(() => renderToHTML([], { hooks, maxLines: 0 })).toThrow('maxLines');
    const cycle: Token[] = []; cycle.push({ type: 'x', content: cycle, length: 1 });
    expect(() => renderToHTML(cycle, { hooks })).toThrow('cycle');
  });
  it.each([0, -1, 1.5, Infinity, NaN])('rejects invalid startLine %s', startLine => {
    expect(() => renderToHTML(['x'], { startLine })).toThrow('startLine');
  });
  it('rejects display-number overflow', () => {
    expect(() => renderToHTML(['a\nb'], { lineNumbers: true, startLine: Number.MAX_SAFE_INTEGER })).toThrow('safe integer');
  });
});
