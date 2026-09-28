import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context'
import { customerNavigation, navigation } from '../../lib/navigation'
import { BrandLogo } from '../ui/BrandLogo'

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  onToggle?: () => void
}) {
  const location = useLocation()
  const { user } = useAuth()
  if (!user) return null
  const isCustomer = user.role === 'user'
  const items = isCustomer
    ? customerNavigation
    : [
        'dashboard',
        'pos',
        'jobs',
        'pc-building',
        'inventory',
        'sales',
        'expenses',
        'reports',
        'settings',
      ].map((id) => navigation.find((item) => item.id === id)!)
  const homePath = isCustomer ? '/customer' : '/dashboard'
  return (
    <>
      <div className={`sidebar-content ${isCustomer ? 'customer-sidebar-content' : ''}`}>
        <NavLink
          to={homePath}
          className="brand-lockup"
          onClick={onNavigate}
          aria-label="JBC RigWorks home"
        >
          <BrandLogo variant={collapsed ? 'mark' : 'primary'} />
        </NavLink>
        <div className="workspace-role">
          {isCustomer ? 'PC & Laptop Care Done Right.' : 'Workshop workspace'}
        </div>
        {isCustomer && <div className="sidebar-label">Explore your workspace</div>}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map(({ id, label, icon: Icon }) => (
            <Fragment key={id}>
              {!isCustomer && ['dashboard', 'sales', 'settings'].includes(id) && (
                <div className="sidebar-label">
                  {id === 'dashboard' ? 'Workshop' : id === 'sales' ? 'Business' : 'Workspace'}
                </div>
              )}
              <NavLink
                end
                key={id}
                to={'/' + id}
                onClick={onNavigate}
                aria-label={label}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  'nav-item ' +
                  (isActive ||
                  (id === 'customer/services' && location.pathname === '/customer/book')
                    ? 'is-active'
                    : '')
                }
              >
                {isCustomer ? (
                  <span className="customer-nav-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                ) : (
                  <Icon size={19} aria-hidden="true" />
                )}
                <span>{label}</span>
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        {!isCustomer && !collapsed && (
          <div className="admin-sidebar-note">
            <span>JBC RIGWORKS</span>
            <p>
              PC & Laptop Care
              <br />
              Done Right.
            </p>
          </div>
        )}
        {onToggle && (
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
            {!collapsed && <span>{isCustomer ? 'Collapse sidebar' : 'Collapse menu'}</span>}
          </button>
        )}
      </div>
    </>
  )
}
