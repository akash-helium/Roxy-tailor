import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_NAME } from '../lib/app-config';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useHardwareScannerBus } from '../contexts/HardwareScannerContext';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { DesktopScanBridge } from '../components/DesktopScanBridge';
import { shopNavItemIsActive, shopNavItems, type ShopNavItem } from '../lib/shop-nav';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navGroups: { id: ShopNavItem['group']; label: string }[] = [
  { id: 'work', label: 'Floor' },
  { id: 'orders', label: 'Orders' },
  { id: 'shop', label: 'Shop' },
];

export function DesktopLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { enabled: scannerReady } = useHardwareScannerBus();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <DesktopScanBridge />
      <aside className="flex h-full w-[15.5rem] shrink-0 flex-col border-r border-seam bg-white">
        <div className="border-b border-seam px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} className="h-10 w-10 rounded-[10px] border border-seam" />
            <div className="min-w-0">
              <p className="font-display truncate text-[15px] font-semibold text-ink">{APP_NAME}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">Shop</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5" aria-label="Shop">
          {navGroups.map((group, groupIndex) => {
            const items = shopNavItems.filter((item) => item.group === group.id);
            return (
              <div key={group.id} className={groupIndex === 0 ? '' : 'mt-4'}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = shopNavItemIsActive(location.pathname, item.to);
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => navigate(item.to)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-tab text-white'
                            : 'text-ink-soft hover:bg-linen hover:text-ink',
                        )}
                      >
                        <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-semibold leading-tight">{item.name}</span>
                          <span className="mt-0.5 block text-[11px] font-normal opacity-70">{item.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {scannerReady && (
          <div className="mx-2.5 mb-2 flex items-center gap-2 rounded-[10px] border border-done/30 bg-white px-3 py-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-done opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-done" />
            </span>
            <p className="text-xs font-semibold text-done">Barcode scanner ready</p>
          </div>
        )}

        <div className="border-t border-seam p-2.5">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-overdue/10 hover:text-overdue"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-linen">
        <AppErrorBoundary>
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </AppErrorBoundary>
      </main>
    </div>
  );
}
