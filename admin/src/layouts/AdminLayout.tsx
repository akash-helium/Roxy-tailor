import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Shirt,
  Users,
  UserCircle,
  X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_NAME } from '@app/lib/app-config';
import { BrandLogo } from '@app/components/BrandLogo';
import { useAuth } from '@app/contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Home', to: '/', end: true, icon: LayoutDashboard },
  { name: 'Customers', to: '/customers', icon: UserCircle },
  { name: 'Staff', to: '/staff', icon: Users },
  { name: 'Cloth types', to: '/cloth-types', icon: Shirt },
  { name: 'Money', to: '/transactions', icon: Receipt },
];

function SidebarNav({
  onNavigate,
  onLogout,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="shrink-0 border-b border-seam px-4 py-4">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} className="h-9 w-9 rounded-[10px] border border-seam" />
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] font-semibold text-ink">{APP_NAME}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Back office</p>
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Admin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive ? 'bg-tab text-white' : 'text-ink-soft hover:bg-linen/70 hover:text-ink',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-seam px-2.5 py-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-overdue/10 hover:text-overdue"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    )?.name ?? 'Admin';

  async function handleLogout() {
    setMenuOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white lg:flex-row">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-seam bg-white transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-64 lg:shrink-0 lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-end border-b border-seam px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="min-h-11 min-w-11 rounded-[10px] p-2 text-ink-muted hover:bg-linen hover:text-ink"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setMenuOpen(false)} onLogout={() => void handleLogout()} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-seam bg-white px-3 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="min-h-11 min-w-11 rounded-[10px] border border-seam p-2 text-ink hover:bg-linen"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-sm font-semibold text-ink">{currentPage}</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {APP_NAME}
            </p>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-linen px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
