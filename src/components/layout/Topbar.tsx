import { ChevronDown, Clock3, LogOut, Menu, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useStoredValue } from '../../lib/preferences'
export function Topbar({
  title,
  onMenu,
  menuOpen,
}: {
  title: string
  onMenu: () => void
  menuOpen: boolean
}) {
  const { user, signOut } = useAuth()
  const customer = user?.role === 'user'
  const { busy, error, run } = useAsyncAction()
  const [account] = useStoredValue(accountKey(user?.id ?? ''), defaultAccount)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (customer) return
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [customer])
  const date = now.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <>
      <header className="topbar">
        <div className="topbar-context">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={onMenu}
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title-block">
            <span>{customer ? 'JBC RIGWORKS · CUSTOMER PORTAL' : 'WORKSHOP WORKSPACE'}</span>
            <strong>{title}</strong>
          </div>
        </div>
        <div className="topbar-actions">
          {!customer && (
            <time
              className="workspace-clock"
              dateTime={now.toISOString()}
              aria-label={date + ', ' + time + ', Philippine time'}
            >
              <Clock3 size={17} aria-hidden="true" />
              <span>
                <small>PHILIPPINE TIME</small>
                <strong>{time}</strong>
                <em>{date}</em>
              </span>
            </time>
          )}
          {customer ? (
            <details
              className="customer-account-menu"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.removeAttribute('open')
                  event.currentTarget.querySelector('summary')?.focus()
                }
              }}
            >
              <summary className="topbar-account" aria-label="Account menu">
                <span className="topbar-avatar">
                  {account.photo ? <img src={account.photo} alt="" /> : <UserRound size={18} />}
                </span>
                <span className="topbar-account-meta">
                  <strong>{account.name || user?.name || 'Account'}</strong>
                  <small>My account</small>
                </span>
                <ChevronDown size={16} />
              </summary>
              <div
                className="account-menu-panel"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('a'))
                    event.currentTarget.closest('details')?.removeAttribute('open')
                }}
              >
                <Link to="/customer/settings">Profile & contact</Link>
                <Link to="/customer/settings?section=display">Display & account access</Link>
                <button disabled={busy} onClick={() => void run(signOut)}>
                  <LogOut size={17} />
                  {busy ? 'Signing out?' : 'Sign out'}
                </button>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
              </div>
            </details>
          ) : (
            <>
              {' '}
              <Link
                to="/settings"
                className="topbar-account"
                title="Account and settings"
                aria-label="Account and settings"
              >
                <span className="topbar-avatar">
                  {account.photo ? <img src={account.photo} alt="" /> : <UserRound size={18} />}
                </span>
                <span className="topbar-account-meta">
                  <strong>{account.name || user?.name || 'Account'}</strong>
                  <small>{user?.role === 'admin' ? 'Workshop admin' : 'User account'}</small>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="topbar-signout secondary-button"
                disabled={busy}
                onClick={() => void run(signOut)}
                aria-label="Sign out"
              >
                <LogOut size={17} />
                <span>{busy ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </>
          )}
        </div>
      </header>
      {!customer && error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  )
}
