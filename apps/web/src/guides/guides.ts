// Hướng dẫn sử dụng: mỗi bài là một tệp Markdown trong ./articles, ảnh nằm ở public/guides.
// Frontmatter gồm title, summary, order, requires (trang cần có quyền để thấy bài; để trống = mọi người)
// và pages (trang mà nút "Hướng dẫn" ở đầu trang gợi ý bài này; để trống = dùng requires).

export type GuideArticle = { id: string; title: string; summary: string; order: number; requires: string[]; pages: string[]; body: string };
export type GuideSearchResult = { article: GuideArticle; excerpt?: string };

const sources = import.meta.glob("./articles/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const list = (value: string | undefined) => (value ?? "").split(",").map((page) => page.trim()).filter(Boolean);

export function parseArticle(path: string, source: string): GuideArticle {
  const id = path.replace(/^.*\//, "").replace(/\.md$/, "").replace(/^\d+-/, "");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  const meta: Record<string, string> = {};
  for (const line of match?.[1]?.split("\n") ?? []) {
    const separator = line.indexOf(":");
    if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  const requires = list(meta.requires);
  return {
    id,
    title: meta.title ?? id,
    summary: meta.summary ?? "",
    order: Number(meta.order ?? 999),
    requires,
    pages: meta.pages ? list(meta.pages) : requires,
    body: match ? source.slice(match[0].length) : source,
  };
}

export const guideArticles: GuideArticle[] = Object.entries(sources).map(([path, source]) => parseArticle(path, source)).sort((left, right) => left.order - right.order);

export const visibleGuides = (allowedPages: string[]) => guideArticles.filter((article) => article.requires.every((page) => allowedPages.includes(page)));

export const guidesForPage = (articles: GuideArticle[], page: string) => articles.filter((article) => article.pages.includes(page));

// Người dùng hay gõ không dấu, nên so khớp sau khi bỏ dấu tiếng Việt; mọi từ trong ô tìm phải có trong bài.
export const foldVietnamese = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const plainText = (markdown: string) => markdown
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/^\s*(?:#+|>\s*(?:\[![A-Z]+\])?|[-*]|\d+\.)\s*/gm, "")
  .replace(/[`*_]/g, "")
  .replace(/\s+/g, " ")
  .trim();

export function searchGuides(articles: GuideArticle[], query: string): GuideSearchResult[] {
  const terms = foldVietnamese(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return articles.map((article) => ({ article }));
  const results: GuideSearchResult[] = [];
  for (const article of articles) {
    const heading = foldVietnamese(`${article.title} ${article.summary}`);
    const body = plainText(article.body);
    // NFD rồi bỏ dấu giữ nguyên số ký tự với văn bản đã NFC, nên vị trí tìm được dùng lại để cắt đoạn trích từ văn bản gốc.
    const source = body.normalize("NFC");
    const foldedBody = foldVietnamese(source);
    if (!terms.every((term) => heading.includes(term) || foldedBody.includes(term))) continue;
    // Khớp ở tiêu đề/tóm tắt thì chỉ cần hiện tóm tắt; khớp trong bài thì kèm đoạn trích quanh từ đó.
    const bodyTerm = terms.find((term) => !heading.includes(term));
    const at = bodyTerm ? foldedBody.indexOf(bodyTerm) : -1;
    if (at < 0) { results.push({ article }); continue; }
    const start = Math.max(0, source.lastIndexOf(" ", Math.max(0, at - 60)) + 1);
    const end = source.indexOf(" ", Math.min(source.length, at + bodyTerm!.length + 100));
    results.push({ article, excerpt: `${start > 0 ? "…" : ""}${source.slice(start, end < 0 ? undefined : end)}${end < 0 ? "" : "…"}` });
  }
  return results;
}
