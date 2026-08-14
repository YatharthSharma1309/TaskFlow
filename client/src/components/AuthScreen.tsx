import { useState, type FormEvent } from 'react';
import { login, register } from '../api';
import type { AuthUser } from '../types';
import SiteFooter from './SiteFooter';
import { LogoMark } from './Icons';

type Mode = 'login' | 'register';

type Props = {
  onAuthed: (user: AuthUser) => void;
};

export default function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isRegister = mode === 'register';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const user = isRegister ? await register(email, password) : await login(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setSaving(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="/" aria-label="TaskFlow home">
            <LogoMark size={28} />
            <span className="brand-name">TaskFlow</span>
          </a>
        </div>
      </header>

      <main className="auth-main">
        <form className="auth-card" onSubmit={(event) => void handleSubmit(event)}>
          <h1>{isRegister ? 'Create an account' : 'Sign in'}</h1>
          <p className="auth-lead">
            {isRegister
              ? 'You get your own board with Ready, In Progress, and Done.'
              : 'Open your launch board. Reviewers can use the demo account below.'}
          </p>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <label className="field" htmlFor="auth-email">
            Email
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="field" htmlFor="auth-password">
            Password
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary auth-submit" disabled={saving}>
            {saving ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          {isRegister ? null : (
            <p className="auth-demo">
              Demo: <code>demo@taskflow.app</code> / <code>demo1234</code>
            </p>
          )}

          <p className="auth-switch">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('register')}>
                  Create an account
                </button>
              </>
            )}
          </p>
        </form>
      </main>

      <SiteFooter />
    </div>
  );
}
