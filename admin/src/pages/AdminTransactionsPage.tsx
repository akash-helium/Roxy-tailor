import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAppData } from '@/hooks/useAdminAppData';
import { buildCustomerSummaries, buildStaffDetails } from '@/lib/admin-data';
import {
  clothPaidAmount,
  clothPendingAmount,
  formatCurrency,
  getStaffPayFields,
  staffPayPending,
} from '@app/lib/payments';
import { clothBillName } from '@app/lib/utils';
import { useStaffTypes } from '@app/contexts/StaffTypesContext';
import { CLOTH_STATUS_COLORS, CLOTH_STATUS_LABELS } from '@app/types';
import { Badge, Card } from '@app/components/ui';
import {
  DetailPanelBody,
  DetailPanelHeader,
  EmptyDetail,
  ListPanelBody,
  ListPanelHeader,
  MasterDetail,
  PageIntro,
  SearchInput,
  SelectableListItem,
  StaffTypeBadge,
  SummaryCard,
  SummaryGrid,
} from '@/components/AdminUi';
import { formatDate } from '@/lib/format';
import { cn } from '@app/lib/utils';

type TransactionView = 'customers' | 'staff';

function ViewTabs({
  view,
  onChange,
  customerCount,
  staffCount,
}: {
  view: TransactionView;
  onChange: (view: TransactionView) => void;
  customerCount: number;
  staffCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-full sm:w-auto">
      <button
        type="button"
        onClick={() => onChange('customers')}
        className={cn(
          'flex-1 rounded-md px-3 py-2.5 text-center text-sm font-semibold transition sm:px-4',
          view === 'customers'
            ? 'bg-tab text-white'
            : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        Customer Payments
        <span className="ml-1.5 text-xs font-medium opacity-80">({customerCount})</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('staff')}
        className={cn(
          'flex-1 rounded-md px-3 py-2.5 text-center text-sm font-semibold transition sm:px-4',
          view === 'staff'
            ? 'bg-tab text-white'
            : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        Staff Payments
        <span className="ml-1.5 text-xs font-medium opacity-80">({staffCount})</span>
      </button>
    </div>
  );
}

function CustomerTransactionsPanel({
  cloths,
  search,
  onSearchChange,
  selectedName,
  onSelectCustomer,
  onClearSelection,
}: {
  cloths: ReturnType<typeof useAdminAppData>['cloths'];
  search: string;
  onSearchChange: (value: string) => void;
  selectedName: string | null;
  onSelectCustomer: (name: string) => void;
  onClearSelection: () => void;
}) {
  const customers = useMemo(() => buildCustomerSummaries(cloths), [cloths]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [customers, search]);

  const selected = useMemo(
    () => customers.find((customer) => customer.name === selectedName) ?? null,
    [customers, selectedName],
  );

  if (filtered.length === 0) {
    return <Card className="py-12 text-center text-sm text-slate-500">No customer transactions found.</Card>;
  }

  return (
    <MasterDetail
      detailActive={!!selected}
      onDetailBack={onClearSelection}
      detailTitle={selected?.name}
      list={
        <>
          <ListPanelHeader>
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder="Search by customer..."
            />
            <p className="mt-2 text-xs text-slate-500">
              {filtered.length} customer{filtered.length === 1 ? '' : 's'} with payments
            </p>
          </ListPanelHeader>
          <ListPanelBody>
            <div className="space-y-1">
              {filtered.map((customer) => (
                <SelectableListItem
                  key={customer.name}
                  active={selectedName === customer.name}
                  onClick={() => onSelectCustomer(customer.name)}
                  title={customer.name}
                  subtitle={`Paid ${formatCurrency(customer.totalPaid)} of ${formatCurrency(customer.totalBilled)}`}
                  meta={`${customer.orderCount} order${customer.orderCount === 1 ? '' : 's'}`}
                />
              ))}
            </div>
          </ListPanelBody>
        </>
      }
      detail={
        selected ? (
          <>
            <DetailPanelHeader
              title={selected.name}
              subtitle="Bills and payments per piece"
            />
            <DetailPanelBody>
              <SummaryGrid>
                <SummaryCard label="Total Billed" value={formatCurrency(selected.totalBilled)} />
                <SummaryCard label="Paid" value={formatCurrency(selected.totalPaid)} tone="success" />
                <SummaryCard
                  label="Pending"
                  value={formatCurrency(selected.totalPending)}
                  tone={selected.totalPending > 0 ? 'warning' : 'default'}
                />
                <SummaryCard label="Orders" value={String(selected.orderCount)} />
              </SummaryGrid>

              <div className="overflow-x-auto rounded-xl border border-seam">
                <table className="min-w-full divide-y divide-seam text-sm">
                  <thead className="bg-paper">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Piece
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Status
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Bill
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Paid
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Pending
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-seam bg-white">
                    {selected.cloths.map((cloth) => {
                      const pending = clothPendingAmount(cloth);
                      const paid = clothPaidAmount(cloth);
                      const status = cloth.status in CLOTH_STATUS_LABELS ? cloth.status : 'cutting';
                      return (
                        <tr key={cloth.id} className="hover:bg-paper/80">
                          <td className="px-3 py-2.5">
                            <p className="font-display text-xs font-semibold tracking-wide text-ink">
                              {cloth.orderCode ? `${cloth.orderCode} · ${cloth.code}` : cloth.code}
                            </p>
                            <p className="text-sm text-ink">{clothBillName(cloth)}</p>
                            <p className="text-[11px] text-ink-muted">{formatDate(cloth.updatedAt)}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge className={CLOTH_STATUS_COLORS[status]}>
                              {CLOTH_STATUS_LABELS[status]}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                            {formatCurrency(cloth.totalAmount)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-done">
                            {formatCurrency(paid)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${pending > 0 ? 'text-cut' : 'text-ink-muted'}`}
                          >
                            {formatCurrency(pending)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-paper font-semibold">
                    <tr>
                      <td colSpan={2} className="px-3 py-2.5 text-ink">
                        Total ({selected.orderCount})
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrency(selected.totalBilled)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-done">
                        {formatCurrency(selected.totalPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-cut">
                        {formatCurrency(selected.totalPending)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                First order: {formatDate(selected.cloths.at(-1)?.createdAt ?? null)} · Latest update:{' '}
                {formatDate(selected.lastOrderDate)}
              </p>
            </DetailPanelBody>
          </>
        ) : (
          <EmptyDetail message="Select a customer to view their payment transactions." />
        )
      }
    />
  );
}

function StaffTransactionsPanel({
  staff,
  cloths,
  search,
  onSearchChange,
  selectedStaffId,
  onSelectStaff,
  onClearSelection,
  getLabel,
}: {
  staff: ReturnType<typeof useAdminAppData>['staff'];
  cloths: ReturnType<typeof useAdminAppData>['cloths'];
  search: string;
  onSearchChange: (value: string) => void;
  selectedStaffId: string | null;
  onSelectStaff: (id: string) => void;
  onClearSelection: () => void;
  getLabel: (slug: string) => string;
}) {
  const staffDetails = useMemo(() => buildStaffDetails(staff, cloths), [staff, cloths]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staffDetails;
    return staffDetails.filter((detail) => detail.member.name.toLowerCase().includes(query));
  }, [staffDetails, search]);

  const selected = useMemo(
    () => staffDetails.find((detail) => detail.member.id === selectedStaffId) ?? null,
    [staffDetails, selectedStaffId],
  );

  const payType =
    selected && (selected.member.type === 'cutter' || selected.member.type === 'tailor')
      ? selected.member.type
      : null;

  if (filtered.length === 0) {
    return <Card className="py-12 text-center text-sm text-slate-500">No staff with transactions found.</Card>;
  }

  return (
    <MasterDetail
      detailActive={!!selected}
      onDetailBack={onClearSelection}
      detailTitle={selected?.member.name}
      list={
        <>
          <ListPanelHeader>
            <SearchInput value={search} onChange={onSearchChange} placeholder="Search by staff name..." />
            <p className="mt-2 text-xs text-slate-500">
              {filtered.length} staff member{filtered.length === 1 ? '' : 's'}
            </p>
          </ListPanelHeader>
          <ListPanelBody>
            <div className="space-y-1">
              {filtered.map((detail) => (
                <SelectableListItem
                  key={detail.member.id}
                  active={selectedStaffId === detail.member.id}
                  onClick={() => onSelectStaff(detail.member.id)}
                  title={detail.member.name}
                  subtitle={`Paid ${formatCurrency(detail.totalPaid)} of ${formatCurrency(detail.totalAmount)}`}
                  meta={`${detail.clothCount} cloth${detail.clothCount === 1 ? '' : 's'}`}
                  badge={
                    <StaffTypeBadge type={detail.member.type} label={getLabel(detail.member.type)} />
                  }
                />
              ))}
            </div>
          </ListPanelBody>
        </>
      }
      detail={
        selected ? (
          <>
            <DetailPanelHeader
              title={selected.member.name}
              subtitle={
                payType
                  ? `${getLabel(selected.member.type)} — payment history per assigned cloth`
                  : `${getLabel(selected.member.type)} — no cloth payment tracking for this type`
              }
            >
              <StaffTypeBadge type={selected.member.type} label={getLabel(selected.member.type)} />
            </DetailPanelHeader>
            <DetailPanelBody>
              <SummaryGrid>
                <SummaryCard label="Total Pay" value={formatCurrency(selected.totalAmount)} />
                <SummaryCard label="Advance + Final Paid" value={formatCurrency(selected.totalPaid)} tone="success" />
                <SummaryCard
                  label="Pending"
                  value={formatCurrency(selected.totalPending)}
                  tone={selected.totalPending > 0 ? 'warning' : 'default'}
                />
                <SummaryCard label="Cloths" value={String(selected.clothCount)} />
              </SummaryGrid>

              {!payType ? (
                <Card className="border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Staff payments are tracked for <strong>Cloth Cutter</strong> and{' '}
                  <strong>Tailor (Sewing)</strong> only. Assign this person as cutter or tailor on orders in
                  the mobile app to record payments here.
                </Card>
              ) : selected.cloths.length === 0 ? (
                <Card className="py-10 text-center text-sm text-slate-500">
                  No cloths assigned to this staff member yet.
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-seam">
                  <table className="min-w-full divide-y divide-seam text-sm">
                    <thead className="bg-paper">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Piece
                        </th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Customer
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Pay
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Paid
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Pending
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-seam bg-white">
                      {selected.cloths.map((cloth) => {
                        const pay = getStaffPayFields(cloth, payType);
                        const pending = staffPayPending(pay.amount, pay.advance, pay.final);
                        const paid = pay.advance + pay.final;
                        return (
                          <tr key={cloth.id} className="hover:bg-paper/80">
                            <td className="px-3 py-2.5">
                              <p className="font-display text-xs font-semibold tracking-wide text-ink">
                                {cloth.orderCode ? `${cloth.orderCode} · ${cloth.code}` : cloth.code}
                              </p>
                              <p className="text-sm text-ink">{clothBillName(cloth)}</p>
                              <p className="text-[11px] text-ink-muted">{formatDate(cloth.updatedAt)}</p>
                            </td>
                            <td className="px-3 py-2.5 text-ink">{cloth.customerName}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                              {formatCurrency(pay.amount)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-done">
                              {formatCurrency(paid)}
                            </td>
                            <td
                              className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${pending > 0 ? 'text-cut' : 'text-ink-muted'}`}
                            >
                              {formatCurrency(pending)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-paper font-semibold">
                      <tr>
                        <td colSpan={2} className="px-3 py-2.5 text-ink">
                          Total ({selected.clothCount})
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(selected.totalAmount)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-done">
                          {formatCurrency(selected.totalPaid)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-cut">
                          {formatCurrency(selected.totalPending)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </DetailPanelBody>
          </>
        ) : (
          <EmptyDetail message="Select a staff member to view their payment transactions." />
        )
      }
    />
  );
}

export function AdminTransactionsPage() {
  const { cloths, staff, loading, error } = useAdminAppData();
  const { getLabel } = useStaffTypes();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const view: TransactionView =
    searchParams.get('view') === 'staff' ? 'staff' : 'customers';
  const selectedCustomer = searchParams.get('customer');
  const selectedStaffId = searchParams.get('staff');

  const customers = useMemo(() => buildCustomerSummaries(cloths), [cloths]);
  const staffDetails = useMemo(() => buildStaffDetails(staff, cloths), [staff, cloths]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [customers, search]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staffDetails;
    return staffDetails.filter((detail) => detail.member.name.toLowerCase().includes(query));
  }, [staffDetails, search]);

  function switchView(next: TransactionView) {
    setSearch('');
    if (next === 'staff') {
      const first = staffDetails[0];
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      setSearchParams(
        desktop && first ? { view: 'staff', staff: first.member.id } : { view: 'staff' },
        { replace: true },
      );
      return;
    }
    const first = customers[0];
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    setSearchParams(desktop && first ? { customer: first.name } : {}, { replace: true });
  }

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    if (view !== 'customers' || filteredCustomers.length === 0) return;
    const stillVisible = filteredCustomers.some((customer) => customer.name === selectedCustomer);
    if (!selectedCustomer || !stillVisible) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('view');
          next.delete('staff');
          next.set('customer', filteredCustomers[0].name);
          return next;
        },
        { replace: true },
      );
    }
  }, [view, filteredCustomers, selectedCustomer, setSearchParams]);

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    if (view !== 'staff' || filteredStaff.length === 0) return;
    const stillVisible = filteredStaff.some((detail) => detail.member.id === selectedStaffId);
    if (!selectedStaffId || !stillVisible) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('view', 'staff');
          next.delete('customer');
          next.set('staff', filteredStaff[0].member.id);
          return next;
        },
        { replace: true },
      );
    }
  }, [view, filteredStaff, selectedStaffId, setSearchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Transactions"
        subtitle="Track customer bills and staff payments separately"
        action={
          <ViewTabs
            view={view}
            onChange={switchView}
            customerCount={customers.length}
            staffCount={staff.length}
          />
        }
      />

      {error && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      )}

      {view === 'customers' ? (
        <CustomerTransactionsPanel
          cloths={cloths}
          search={search}
          onSearchChange={setSearch}
          selectedName={selectedCustomer}
          onSelectCustomer={(name) =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('view');
              next.delete('staff');
              next.set('customer', name);
              return next;
            })
          }
          onClearSelection={() => setSearchParams({}, { replace: true })}
        />
      ) : (
        <StaffTransactionsPanel
          staff={staff}
          cloths={cloths}
          search={search}
          onSearchChange={setSearch}
          selectedStaffId={selectedStaffId}
          onSelectStaff={(id) =>
            setSearchParams({ view: 'staff', staff: id }, { replace: false })
          }
          onClearSelection={() => setSearchParams({ view: 'staff' }, { replace: true })}
          getLabel={getLabel}
        />
      )}
    </div>
  );
}
