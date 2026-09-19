import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, UserRound } from 'lucide-react';
import { BrandLogo } from '@app/components/BrandLogo';
import { APP_NAME } from '@app/lib/app-config';
import { useAuth } from '@app/contexts/AuthContext';
import { DEFAULT_LOGIN_ID, DEFAULT_PASSWORD, formatLoginError } from '@app/lib/auth-config';

export function AdminLoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [loginId, setLoginId] = useState(DEFAULT_LOGIN_ID);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await signIn(loginId, password);
      if (result.error) {
        setError(formatLoginError(result.error));
        return;
      }
      navigate(from, { replace: true });
    } catch {
      setError('Could not sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo size={128} className="mx-auto mb-4 h-32 w-32 rounded-2xl" />
          <h1 className="text-2xl font-bold tracking-tight text-white">{APP_NAME} Admin</h1>
          <p className="mt-2 text-sm text-slate-400">Web console for customers, staff & payments</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">User ID</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="username"
                  data-allow-typing
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-white outline-none ring-indigo-500 focus:ring-2"
                  placeholder="admin"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">Password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  data-allow-typing
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-white outline-none ring-indigo-500 focus:ring-2"
                  placeholder="Enter password"
                  required
                />
              </div>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-4 font-semibold text-white shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign In to Admin'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Default: {DEFAULT_LOGIN_ID} / {DEFAULT_PASSWORD}
          </p>
        </form>
      </div>
    </div>
  );
}
