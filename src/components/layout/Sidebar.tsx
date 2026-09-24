import { NavLink, useLocation } from 'react-router-dom'
import { customerNavigation, navigation } from '../../lib/navigation'
import { BrandLogo } from '../ui/BrandLogo'
import { useAuth } from '../../lib/auth-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Sidebar({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const location = useLocation()
  const { user } = useAuth()
  if (!user) return null
  const isCustomer = user.role === 'customer'
  const items = isCustomer ? customerNavigation : navigation
  const homePath = isCustomer ? '/customer' : '/dashboard'
  return <>
    <div className="sidebar-content">
      <NavLink to={homePath} className="brand-lockup" onClick={onNavigate} aria-label="JBC RigWorks home">
        <BrandLogo variant={collapsed ? 'mark' : 'primary'} />
      </NavLink>
      <div className="workspace-role">{isCustomer ? 'Customer portal' : 'Workshop workspace'}</div>
      <div className="sidebar-label">{isCustomer ? 'My account' : 'Workspace'}</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{items.map(({ id, label, icon: Icon }) => (
        <NavLink end key={id} to={'/' + id} onClick={onNavigate} aria-label={label} title={collapsed ? label : undefined} className={({ isActive }) => 'nav-item ' + (isActive || (id === 'customer/services' && location.pathname === '/customer/book') ? 'is-active' : '')}>
          <Icon size={19} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      ))}</nav>
      <div className="sidebar-spacer" />
      {onToggle && <button type="button" className="sidebar-collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}</button>}
     </div>
  </>
}
