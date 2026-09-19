import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt, Shirt, UserCircle, Users } from 'lucide-react';
import { useAdminAppData } from '@/hooks/useAdminAppData';
import { buildAdminStats, buildCustomerSummaries } from '@/lib/admin-data';
import { formatCurrency } from '@app/lib/payments';
import { formatDate } from '@/lib/format';
import { cn } from '@app/lib/utils';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
}) {
  const card = (
    <div
      className={cn(
        'flex h-full min-h-[8.5rem] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        to && 'transition hover:border-indigo-300 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold leading-none text-slate-900">{value}</p>
          {hint && <p className="mt-2 text-xs leading-snug text-slate-500">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {to && (
        <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-indigo-600">
          View details
          <ArrowRight className="h-3.5 w-3.5" />
        </p>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full no-underline">
        {card}
      </Link>
    );
  }

  return card;
}

export function AdminDashboardPage() {
  const { staff, cloths, loading, error } = useAdminAppData();
  const stats = useMemo(() => buildAdminStats(cloths, staff), [cloths, staff]);
  const recentCustomers = useMemo(() => buildCustomerSummaries(cloths).slice(0, 5), [cloths]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Admin cannot see mobile app data yet</p>
          <p className="mt-2">
            Run <code className="rounded bg-amber-100 px-1">supabase/add-shared-shop-access.sql</code> in
            your Supabase SQL Editor, then reopen the app on your phone so local data syncs to the cloud.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Overview of customers, staff, orders, and payments
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Customers" value={stats.customerCount} icon={UserCircle} to="/customers" />
        <StatCard
          label="Staff"
          value={stats.staffCount}
          hint={`${stats.cutters} cutters · ${stats.tailors} tailors`}
          icon={Users}
          to="/staff"
        />
        <StatCard label="Orders" value={stats.orderCount} icon={Shirt} />
        <StatCard
          label="Customer Collected"
          value={formatCurrency(stats.totalCollected)}
          hint={`Pending: ${formatCurrency(stats.totalPending)}`}
          icon={Receipt}
          to="/transactions"
        />
        <StatCard
          label="Staff Paid"
          value={formatCurrency(stats.staffTotalPaid)}
          hint={`Pending: ${formatCurrency(stats.staffTotalPending)}`}
          icon={Users}
          to="/transactions?view=staff"
        />
      </div>

      {recentCustomers.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
            <h3 className="font-semibold text-slate-900">Recent Customers</h3>
            <Link to="/customers" className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentCustomers.map((customer) => (
              <Link
                key={customer.name}
                to={`/transactions?customer=${encodeURIComponent(customer.name)}`}
                className="flex flex-col gap-2 px-4 py-3 no-underline transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {customer.orderCount} orders · Updated {formatDate(customer.lastOrderDate)}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(customer.totalPaid)}
                  </p>
                  <p className="text-xs text-amber-700">
                    Pending {formatCurrency(customer.totalPending)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No orders yet. Data will appear here once cloths are registered in the app.</p>
        </div>
      )}
    </div>
  );
}
