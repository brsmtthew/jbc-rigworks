import { sendPasswordResetEmail } from 'firebase/auth'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { firebaseAuth } from '../../lib/firebase'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { signIn, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [message, setMessage] = useState('')
  const { busy, error, setError, run } = useAsyncAction()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      setMessage('')
      if (recovery) {
        try {
          await sendPasswordResetEmail(firebaseAuth, email.trim())
          setMessage(
            'Request accepted. If this email has an account, check its inbox and spam folder for the reset link.',
          )
        } catch {
          throw new Error(
            'Could not request a reset email. Check your email and connection, then try again.',
          )
        }
        return
      }
      const account = isRegister
        ? await register(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password)
      navigate(account.role === 'admin' ? '/dashboard' : '/customer', { replace: true })
    })
  }
  return (
    <main className="auth-shell auth-redesign">
      <section className="auth-brand-panel">
        <Link to="/login" aria-label="JBC RigWorks home">
          <BrandLogo />
        </Link>
        <div className="auth-brand-copy">
          <span className="eyebrow">PC & Laptop Care Done Right.</span>
          <h2>
            Your PC.
            <br />
            In good hands.
          </h2>
          <p>Book a service, track your orders, and plan your next build.</p>
          <div className="auth-circuit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="auth-trust">
          <ShieldCheck size={20} />
          <span>One account for your devices, orders, and builds.</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="auth-mobile-mark">
            <BrandLogo variant="mark" decorative />
          </span>
          <span className="eyebrow">WELCOME TO JBC RIGWORKS</span>
          <h1>
            {recovery ? 'Reset your password' : isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="auth-intro">
            {recovery
              ? 'Enter your sign-in email to request a password reset link.'
              : isRegister
                ? 'Keep your service requests, orders, and build ideas together.'
                : 'Sign in to pick up where you left off.'}
          </p>
          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy} className="record-fields settings-fields">
              {isRegister && !recovery && (
                <label>
                  Full name
                  <input
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {!recovery && (
                <label>
                  Password
                  <span className="password-field">
                    <input
                      name="password"
                      type={visible ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      minLength={isRegister ? 6 : undefined}
                      required
                      aria-describedby={isRegister ? 'password-requirements' : undefined}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      aria-pressed={visible}
                      onClick={() => setVisible((value) => !value)}
                    >
                      {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </span>
                </label>
              )}
              {isRegister && (
                <p id="password-requirements" className="storage-caption">
                  Use at least 6 characters. Choose a unique password.
                </p>
              )}
              {!isRegister && !recovery && (
                <button
                  type="button"
                  className="text-button recovery-link"
                  onClick={() => {
                    setRecovery(true)
                    setError('')
                    setMessage('')
                  }}
                >
                  Forgot password?
                </button>
              )}
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="save-message" role="status">
                {message}
              </p>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy
                ? recovery
                  ? 'Requesting link…'
                  : 'Please wait…'
                : recovery
                  ? 'Send reset link'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          {recovery ? (
            <button
              className="text-button auth-switch"
              disabled={busy}
              onClick={() => {
                setRecovery(false)
                setError('')
                setMessage('')
              }}
            >
              <ArrowLeft size={17} />
              Back to sign in
            </button>
          ) : (
            <p className="auth-switch">
              {isRegister ? 'Already have an account?' : 'New to JBC RigWorks?'}{' '}
              <Link
                to={isRegister ? '/login' : '/register'}
                onClick={() => {
                  setError('')
                  setMessage('')
                }}
              >
                {isRegister ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
