import { useState } from 'react'
import './Login.css'
import { supabase } from '../lib/supabaseClient'

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

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="7" r="4.5" />
      <path d="M3 21c0-4.4 4-7 9-7s9 2.6 9 7z" />
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

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'error' | 'success', text: '...' }

  const isLogin = mode === 'login'

  function switchMode() {
    setMode(isLogin ? 'signup' : 'login')
    setMessage(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        // Supabase doesn't error on an email that's already registered; it returns no identities
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('An account with this email already exists. Try signing in.')
        }
        if (!data.session) {
          setMessage({ type: 'success', text: 'Account created! Check your email to confirm it.' })
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setMessage({ type: 'error', text: 'Type your email above first, then click Forgot password.' })
      return
    }
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password reset email sent. Check your inbox.' })
    }
    setLoading(false)
  }

  return (
    <div className="kl-login">
      <div className="kl-card">
        <div className="kl-brand">
          <div className="kl-logo"><Logo /></div>
          <h1 className="kl-name">Keylusion</h1>
        </div>
        <p className="kl-tagline">Play beyond the keys.</p>

        <h2 className="kl-headline">
          {isLogin ? 'Welcome back.' : 'Create your account.'}
        </h2>
        <p className="kl-sub">
          {isLogin
            ? 'Sign in to play, record, and get AI suggestions.'
            : 'Sign up to start playing beyond the keys.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="kl-label" htmlFor="email">Your email</label>
          <div className="kl-field">
            <span className="kl-field-icon"><UserIcon /></span>
            <input
              id="email"
              className="kl-input"
              type="email"
              placeholder="e.g. you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="kl-label" htmlFor="password">Your password</label>
          <div className="kl-field">
            <span className="kl-field-icon"><LockIcon /></span>
            <input
              id="password"
              className="kl-input"
              type="password"
              placeholder="e.g. ilovepiano123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button className="kl-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <div className="kl-links">
            <button type="button" className="kl-link" onClick={switchMode}>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </button>
            {isLogin && (
              <button type="button" className="kl-link" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            )}
          </div>

          {message && (
            <div className={`kl-message ${message.type}`}>{message.text}</div>
          )}
        </form>
      </div>
    </div>
  )
}