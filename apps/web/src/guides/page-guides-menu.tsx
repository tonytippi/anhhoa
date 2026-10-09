import { Menu } from "@base-ui/react/menu";
import type { GuideArticle } from "./guides";

// Nút "Hướng dẫn" ở đầu trang: liệt kê các bài liên quan tới trang đang mở để người dùng tới thẳng bài cần đọc.
export function PageGuidesMenu({ articles, open }: { articles: GuideArticle[]; open: (guideId?: string) => void }) {
  if (!articles.length) return null;
  return <Menu.Root modal={false}>
    <Menu.Trigger type="button" className="page-guides-trigger" aria-label="Hướng dẫn cho trang này">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.85.85c0 1.65-2.45 2.1-2.45 3.6M12 17h.01" /></svg>
      Hướng dẫn
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner side="bottom" align="end" sideOffset={6} positionMethod="fixed" collisionPadding={8} className="finance-anchored-action-menu-positioner">
        <Menu.Popup className="finance-anchored-action-menu page-guides-menu">
          <Menu.Group>
            <Menu.GroupLabel className="page-guides-menu-title">Hướng dẫn cho trang này</Menu.GroupLabel>
            {articles.map((article) => <Menu.Item key={article.id} className="finance-anchored-action-menu-item" onClick={() => open(article.id)}>{article.title}</Menu.Item>)}
          </Menu.Group>
          <Menu.Separator className="page-guides-menu-separator" />
          <Menu.Item className="finance-anchored-action-menu-item" onClick={() => open()}>Tất cả bài hướng dẫn</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}
