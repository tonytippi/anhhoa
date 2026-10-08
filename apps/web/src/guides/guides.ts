// Hướng dẫn sử dụng: mỗi bài là một tệp Markdown trong ./articles, ảnh nằm ở public/guides.
// Frontmatter gồm title, summary, order và requires (trang cần có quyền để thấy bài; để trống = mọi người).

export type GuideArticle = { id: string; title: string; summary: string; order: number; requires: string[]; body: string };

const sources = import.meta.glob("./articles/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export function parseArticle(path: string, source: string): GuideArticle {
  const id = path.replace(/^.*\//, "").replace(/\.md$/, "").replace(/^\d+-/, "");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  const meta: Record<string, string> = {};
  for (const line of match?.[1]?.split("\n") ?? []) {
    const separator = line.indexOf(":");
    if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return {
    id,
    title: meta.title ?? id,
    summary: meta.summary ?? "",
    order: Number(meta.order ?? 999),
    requires: (meta.requires ?? "").split(",").map((page) => page.trim()).filter(Boolean),
    body: match ? source.slice(match[0].length) : source,
  };
}

export const guideArticles: GuideArticle[] = Object.entries(sources).map(([path, source]) => parseArticle(path, source)).sort((left, right) => left.order - right.order);

export const visibleGuides = (allowedPages: string[]) => guideArticles.filter((article) => article.requires.every((page) => allowedPages.includes(page)));
