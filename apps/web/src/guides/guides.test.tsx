import { describe, expect, it } from 'vitest';
import { parseBlocks } from './guide-markdown';
import { guideArticles, parseArticle, visibleGuides } from './guides';

describe('guide articles', () => {
  it('reads frontmatter and strips the order prefix from the id', () => {
    const article = parseArticle('./articles/07-vi-du.md', '---\ntitle: Ví dụ\nsummary: Tóm tắt\norder: 7\nrequires: receivables, promotions\n---\n## Mục\n');
    expect(article).toEqual({ id: 'vi-du', title: 'Ví dụ', summary: 'Tóm tắt', order: 7, requires: ['receivables', 'promotions'], body: '## Mục\n' });
  });
  it('ships ordered articles whose guide links and images resolve', async () => {
    const { readdirSync } = await import('node:fs');
    const images = new Set(readdirSync('public/guides'));
    const ids = new Set(guideArticles.map((article) => article.id));
    expect(guideArticles.length).toBeGreaterThan(0);
    for (const article of guideArticles) {
      for (const [, id] of article.body.matchAll(/\]\(guide:([a-z0-9-]+)\)/g)) expect(ids.has(id!), `${article.id} → ${id}`).toBe(true);
      for (const [, src] of article.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) expect(images.has(src!), `${article.id} → ${src}`).toBe(true);
    }
  });
  it('hides articles for pages the position cannot open', () => {
    const visible = visibleGuides(['overview', 'collection-runs', 'guides']).map((article) => article.id);
    expect(visible).toContain('tao-dot-thu');
    expect(visible).toContain('bat-dau');
    expect(visible).not.toContain('khoan-thu');
  });
  it('parses notes, nested lists and continued numbering', () => {
    expect(parseBlocks('> [!WARNING]\n> Cẩn thận\n\n1. Một\n   - Con\n2. Hai\n\n![Ảnh](a.jpg)\n\n3. Ba')).toEqual([
      { kind: 'note', warning: true, lines: ['Cẩn thận'] },
      { kind: 'list', ordered: true, start: 1, items: [{ text: 'Một', children: ['Con'] }, { text: 'Hai', children: [] }] },
      { kind: 'image', alt: 'Ảnh', src: 'a.jpg' },
      { kind: 'list', ordered: true, start: 3, items: [{ text: 'Ba', children: [] }] },
    ]);
  });
});
