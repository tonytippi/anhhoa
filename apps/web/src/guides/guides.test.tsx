import { describe, expect, it } from 'vitest';
import { parseBlocks } from './guide-markdown';
import { guideArticles, guidesForPage, parseArticle, searchGuides, visibleGuides } from './guides';

describe('guide articles', () => {
  it('reads frontmatter and strips the order prefix from the id', () => {
    const article = parseArticle('./articles/07-vi-du.md', '---\ntitle: Ví dụ\nsummary: Tóm tắt\norder: 7\nrequires: receivables, promotions\n---\n## Mục\n');
    expect(article).toEqual({ id: 'vi-du', title: 'Ví dụ', summary: 'Tóm tắt', order: 7, requires: ['receivables', 'promotions'], pages: ['receivables', 'promotions'], body: '## Mục\n' });
    expect(parseArticle('./articles/08-khac.md', '---\ntitle: Khác\nrequires: collection-runs\npages: collection-runs, receipt-queue\n---\n').pages).toEqual(['collection-runs', 'receipt-queue']);
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
  it('suggests the articles that belong to the open page', () => {
    const ids = (page: string) => guidesForPage(guideArticles, page).map((article) => article.id);
    expect(ids('receipt-queue')).toEqual(expect.arrayContaining(['thu-tien', 'quyet-toan-nghi-hoc', 'khi-mang-chap-chon']));
    expect(ids('receipt-queue')).not.toContain('tao-dot-thu');
    expect(ids('overview')).toEqual(['bat-dau']);
    expect(ids('students')).toEqual([]);
  });
  it('searches titles and article text without Vietnamese diacritics', () => {
    const ids = (query: string) => searchGuides(guideArticles, query).map(({ article }) => article.id);
    expect(ids('')).toHaveLength(guideArticles.length);
    expect(ids('dong dot thu')).toContain('dong-dot-thu');
    expect(ids('ĐÓNG ĐỢT')).toContain('dong-dot-thu');
    expect(ids('khong co bai nao nhu the nay')).toEqual([]);
    const sample = parseArticle('./articles/09-mau.md', '---\ntitle: Mẫu\n---\nMở trang `Thu tiền` rồi bấm **Ghi nhận đã chi** cho phiếu hoàn tiền.\n');
    expect(searchGuides([sample], 'mau')).toEqual([{ article: sample }]);
    expect(searchGuides([sample], 'ghi nhan da chi')[0]!.excerpt).toBe('Mở trang Thu tiền rồi bấm Ghi nhận đã chi cho phiếu hoàn tiền.');
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
