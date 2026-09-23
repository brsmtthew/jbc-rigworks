import { useEffect, useState } from 'react'
import { Clock3, Menu, UserRound, LogOut } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { SettingsPage } from '../../features/settings/SettingsPage'
import { useAuth } from '../../lib/auth-context'
export function Topbar({ title, onMenu, menuOpen }: { title: string; onMenu: () => void; menuOpen: boolean }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const { signOut } = useAuth()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  const date = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
  return <><header className="topbar"><div className="topbar-context"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={onMenu}><Menu size={22} /></button><strong>{title}</strong></div><div className="navbar-tools"><time className="workspace-clock" dateTime={now.toISOString()} aria-label={date + ', ' + time + ', Philippine time'}><Clock3 size={18} aria-hidden="true" /><span><strong>{time}</strong><small>{date} / Manila</small></span></time><button className="icon-button" title="Account and settings" aria-label="Account and settings" onClick={() => setAccountOpen(true)}><UserRound size={22} /></button></div></header>{accountOpen && <Dialog title="Account & settings" wide onClose={() => setAccountOpen(false)}><SettingsPage embedded /><div className="dialog-actions"><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={20} /></button></div></Dialog>}</>
}
