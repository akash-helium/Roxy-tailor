import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ScanLine, Shirt, Users } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_NAME } from '../lib/app-config';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { usePlatformSafeArea } from '../hooks/usePlatformSafeArea';
import { DesktopScanBridge } from '../components/DesktopScanBridge';
import { AppErrorBoundary } from '../components/AppErrorBoundary';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  usePlatformSafeArea();

  const navItems = [
    { name: 'Scan', to: '/', icon: ScanLine },
    { name: 'Cloths', to: '/orders', icon: Shirt },
    { name: 'Staff', to: '/staff', icon: Users },
  ];

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-[#f4f6fb]">
      <DesktopScanBridge />
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-slate-200/80 bg-white/90 px-5 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, var(--app-safe-top, env(safe-area-inset-top, 0px)))' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size={36} className="h-9 w-9 rounded-xl border border-slate-100" />
            <div>
              <p className="text-sm font-bold text-slate-900">{APP_NAME}</p>
              <p className="text-[10px] font-medium text-slate-400">Manager Dashboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <AppErrorBoundary>
          <Outlet />
        </AppErrorBoundary>
      </main>

      <nav
        className="z-50 shrink-0 border-t border-slate-200/80 bg-white/95 px-2 pt-2 backdrop-blur-md"
        style={{
          paddingBottom: 'max(12px, var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-w-[72px] flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold transition-all',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600',
                )
              }
            >
              <item.icon
                className={cn(
                  'h-5 w-5',
                  location.pathname === item.to && 'text-indigo-600',
                )}
              />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
