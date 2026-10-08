import { useEffect } from "react";
import { GuideMarkdown, type GuideLinks } from "./guide-markdown";
import type { GuideArticle } from "./guides";

export function GuidesWorkspace({ articles, guideId, links }: { articles: GuideArticle[]; guideId?: string; links: GuideLinks }) {
  const position = articles.findIndex((article) => article.id === guideId);
  const article = articles[position];
  useEffect(() => { window.scrollTo?.(0, 0); document.querySelector<HTMLElement>(".guides h1")?.focus(); }, [guideId]);
  if (!article) return <section className="guides" aria-labelledby="guides-title">
    <header>
      <p className="eyebrow">HƯỚNG DẪN</p>
      <h1 id="guides-title" tabIndex={-1}>Hướng dẫn sử dụng</h1>
      <p>Mỗi bài hướng dẫn một việc cụ thể. Ảnh minh họa dùng dữ liệu mẫu, không phải dữ liệu của trường.</p>
    </header>
    {guideId && <p role="alert">Không tìm thấy bài hướng dẫn này hoặc tài khoản chưa có quyền dùng chức năng tương ứng.</p>}
    <ol className="guides-index">{articles.map((item, index) => <li key={item.id}><a href={links.href(item.id)} onClick={(event) => { event.preventDefault(); links.open(item.id); }}><span className="guides-index-number">{index + 1}</span><span><strong>{item.title}</strong>{item.summary && <span>{item.summary}</span>}</span></a></li>)}</ol>
  </section>;
  const previous = articles[position - 1];
  const next = articles[position + 1];
  const pager = (target: GuideArticle | undefined, label: string, className: string) => target && <a className={className} href={links.href(target.id)} onClick={(event) => { event.preventDefault(); links.open(target.id); }}><span>{label}</span><strong>{target.title}</strong></a>;
  return <article className="guides guide-article" aria-labelledby="guide-title">
    <header>
      <p className="eyebrow"><a href={links.href("")} onClick={(event) => { event.preventDefault(); links.open(""); }}>HƯỚNG DẪN</a> › Bài {position + 1}/{articles.length}</p>
      <h1 id="guide-title" tabIndex={-1}>{article.title}</h1>
      {article.summary && <p>{article.summary}</p>}
    </header>
    <div className="guide-body"><GuideMarkdown source={article.body} links={links} /></div>
    <nav className="guide-pager" aria-label="Bài hướng dẫn khác">{pager(previous, "Bài trước", "guide-pager-previous")}{pager(next, "Bài tiếp theo", "guide-pager-next")}</nav>
  </article>;
}
