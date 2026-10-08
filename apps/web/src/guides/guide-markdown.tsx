import type { ReactNode } from "react";

// Markdown tối giản cho bài hướng dẫn: ## / ### tiêu đề, đoạn văn, danh sách 1. và -, ghi chú > (> [!WARNING] để cảnh báo),
// ảnh ![chú thích](tệp-trong-public/guides), **đậm**, *nghiêng*, `nhãn giao diện` và liên kết bài khác [chữ](guide:id).

type ListItem = { text: string; children: string[] };

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { kind: "note"; warning: boolean; lines: string[] }
  | { kind: "image"; alt: string; src: string };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) { index += 1; continue; }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) { blocks.push({ kind: "heading", level: heading[1]!.length as 2 | 3, text: heading[2]!.trim() }); index += 1; continue; }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line.trim());
    if (image) { blocks.push({ kind: "image", alt: image[1]!, src: image[2]! }); index += 1; continue; }
    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (index < lines.length && lines[index]!.startsWith(">")) { quoted.push(lines[index]!.replace(/^>\s?/, "")); index += 1; }
      const warning = quoted[0]?.trim() === "[!WARNING]";
      blocks.push({ kind: "note", warning, lines: (warning ? quoted.slice(1) : quoted).filter((item) => item.trim()) });
      continue;
    }
    const listItem = /^(\d+\.|-)\s+(.*)$/.exec(line);
    if (listItem) {
      const ordered = listItem[1] !== "-";
      const start = ordered ? Number.parseInt(listItem[1]!, 10) : 1;
      const items: ListItem[] = [];
      while (index < lines.length) {
        const current = lines[index]!;
        const item = /^(\d+\.|-)\s+(.*)$/.exec(current);
        const child = /^\s{2,}-\s+(.*)$/.exec(current);
        const last = items[items.length - 1];
        if (item && (item[1] !== "-") === ordered) items.push({ text: item[2]!, children: [] });
        else if (child && last) last.children.push(child[1]!);
        else if (/^\s{2,}\S/.test(current) && last) {
          if (last.children.length) last.children[last.children.length - 1] += ` ${current.trim()}`;
          else last.text += ` ${current.trim()}`;
        }
        else break;
        index += 1;
      }
      blocks.push({ kind: "list", ordered, start, items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index]!.trim() && !/^(#{2,3}\s|>|\d+\.\s|-\s|!\[)/.test(lines[index]!)) { paragraph.push(lines[index]!.trim()); index += 1; }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

export type GuideLinks = { open: (id: string) => void; href: (id: string) => string };

export function renderInline(text: string, links: GuideLinks): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(guide:([a-z0-9-]+)\)|\*([^*\s][^*]*)\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = parts.length;
    if (match[1] !== undefined) parts.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<span key={key} className="guide-ui-label">{match[2]}</span>);
    else if (match[5] !== undefined) parts.push(<em key={key}>{match[5]}</em>);
    else {
      const id = match[4]!;
      parts.push(<a key={key} href={links.href(id)} onClick={(event) => { event.preventDefault(); links.open(id); }}>{match[3]}</a>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function GuideMarkdown({ source, links }: { source: string; links: GuideLinks }) {
  const inline = (text: string) => renderInline(text, links);
  return <>{parseBlocks(source).map((block, index) => {
    if (block.kind === "heading") return block.level === 2 ? <h2 key={index}>{inline(block.text)}</h2> : <h3 key={index}>{inline(block.text)}</h3>;
    if (block.kind === "paragraph") return <p key={index}>{inline(block.text)}</p>;
    if (block.kind === "list") {
      const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item.text)}{item.children.length > 0 && <ul>{item.children.map((child, childIndex) => <li key={childIndex}>{inline(child)}</li>)}</ul>}</li>);
      return block.ordered ? <ol key={index} start={block.start === 1 ? undefined : block.start}>{items}</ol> : <ul key={index}>{items}</ul>;
    }
    if (block.kind === "note") return <aside key={index} className={`guide-note${block.warning ? " guide-note-warning" : ""}`}>{block.lines.map((line, lineIndex) => <p key={lineIndex}>{inline(line)}</p>)}</aside>;
    const src = `/guides/${block.src}`;
    return <figure key={index} className="guide-figure"><a href={src} target="_blank" rel="noreferrer" title="Mở ảnh kích thước đầy đủ"><img src={src} alt={block.alt} loading="lazy" /></a>{block.alt && <figcaption>{block.alt}</figcaption>}</figure>;
  })}</>;
}
