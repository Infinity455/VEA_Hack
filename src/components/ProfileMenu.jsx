import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ProfileMenu.css'

function formatDate(value) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const menuRef = useRef(null)

  // Close the dropdown when clicking outside it or pressing Escape
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function handleLogout() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, App.jsx notices the signed-out session and shows the login page.
  }

  const initial = (user.email || '?').charAt(0).toUpperCase()

  return (
    <div className="kl-menu" ref={menuRef}>
      <button
        className="kl-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open profile menu"
        aria-expanded={open}
        title="Profile"
      >
        {initial}
      </button>

      {open && (
        <div className="kl-menu-panel">
          <h3 className="kl-menu-title">Profile &amp; settings</h3>
          <p className="kl-menu-sub">Your Keylusion account</p>

          <ul className="kl-menu-list">
            <li className="kl-menu-row">
              <span>Email</span>
              <span>{user.email}</span>
            </li>
            <li className="kl-menu-row">
              <span>Member since</span>
              <span>{formatDate(user.created_at)}</span>
            </li>
            <li className="kl-menu-row">
              <span>Last sign in</span>
              <span>{formatDate(user.last_sign_in_at)}</span>
            </li>
            <li className="kl-menu-row">
              <span>Sign-in method</span>
              <span>{user.app_metadata?.provider || 'email'}</span>
            </li>
          </ul>

          <button className="kl-menu-logout" onClick={handleLogout} disabled={loading}>
            {loading ? 'Please wait...' : 'Log out'}
          </button>

          {error && <div className="kl-menu-error">{error}</div>}
        </div>
      )}
    </div>
  )
}