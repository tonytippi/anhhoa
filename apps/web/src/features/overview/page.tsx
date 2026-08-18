import { useLocation } from 'react-router-dom';
import { navigation } from '../../app/routes';

export function PlaceholderPage(): React.JSX.Element {
  const location = useLocation();
  const page = navigation.find((item) => item.to === location.pathname);
  if (!page) return <section className="page"><h1>Không tìm thấy trang</h1><div className="placeholder-card"><h2>Đường dẫn không hợp lệ</h2><p>Trang bạn yêu cầu không tồn tại trong Ánh Hoa Admin.</p></div></section>;
  return <section className="page"><h1>{page.label}</h1><div className="placeholder-card"><h2>Đang chuẩn bị</h2><p>Bề mặt {page.label.toLowerCase()} sẽ được hoàn thiện trong các bước tiếp theo.</p></div></section>;
}
