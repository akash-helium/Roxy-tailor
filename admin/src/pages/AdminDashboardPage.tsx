import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAppData } from '@/hooks/useAdminAppData';
import { buildAdminStats, buildCustomerSummaries } from '@/lib/admin-data';
import { formatCurrency } from '@app/lib/payments';
import { formatDate } from '@/lib/format';

export function AdminDashboardPage() {
  const { staff, cloths, loading, error } = useAdminAppData();
  const stats = useMemo(() => buildAdminStats(cloths, staff), [cloths, staff]);
  const recentCustomers = useMemo(() => buildCustomerSummaries(cloths).slice(0, 5), [cloths]);
  const floor = useMemo(
    () => ({
      cutting: cloths.filter((c) => c.status === 'cutting').length,
      ready: cloths.filter((c) => c.status === 'ready_to_sew').length,
      sewing: cloths.filter((c) => c.status === 'sewing').length,
    }),
    [cloths],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-ink-muted">Loading home...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-[14px] border border-overdue/20 bg-overdue/10 p-4 text-sm text-overdue">
          {error}
        </div>
        <div className="rounded-[14px] border border-cut/20 bg-cut/10 p-4 text-sm text-cut">
          <p className="font-semibold">Admin cannot see shop data yet</p>
          <p className="mt-2">
            Run <code className="rounded bg-ticket px-1">supabase/add-shared-shop-access.sql</code> in
            Supabase, then reopen the shop app so local tickets sync.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Home</h2>
        <p className="mt-1 text-sm text-ink-muted">Work still open, and money still out.</p>
      </div>

      <div>
        <p className="mb-3 font-display text-sm font-semibold text-ink">Work in the shop</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cutting', value: floor.cutting, tone: 'text-cut', fill: 'border-cut/30 bg-cut/10' },
            { label: 'Ready', value: floor.ready, tone: 'text-ready', fill: 'border-ready/30 bg-ready/10' },
            { label: 'Sewing', value: floor.sewing, tone: 'text-sew', fill: 'border-sew/30 bg-sew/10' },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-[12px] border px-3 py-4 text-center shadow-sm ${item.fill}`}
            >
              <p className={`font-display text-3xl font-semibold tabular ${item.tone}`}>{item.value}</p>
              <p className={`mt-1 text-xs font-semibold ${item.tone}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-sm font-semibold text-ink">Money</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[12px] border border-cut/30 bg-cut/10 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cut">Still to collect</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular text-cut">
              {formatCurrency(stats.totalPending)}
            </p>
          </div>
          <div className="rounded-[12px] border border-done/30 bg-done/10 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-done">Taken in</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular text-done">
              {formatCurrency(stats.totalCollected)}
            </p>
          </div>
          <div className="rounded-[12px] border border-cut/30 bg-cut/10 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cut">Staff owed</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular text-cut">
              {formatCurrency(stats.staffTotalPending)}
            </p>
          </div>
          <Link
            to="/transactions"
            className="rounded-[12px] border border-action/30 bg-action/5 p-4 no-underline transition hover:border-action"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-action">Ledgers</p>
            <p className="mt-2 font-display text-lg font-semibold text-action">Open money →</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/customers" className="ticket rounded-[14px] p-4 no-underline transition hover:bg-paper">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Customers</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular text-ink">{stats.customerCount}</p>
        </Link>
        <Link to="/staff" className="ticket rounded-[14px] p-4 no-underline transition hover:bg-paper">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Staff</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular text-ink">{stats.staffCount}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {stats.cutters} cutters · {stats.tailors} tailors
          </p>
        </Link>
        <Link
          to="/transactions?view=staff"
          className="ticket rounded-[14px] p-4 no-underline transition hover:bg-paper"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Staff paid</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular text-done">
            {formatCurrency(stats.staffTotalPaid)}
          </p>
        </Link>
      </div>

      {recentCustomers.length > 0 ? (
        <div className="ticket overflow-hidden rounded-[14px]">
          <div className="flex items-center justify-between gap-3 border-b border-seam px-4 py-3 sm:px-5">
            <h3 className="font-display text-base font-semibold text-ink">Recent customers</h3>
            <Link to="/customers" className="shrink-0 text-sm font-semibold text-action hover:text-action-deep">
              All
            </Link>
          </div>
          <div className="divide-y divide-seam">
            {recentCustomers.map((customer) => (
              <Link
                key={customer.name}
                to={`/transactions?customer=${encodeURIComponent(customer.name)}`}
                className="flex flex-col gap-2 px-4 py-3 no-underline transition hover:bg-paper sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{customer.name}</p>
                  <p className="text-xs text-ink-muted">
                    {customer.orderCount} orders · {formatDate(customer.lastOrderDate)}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm font-semibold tabular text-ink">{formatCurrency(customer.totalPaid)}</p>
                  <p className="text-xs tabular text-cut">Pending {formatCurrency(customer.totalPending)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-seam bg-paper px-6 py-10 text-center">
          <p className="text-sm text-ink-muted">No tickets yet. Register a cloth on the shop floor.</p>
        </div>
      )}
    </div>
  );
}
