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
    <div className="flex min-h-dvh items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo size={96} className="mx-auto mb-4 h-24 w-24 rounded-[14px] border border-seam" />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-ink-muted">Back office — customers, rates, and money.</p>
        </div>

        <form onSubmit={handleSubmit} className="ticket rounded-[14px] p-6">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                User ID
              </span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  autoComplete="username"
                  data-allow-typing
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  className="w-full rounded-[10px] border border-seam bg-white py-3 pl-11 pr-4 text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20"
                  placeholder="admin"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Password
              </span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="password"
                  autoComplete="current-password"
                  data-allow-typing
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-[10px] border border-seam bg-white py-3 pl-11 pr-4 text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20"
                  placeholder="Enter password"
                  required
                />
              </div>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-[10px] bg-overdue/10 px-3 py-2 text-sm text-overdue">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 min-h-12 w-full rounded-[10px] bg-action py-3.5 font-semibold text-white transition hover:bg-action-deep active:scale-[0.97] disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Open back office'}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            Default: {DEFAULT_LOGIN_ID} / {DEFAULT_PASSWORD}
          </p>
        </form>
      </div>
    </div>
  );
}
