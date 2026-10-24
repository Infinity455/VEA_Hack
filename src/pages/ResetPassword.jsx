import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Login.css'

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <g stroke="#e6faff" strokeWidth="2.4" strokeLinecap="round">
        <line x1="4" y1="14" x2="4" y2="20" />
        <line x1="9" y1="10" x2="9" y2="24" />
        <line x1="14" y1="6" x2="14" y2="28" />
        <line x1="19" y1="3" x2="19" y2="31" />
        <line x1="24" y1="8" x2="24" y2="26" />
        <line x1="29" y1="12" x2="29" y2="22" />
      </g>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z" />
    </svg>
  )
}

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Password updated! Taking you in...' })
    setTimeout(onDone, 1200)
  }

  return (
    <div className="kl-login">
      <div className="kl-card">
        <div className="kl-brand">
          <div className="kl-logo"><Logo /></div>
          <h1 className="kl-name">Keylusion</h1>
        </div>
        <p className="kl-tagline">Play beyond the keys.</p>

        <h2 className="kl-headline">Set a new password.</h2>
        <p className="kl-sub">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit}>
          <label className="kl-label" htmlFor="new-password">New password</label>
          <div className="kl-field">
            <span className="kl-field-icon"><LockIcon /></span>
            <input
              id="new-password"
              className="kl-input"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <label className="kl-label" htmlFor="confirm-password">Confirm new password</label>
          <div className="kl-field">
            <span className="kl-field-icon"><LockIcon /></span>
            <input
              id="confirm-password"
              className="kl-input"
              type="password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button className="kl-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Update password'}
          </button>

          {message && (
            <div className={`kl-message ${message.type}`}>{message.text}</div>
          )}
        </form>
      </div>
    </div>
  )
}