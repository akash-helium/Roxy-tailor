import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ScanLine, Shirt, Users } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_NAME } from '../lib/app-config';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useHardwareScannerBus } from '../contexts/HardwareScannerContext';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { DesktopScanBridge } from '../components/DesktopScanBridge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Scan & Dashboard', to: '/', end: true, icon: ScanLine },
  { name: 'Cloths', to: '/orders', icon: Shirt },
  { name: 'Staff', to: '/staff', icon: Users },
];

export function DesktopLayout() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { enabled: scannerReady } = useHardwareScannerBus();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f4f6fb]">
      <DesktopScanBridge />
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} className="h-10 w-10 rounded-xl border border-slate-100" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{APP_NAME}</p>
              <p className="text-xs text-slate-500">Desktop</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {scannerReady && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold text-emerald-900">Barcode connected</p>
          </div>
        )}

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <AppErrorBoundary>
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </AppErrorBoundary>
      </main>
    </div>
  );
}
