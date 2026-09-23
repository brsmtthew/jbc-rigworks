import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAuth } from '../../lib/auth-context'
import type { UserRole } from '../../types/business'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('customer')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) await register(name, email, password)
      else await signIn(email, password, role)
      navigate(isRegister || role === 'customer' ? '/customer' : '/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-brand-panel">
      <Link to="/login" aria-label="JBC RigWorks home"><BrandLogo /></Link>
      <div className="auth-brand-copy"><span className="eyebrow">PC & LAPTOP CARE DONE RIGHT</span><h1>Clear service.<br />Confident decisions.</h1><p>Book a service, request a custom build, or manage your workshop in one focused workspace.</p></div>
      <div className="auth-trust"><ShieldCheck size={18} /><span>Service, repairs, and custom builds. All in one place.</span></div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-wrap">
        <span className="auth-mobile-mark"><BrandLogo variant="mark" decorative /></span>
        <span className="eyebrow">{isRegister ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span>
        <h2>{isRegister ? 'Start with your customer account' : 'Sign in to JBC RigWorks'}</h2>
        <p className="auth-intro">{isRegister ? 'Request appointments and custom PC builds from your own portal.' : 'Choose the workspace that matches your account.'}</p>
        {!isRegister && <div className="role-tabs" aria-label="Portal type">
          <button className={role === 'customer' ? 'is-selected' : ''} type="button" aria-pressed={role === 'customer'} onClick={() => setRole('customer')}><UserRound size={16} />Customer portal</button>
          <button className={role === 'admin' ? 'is-selected' : ''} type="button" aria-pressed={role === 'admin'} onClick={() => setRole('admin')}><LockKeyhole size={16} />Admin workspace</button>
        </div>}
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <label>Full name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="At least 6 characters" minLength={6} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Opening workspace…' : isRegister ? 'Create account' : 'Continue'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'Need a customer account?'} <Link to={isRegister ? '/login' : '/register'} state={{ from: location.pathname }}>{isRegister ? 'Sign in' : 'Create one'}</Link></p>
        <p className="auth-local-note">Local workspace. Account verification is not enabled yet.</p>
      </div>
    </section>
  </main>
}
