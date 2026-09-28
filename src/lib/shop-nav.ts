import { Banknote, CheckCircle2, ClipboardList, ScanLine, Shirt, Wallet, type LucideIcon } from 'lucide-react';

export type ShopNavItem = {
  name: string;
  short: string;
  hint: string;
  to: string;
  icon: LucideIcon;
  group: 'work' | 'orders' | 'shop';
};

export const shopNavItems: ShopNavItem[] = [
  { name: 'Home', short: 'Home', hint: 'Look up & move work', to: '/', icon: ScanLine, group: 'work' },
  {
    name: 'All orders',
    short: 'All',
    hint: 'Every order in one list',
    to: '/orders/all',
    icon: Shirt,
    group: 'orders',
  },
  {
    name: 'Pending orders',
    short: 'Pending',
    hint: 'Work still in the shop',
    to: '/orders/pending',
    icon: ClipboardList,
    group: 'orders',
  },
  {
    name: 'Done orders',
    short: 'Done',
    hint: 'Finished cloths',
    to: '/orders/done',
    icon: CheckCircle2,
    group: 'orders',
  },
  {
    name: 'Pending payments',
    short: 'Bills',
    hint: 'Money still due',
    to: '/orders/payments',
    icon: Banknote,
    group: 'orders',
  },
  { name: 'Staff pay', short: 'Pay', hint: 'Payouts & pending', to: '/staff', icon: Wallet, group: 'shop' },
];

export function shopNavItemIsActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
