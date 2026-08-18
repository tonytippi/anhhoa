import { NavLink } from 'react-router-dom';
import { navigation } from '../app/routes';
import { Brand } from './brand';

export function Sidebar({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }): React.JSX.Element {
  return <aside className={`sidebar${compact ? ' sidebar-compact' : ''}`} aria-label="Điều hướng quản trị">
    <Brand />
    <nav>{navigation.map((item) => <NavLink end={item.to === '/'} key={item.to} to={item.to} onClick={onNavigate} aria-label={item.label} title={compact ? item.label : undefined}><span aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span></NavLink>)}</nav>
    <button className="account" type="button"><span aria-hidden="true" className="avatar">A</span><span className="nav-label">Admin</span></button>
  </aside>;
}
