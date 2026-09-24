import { useEffect, useState } from 'react'
import { ChevronDown, Clock3, Menu, UserRound, LogOut } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { SettingsPage } from '../../features/settings/SettingsPage'
import { useAuth } from '../../lib/auth-context'
import { accountKey, defaultAccount, useStoredValue } from '../../lib/preferences'
export function Topbar({ title, onMenu, menuOpen }: { title: string; onMenu: () => void; menuOpen: boolean }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const { user, signOut } = useAuth()
  const [account] = useStoredValue(accountKey(user?.id ?? ''), defaultAccount)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  const date = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
  return <><header className="topbar">
    <div className="topbar-context">
      <button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={onMenu}><Menu size={21} /></button>
      <div className="topbar-title-block"><span>{user?.role === 'customer' ? 'CUSTOMER PORTAL' : 'WORKSHOP WORKSPACE'}</span><strong>{title}</strong></div>
    </div>
    <div className="topbar-actions">
      <time className="workspace-clock" dateTime={now.toISOString()} aria-label={date + ', ' + time + ', Philippine time'}>
        <Clock3 size={17} aria-hidden="true" /><span><small>PHILIPPINE TIME</small><strong>{time}</strong><em>{date}</em></span>
      </time>
      <button className="topbar-account" title="Account and settings" aria-label="Account and settings" aria-haspopup="dialog" onClick={() => setAccountOpen(true)}>
        <span className="topbar-avatar">{account.photo ? <img src={account.photo} alt="" /> : <UserRound size={18} />}</span>
        <span className="topbar-account-meta"><strong>{account.name || user?.name || 'Account'}</strong><small>{user?.role === 'admin' ? 'Workshop admin' : 'Customer account'}</small></span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className="topbar-signout secondary-button" onClick={signOut} aria-label="Sign out"><LogOut size={17}/><span>Sign out</span></button>
    </div>
  </header>{accountOpen && <Dialog title="Profile & settings" wide onClose={() => setAccountOpen(false)}><SettingsPage embedded /></Dialog>}</>
}
