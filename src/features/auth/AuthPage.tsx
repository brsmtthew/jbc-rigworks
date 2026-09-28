import { sendPasswordResetEmail } from 'firebase/auth'
import {
  ArrowLeft,
  CalendarDays,
  Cpu,
  Eye,
  EyeOff,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { firebaseAuth } from '../../lib/firebase'

type EmailState = {
  email: string
  setEmail: (value: string) => void
}

function EmailField({ email, setEmail }: EmailState) {
  return (
    <label className="auth-field">
      <span>Email address</span>
      <input
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        maxLength={254}
        placeholder="you@example.com"
        required
      />
    </label>
  )
}

function PasswordField({
  password,
  setPassword,
  register,
  onRecover,
}: {
  password: string
  setPassword: (value: string) => void
  register?: boolean
  onRecover?: () => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-field auth-password-group">
      <div className="auth-password-label">
        <label htmlFor="auth-password">Password</label>
        {onRecover && (
          <button type="button" className="auth-inline-link" onClick={onRecover}>
            Forgot password?
          </button>
        )}
      </div>
      <span className="auth-password-input">
        <input
          id="auth-password"
          name="password"
          type={visible ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={register ? 'new-password' : 'current-password'}
          minLength={register ? 6 : undefined}
          aria-describedby={register ? 'password-requirements' : undefined}
          required
        />
        <button
          type="button"
          className="auth-reveal"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </div>
  )
}

function SignInForm({ email, setEmail, onRecover }: EmailState & { onRecover: () => void }) {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAsyncAction()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      const account = await signIn(email.trim(), password)
      navigate(account.role === 'admin' ? '/dashboard' : '/customer', { replace: true })
    })
  }

  return (
    <form className="auth-form auth-sign-in-form" onSubmit={submit} aria-busy={busy}>
      <div className="auth-form-heading">
        <span className="auth-kicker">WELCOME BACK</span>
        <h1>Sign in to RigWorks.</h1>
        <p>Your services, orders, and PC builds are ready when you are.</p>
      </div>
      <fieldset className="auth-fieldset" disabled={busy}>
        <EmailField email={email} setEmail={setEmail} />
        <PasswordField password={password} setPassword={setPassword} onRecover={onRecover} />
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="auth-submit-group">
        <button className="auth-action" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-account-prompt">
          No account? <Link to="/register">Create Account</Link>.
        </p>
      </div>
    </form>
  )
}

function CreateAccountForm({ email, setEmail }: EmailState) {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAsyncAction()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      const account = await register(name.trim(), email.trim(), password)
      navigate(account.role === 'admin' ? '/dashboard' : '/customer', { replace: true })
    })
  }

  return (
    <form className="auth-form auth-create-form" onSubmit={submit} aria-busy={busy}>
      <div className="auth-form-heading">
        <span className="auth-kicker">GET STARTED</span>
        <h1>Create your account.</h1>
        <p>Keep your device care, purchases, and build ideas in one place.</p>
      </div>
      <fieldset className="auth-fieldset" disabled={busy}>
        <label className="auth-field">
          <span>Full name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            placeholder="Your full name"
            required
          />
        </label>
        <EmailField email={email} setEmail={setEmail} />
        <PasswordField password={password} setPassword={setPassword} register />
        <p id="password-requirements" className="auth-hint">
          At least 6 characters. Choose a unique password.
        </p>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="auth-action" type="submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}

function RecoveryForm({ email, setEmail, onBack }: EmailState & { onBack: () => void }) {
  const [message, setMessage] = useState('')
  const { busy, error, run } = useAsyncAction()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      setMessage('')
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
    })
  }

  return (
    <form className="auth-form auth-recovery-form" onSubmit={submit} aria-busy={busy}>
      <div className="auth-form-heading">
        <span className="auth-kicker">ACCOUNT RECOVERY</span>
        <h1>Reset your password.</h1>
        <p>Enter your sign-in email and we’ll send you a reset link.</p>
      </div>
      <fieldset className="auth-fieldset" disabled={busy}>
        <EmailField email={email} setEmail={setEmail} />
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
      <button className="auth-action" type="submit" disabled={busy}>
        {busy ? 'Requesting link…' : 'Send reset link'}
      </button>
      <button type="button" className="auth-back" onClick={onBack} disabled={busy}>
        <ArrowLeft size={17} aria-hidden="true" />
        Back to sign in
      </button>
    </form>
  )
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState('')
  const [recovery, setRecovery] = useState(false)
  const showRecovery = mode === 'login' && recovery

  return (
    <main className="auth-v3">
      <div className="auth-stage">
        <section className="auth-story" aria-label="About JBC RigWorks">
          <Link to="/login" className="auth-story-logo" aria-label="JBC RigWorks sign in">
            <BrandLogo />
          </Link>
          <div className="auth-story-content">
            <span className="auth-story-eyebrow">THE JBC RIGWORKS PORTAL</span>
            <h2>
              PC &amp; Laptop
              <br />
              Care Done Right.
            </h2>
            <p>Book a service, follow your orders, and keep your next build moving.</p>
            <div className="auth-story-links" aria-label="What you can do">
              <span>
                <CalendarDays size={17} aria-hidden="true" />
                Services
              </span>
              <span>
                <ShoppingBag size={17} aria-hidden="true" />
                Orders
              </span>
              <span>
                <Cpu size={17} aria-hidden="true" />
                PC builds
              </span>
            </div>
          </div>
          <div className="auth-story-footer">
            <ShieldCheck size={19} aria-hidden="true" />
            One account for every step with JBC.
          </div>
        </section>
        <section className="auth-access" aria-label="Account access">
          <Link to="/login" className="auth-mobile-logo" aria-label="JBC RigWorks sign in">
            <BrandLogo />
          </Link>
          <span className="auth-mobile-tagline">PC &amp; Laptop Care Done Right.</span>
          <div className="auth-access-top">
            {showRecovery ? (
              <span className="auth-access-caption">ACCOUNT RECOVERY</span>
            ) : (
              <nav className="auth-mode-tabs" aria-label="Account forms">
                <Link
                  to="/login"
                  aria-current={mode === 'login' ? 'page' : undefined}
                  onClick={() => setRecovery(false)}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  aria-current={mode === 'register' ? 'page' : undefined}
                  onClick={() => setRecovery(false)}
                >
                  Create account
                </Link>
              </nav>
            )}
          </div>
          <div className="auth-form-shell" key={showRecovery ? 'recovery' : mode}>
            {showRecovery ? (
              <RecoveryForm email={email} setEmail={setEmail} onBack={() => setRecovery(false)} />
            ) : mode === 'register' ? (
              <CreateAccountForm email={email} setEmail={setEmail} />
            ) : (
              <SignInForm email={email} setEmail={setEmail} onRecover={() => setRecovery(true)} />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
