import { useLocation } from 'react-router-dom';
import { apiUrl } from '../../app/api/client';

export function LoginPage({ sessionExpired = false }: { sessionExpired?: boolean }): React.JSX.Element {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const reason = search.get('reason');
  const message = reason === 'denied'
    ? 'Email này không có quyền truy cập Ánh Hoa Admin.'
    : sessionExpired || reason === 'session_expired'
      ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
      : reason === 'oauth_state_invalid'
        ? 'Phiên xác thực Google đã hết hạn hoặc không hợp lệ. Vui lòng thử đăng nhập lại.'
        : 'Vui lòng đăng nhập để tiếp tục.';
  const redirect = encodeURIComponent(window.location.origin);

  return <main className="login-page"><section className="login-card" aria-describedby="login-message">
    <h1>Đăng nhập Google</h1>
    <p id="login-message" role="status" aria-live="polite">{message}</p>
    <a className="login-action" href={`${apiUrl('/auth/google')}?redirect=${redirect}`}>Tiếp tục với Google</a>
  </section></main>;
}
