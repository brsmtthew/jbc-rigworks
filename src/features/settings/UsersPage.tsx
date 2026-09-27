import { collection, onSnapshot } from 'firebase/firestore'
import { AlertCircle, LoaderCircle, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../lib/auth-context'
import { firebaseFirestore } from '../../lib/firebase'
import './users.css'

type UserProfile = {
  uid: string
  name: string
  email: string
  role: 'user' | 'admin'
  createdAt: unknown
}

const profilesRef = collection(firebaseFirestore, 'users')

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function joinedDate(value: unknown) {
  let date: Date | null = null
  if (value instanceof Date) date = value
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value)
  else if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  )
    date = value.toDate()
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
    : 'Recently joined'
}

export function UsersPage() {
  const { user } = useAuth()
  const userId = user?.id
  const admin = user?.role === 'admin'
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!userId || !admin) return
    return onSnapshot(
      profilesRef,
      (snapshot) => {
        setProfiles(
          snapshot.docs.map((profile) => {
            const data = profile.data()
            return {
              uid: profile.id,
              name:
                typeof data.name === 'string' && data.name.trim()
                  ? data.name.trim()
                  : 'Unnamed account',
              email: typeof data.email === 'string' ? data.email : '',
              role: data.role === 'admin' ? 'admin' : 'user',
              createdAt: data.createdAt,
            }
          }),
        )
        setError('')
        setLoading(false)
      },
      (snapshotError) => {
        setError(
          snapshotError.code === 'permission-denied'
            ? 'Account access was denied. Check your Firestore role and security rules.'
            : 'User profiles are unavailable. Check your connection and try again.',
        )
        setLoading(false)
      },
    )
  }, [userId, admin])

  const filteredProfiles = useMemo(() => {
    const sorted = [...profiles].sort((a, b) => {
      if (a.uid === userId) return -1
      if (b.uid === userId) return 1
      return a.name.localeCompare(b.name)
    })
    const term = query.trim().toLowerCase()
    return term
      ? sorted.filter((profile) => `${profile.name} ${profile.email}`.toLowerCase().includes(term))
      : sorted
  }, [profiles, query, userId])

  if (!user || user.role !== 'admin') {
    return (
      <div className="users-page">
        <PageHeader
          eyebrow="ACCOUNTS"
          title="Users"
          description="The account directory is available to administrators."
        />
        <p className="users-notice users-notice-error" role="alert">
          Admin access is required to view users.
        </p>
      </div>
    )
  }

  return (
    <div className="users-page">
      <PageHeader
        eyebrow="ACCOUNTS"
        title="Users"
        description="Registered accounts and their roles are managed in Firestore."
      />

      <div className="users-overview" aria-label="Account summary">
        <div className="users-overview-primary">
          <span className="users-overview-icon">
            <ShieldCheck size={23} />
          </span>
          <div>
            <span className="eyebrow">ADMIN ACCOUNTS</span>
            <strong>
              {loading ? '…' : profiles.filter((profile) => profile.role === 'admin').length}
            </strong>
            <p>Roles are changed in Firestore.</p>
          </div>
        </div>
        <div className="users-overview-secondary">
          <UsersRound size={22} />
          <span>
            <strong>{loading ? '…' : profiles.length}</strong>
            <small>Registered accounts</small>
          </span>
        </div>
      </div>

      {error && (
        <div className="users-notice users-notice-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="users-directory" aria-labelledby="users-directory-title">
        <div className="users-directory-heading">
          <div>
            <span className="eyebrow">ACCOUNT DIRECTORY</span>
            <h2 id="users-directory-title">Registered users</h2>
            <p>New accounts start with the user role.</p>
          </div>
          <label className="users-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search users</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
            />
          </label>
        </div>

        {loading ? (
          <div className="users-empty" role="status">
            <LoaderCircle className="users-spinner" size={24} />
            <strong>Loading accounts</strong>
            <p>Checking the latest user profiles.</p>
          </div>
        ) : error ? (
          <div className="users-empty">
            <AlertCircle size={24} />
            <strong>Accounts are unavailable</strong>
            <p>Refresh the page after access is restored.</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="users-empty">
            <UserRound size={25} />
            <strong>{query ? 'No matching users' : 'No accounts yet'}</strong>
            <p>
              {query
                ? 'Try another name or email address.'
                : 'New accounts appear after registration.'}
            </p>
          </div>
        ) : (
          <ul className="users-list">
            {filteredProfiles.map((profile) => {
              const isAdmin = profile.role === 'admin'
              return (
                <li className="users-row" key={profile.uid}>
                  <span
                    className={`users-avatar ${isAdmin ? 'users-avatar-admin' : ''}`}
                    aria-hidden="true"
                  >
                    {initials(profile.name)}
                  </span>
                  <div className="users-person">
                    <strong>
                      {profile.name}
                      {profile.uid === userId && <em>YOU</em>}
                    </strong>
                    <span>{profile.email}</span>
                    <small>Joined {joinedDate(profile.createdAt)}</small>
                  </div>
                  <span className={`users-role ${isAdmin ? 'users-role-admin' : ''}`}>
                    {isAdmin ? <ShieldCheck size={14} /> : <UserRound size={14} />}
                    {isAdmin ? 'Admin' : 'User'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
