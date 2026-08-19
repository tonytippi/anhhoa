import { NavLink } from 'react-router-dom';
import { navigation } from '../app/routes';
import { Brand } from './brand';
import type { Admin } from '../app/api/auth';
import { useState } from 'react';

export function Sidebar({ admin, compact = false, onNavigate }: { admin: Admin; compact?: boolean; onNavigate?: () => void }): React.JSX.Element {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string>();
  const displayName = admin.displayName.trim() || 'Quản trị viên';
  const initial = displayName.charAt(0).toUpperCase();
  return <aside className={`sidebar${compact ? ' sidebar-compact' : ''}`} aria-label="Điều hướng quản trị">
    <Brand />
    <nav>{navigation.map((item) => <NavLink end={item.to === '/'} key={item.to} to={item.to} onClick={onNavigate} aria-label={item.label} title={compact ? item.label : undefined}><span aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span></NavLink>)}</nav>
    <div className="account"><span className="avatar">{admin.avatarUrl && failedAvatarUrl !== admin.avatarUrl ? <img src={admin.avatarUrl} alt={`Ảnh đại diện của ${displayName}`} referrerPolicy="no-referrer" onError={() => setFailedAvatarUrl(admin.avatarUrl ?? undefined)} /> : <span aria-label={`Ảnh đại diện mặc định của ${displayName}`}>{initial}</span>}</span><span className="nav-label">{displayName}</span></div>
  </aside>;
}
