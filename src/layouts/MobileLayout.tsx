import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_NAME } from '../lib/app-config';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { usePlatformSafeArea } from '../hooks/usePlatformSafeArea';
import { DesktopScanBridge } from '../components/DesktopScanBridge';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { shopNavItemIsActive, shopNavItems } from '../lib/shop-nav';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  usePlatformSafeArea();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-white">
      <DesktopScanBridge />
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-seam bg-white/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, var(--app-safe-top, env(safe-area-inset-top, 0px)))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo size={36} className="h-9 w-9 rounded-[10px] border border-seam" />
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-semibold text-ink">{APP_NAME}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Shop
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold text-ink-muted transition hover:bg-overdue/10 hover:text-overdue active:scale-[0.97]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Out
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-linen">
        <AppErrorBoundary>
          <Outlet />
        </AppErrorBoundary>
      </main>

      <nav
        className="z-50 shrink-0 border-t border-seam bg-paper/95 px-1 pt-1.5 backdrop-blur-md"
        aria-label="Shop"
        style={{
          paddingBottom: 'max(10px, var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
          {shopNavItems.map((item) => {
            const active = shopNavItemIsActive(location.pathname, item.to);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className={cn(
                  'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors',
                  active ? 'bg-tab text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{item.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
