import { useLocation } from 'react-router-dom';
import { apiUrl } from '../../app/api/client';

export function LoginPage(): React.JSX.Element {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const denied = search.get('reason') === 'denied';
  const message = denied ? 'Email này không có quyền truy cập Ánh Hoa Admin.' : 'Vui lòng đăng nhập để tiếp tục.';
  const redirect = encodeURIComponent(window.location.origin);

  return <main className="login-page"><section className="login-card" aria-describedby="login-message">
    <h1>Đăng nhập Google</h1>
    <p id="login-message" role="status" aria-live="polite">{message}</p>
    <a className="login-action" href={`${apiUrl('/auth/google')}?redirect=${redirect}`}>Tiếp tục với Google</a>
  </section></main>;
}
