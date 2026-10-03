import { sendPasswordResetEmail } from 'firebase/auth'
import { Save, Settings2, ShieldCheck, Upload, UserRound } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useBeforeUnload, useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { useConfirmation } from '../../components/ui/confirmation-context'
import { Dialog } from '../../components/ui/Dialog'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useAuth } from '../../lib/auth-context'
import { firebaseAuth } from '../../lib/firebase'
import {
  accountKey,
  defaultAccount,
  useStoredValue,
  type AccountSettings,
} from '../../lib/preferences'

export function CustomerSettings() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT"
        title="Profile & settings"
        description="Your contact details, preferences, and account access."
      />
      <AccountSettingsModal onClose={() => navigate('/customer')} />
    </>
  )
}

export function AccountSettingsModal({
  onClose,
  accountType = 'customer',
}: {
  onClose: () => void
  accountType?: 'customer' | 'admin'
}) {
  const { user, updateProfile, signOut } = useAuth()
  const { confirm } = useConfirmation()
  const [account, saveAccount, status] = useStoredValue(accountKey(user!.id), defaultAccount)
  const [changes, setChanges] = useState<Partial<AccountSettings>>({})
  const base = {
    ...account,
    name: account.name || user!.name,
    contactEmail: account.contactEmail || user!.email,
  }
  const profile = { ...base, ...changes }
  const dirty = Object.entries(changes).some(
    ([key, value]) => base[key as keyof AccountSettings] !== value,
  )
  const [params, setParams] = useSearchParams()
  const [adminDisplay, setAdminDisplay] = useState(false)
  const display = accountType === 'admin' ? adminDisplay : params.get('section') === 'display'
  const [message, setMessage] = useState('')
  const { busy, error, setError, run } = useAsyncAction()
  const [photoLoading, setPhotoLoading] = useState(false)
  const photoSequence = useRef(0)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy || photoLoading) && currentLocation.pathname !== nextLocation.pathname,
  )
  useBeforeUnload((event) => {
    if (dirty || busy || photoLoading) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
  function change(values: Partial<AccountSettings>) {
    setChanges((current) => ({ ...current, ...values }))
    setMessage('')
  }
  function chooseSection(nextDisplay: boolean) {
    if (accountType === 'admin') setAdminDisplay(nextDisplay)
    else setParams(nextDisplay ? { section: 'display' } : {})
  }
  async function closeModal() {
    if (accountType === 'admin') {
      if (busy || photoLoading) return
      if (
        dirty &&
        !(await confirm({
          title: 'Discard account changes?',
          message: 'Your unsaved profile and display changes will be lost.',
          confirmLabel: 'Discard changes',
          tone: 'danger',
        }))
      )
        return
    }
    onClose()
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    void run(async () => {
      if (!profile.name.trim()) throw new Error('Enter your display name.')
      if (
        !(await confirm({
          title: 'Save account changes?',
          message: 'Update your profile and display preferences?',
          confirmLabel: 'Save changes',
        }))
      )
        return
      await updateProfile(profile.name.trim())
      await saveAccount({ ...profile, name: profile.name.trim() })
      setChanges({})
      setMessage('Your changes are saved.')
    })
  }
  function choosePhoto(file?: File) {
    const sequence = ++photoSequence.current
    setPhotoLoading(false)
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 500000) {
      setError('Choose an image of 500 KB or smaller.')
      return
    }
    setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = () => {
      if (sequence !== photoSequence.current) return
      if (typeof reader.result === 'string') change({ photo: reader.result })
      setPhotoLoading(false)
    }
    reader.onerror = () => {
      if (sequence === photoSequence.current) {
        setError('Unable to read this photo. Try another file.')
        setPhotoLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }
  return (
    <>
      <Dialog
        title={display ? 'Display & account access' : 'Your profile'}
        wide
        onClose={() => void closeModal()}
        footer={
          <div className="settings-save-bar">
            <span role="status">
              {photoLoading
                ? 'Reading photo…'
                : busy
                  ? 'Saving…'
                  : dirty
                    ? 'You have unsaved changes'
                    : 'All changes saved'}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={!dirty || busy || photoLoading}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Discard account changes?',
                    message: 'Your unsaved profile and display changes will be lost.',
                    confirmLabel: 'Discard changes',
                    tone: 'danger',
                  }))
                )
                  return
                setChanges({})
                setError('')
                setMessage('Changes discarded.')
              }}
            >
              Discard
            </button>
            <button
              className="primary-button"
              type="submit"
              form="customer-settings-form"
              disabled={!dirty || busy || photoLoading}
            >
              <Save size={17} /> Save changes
            </button>
          </div>
        }
      >
        {status.loading && !status.error ? (
          <LoadingState label="Loading your settings…" />
        ) : status.error ? (
          <p className="form-error" role="alert">
            {status.error}
          </p>
        ) : (
          <div className="customer-settings-modal">
            <aside className="customer-settings-side">
              <section className="profile-card">
                <div className="profile-symbol">
                  {profile.photo ? (
                    <img src={profile.photo} alt="Your profile photo" />
                  ) : (
                    <UserRound size={32} />
                  )}
                </div>
                <div>
                  <span className="customer-profile-kicker">
                    {accountType === 'admin' ? 'ADMIN ACCOUNT' : 'CUSTOMER ACCOUNT'}
                  </span>
                  <h2>{profile.name}</h2>
                  <p>{user?.email}</p>
                </div>
              </section>
              <nav className="customer-settings-nav" aria-label="Account section">
                <button type="button" aria-pressed={!display} onClick={() => chooseSection(false)}>
                  <UserRound size={18} />
                  <span>Profile & contact</span>
                </button>
                <button
                  type="button"
                  aria-pressed={display}
                  onClick={() => chooseSection(true)}
                >
                  <Settings2 size={18} />
                  <span>Display & access</span>
                </button>
              </nav>
              <p className="customer-settings-side-note">
                {accountType === 'admin'
                  ? 'Your account details identify you across the workshop workspace.'
                  : 'Your contact details help JBC reach you about appointments and orders.'}
              </p>
            </aside>
            <div className="customer-settings-main" key={display ? 'display' : 'profile'}>
              <div className="customer-settings-intro">
                <span className="eyebrow">{display ? 'PREFERENCES' : 'PERSONAL DETAILS'}</span>
                <h3>{display ? 'Make this space yours.' : 'Keep your details current.'}</h3>
                <p>
                  {display
                    ? 'Choose how your workspace feels and manage account access.'
                    : accountType === 'admin'
                      ? 'Keep your workshop account details current.'
                      : 'This information helps us contact you about services and orders.'}
                </p>
              </div>
              <form
                id="customer-settings-form"
                className="portal-form settings-fields customer-settings-form"
                onSubmit={submit}
                aria-busy={busy}
              >
                <fieldset className="record-fields settings-fields" disabled={busy || photoLoading}>
                  {!display ? (
                    <>
                      <div className="profile-photo-field">
                        <strong>Profile photo</strong>
                        <label className="photo-upload">
                          <Upload size={20} />
                          <span>
                            {photoLoading
                              ? 'Reading photo…'
                              : profile.photo
                                ? 'Replace photo'
                                : 'Upload photo'}
                            <small>JPG, PNG, or WebP · up to 500 KB</small>
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-label="Upload or replace profile photo"
                            onChange={(e) => choosePhoto(e.target.files?.[0])}
                          />
                        </label>
                        {profile.photo && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={async () => {
                              if (
                                !(await confirm({
                                  title: 'Remove profile photo?',
                                  message: 'Remove the photo from your pending profile changes?',
                                  confirmLabel: 'Remove photo',
                                  tone: 'danger',
                                }))
                              )
                                return
                              ++photoSequence.current
                              change({ photo: '' })
                            }}
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                      <label>
                        Display name
                        <input
                          name="name"
                          autoComplete="name"
                          required
                          maxLength={80}
                          value={profile.name}
                          onChange={(e) => change({ name: e.target.value })}
                        />
                      </label>
                      <div className="readonly-account">
                        <ShieldCheck size={20} />
                        <div>
                          <strong>Sign-in email</strong>
                          <p>{user?.email}</p>
                          <small>
                            This is your account identifier. Use contact email below for an
                            alternative contact address.
                          </small>
                        </div>
                      </div>
                      <div className="portal-form-grid">
                        <label>
                          Contact email
                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            maxLength={254}
                            value={profile.contactEmail}
                            onChange={(e) => change({ contactEmail: e.target.value })}
                          />
                        </label>
                        <label>
                          Phone number
                          <input
                            name="tel"
                            type="tel"
                            autoComplete="tel"
                            maxLength={30}
                            value={profile.phone}
                            onChange={(e) => change({ phone: e.target.value })}
                          />
                        </label>
                      </div>
                      <label>
                        Address
                        <textarea
                          name="street-address"
                          autoComplete="street-address"
                          rows={3}
                          maxLength={400}
                          value={profile.address}
                          onChange={(e) => change({ address: e.target.value })}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="preference-row">
                        <span>
                          <strong>Compact display</strong>
                          <small>Fit more rows and cards into your workspace.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={profile.compact}
                          onChange={(e) => change({ compact: e.target.checked })}
                        />
                      </label>
                      <label className="preference-row">
                        <span>
                          <strong>Reduce motion</strong>
                          <small>
                            Limit nonessential animation. You can still rotate and zoom your PC
                            model.
                          </small>
                        </span>
                        <input
                          type="checkbox"
                          checked={profile.reduceMotion}
                          onChange={(e) => change({ reduceMotion: e.target.checked })}
                        />
                      </label>
                      <label className="preference-row">
                        <span>
                          <strong>Larger text</strong>
                          <small>Increase text size in navigation, forms, cards, and tables.</small>
                        </span>
                        <input type="checkbox" checked={profile.largeText} onChange={(e) => change({ largeText: e.target.checked })} />
                      </label>
                      <label className="preference-row">
                        <span>
                          <strong>Higher contrast</strong>
                          <small>Strengthen text, borders, and keyboard focus indicators.</small>
                        </span>
                        <input type="checkbox" checked={profile.highContrast} onChange={(e) => change({ highContrast: e.target.checked })} />
                      </label>
                      <section className="account-security">
                        <h3>Account access</h3>
                        <p>Signed in as {user?.email} · {user?.emailVerified ? 'Email verified' : 'Email not verified'}</p>
                        <p>Password reset links are sent to your sign-in email.</p>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            void run(async () => {
                              if (
                                !(await confirm({
                                  title: 'Send a password reset link?',
                                  message: `Send a password reset email to ${user!.email}?`,
                                  confirmLabel: 'Send reset link',
                                }))
                              )
                                return
                              await sendPasswordResetEmail(firebaseAuth, user!.email)
                              setMessage(
                                'Reset request accepted. Check your sign-in email for the reset link.',
                              )
                            })
                          }
                        >
                          Send password reset link
                        </button>
                        <button type="button" className="secondary-button" onClick={() => void run(async () => { await signOut() })}>
                          Sign out of this account
                        </button>
                      </section>
                    </>
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
              </form>
            </div>
          </div>
        )}
      </Dialog>
      {blocker.state === 'blocked' && (
        <Dialog
          title={busy || photoLoading ? 'Please wait' : 'Leave without saving?'}
          onClose={() => blocker.reset()}
          footer={
            <>
              <button className="secondary-button" onClick={() => blocker.reset()}>
                Stay here
              </button>
              <button
                className="primary-button"
                disabled={busy || photoLoading}
                onClick={() => blocker.proceed()}
              >
                Discard and leave
              </button>
            </>
          }
        >
          <p>
            {busy || photoLoading
              ? 'Wait for the current action to finish before leaving.'
              : 'Your unsaved profile and display changes will be lost.'}
          </p>
        </Dialog>
      )}
    </>
  )
}
