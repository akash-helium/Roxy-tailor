import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminAppData } from '@/hooks/useAdminAppData';
import { buildCustomerSummaries } from '@/lib/admin-data';
import { formatCurrency } from '@app/lib/payments';
import { Card } from '@app/components/ui';
import {
  ClothOrderCard,
  DetailPanelBody,
  DetailPanelHeader,
  EmptyDetail,
  ListPanelBody,
  ListPanelHeader,
  MasterDetail,
  PageIntro,
  SearchInput,
  SelectableListItem,
  SummaryCard,
  SummaryGrid,
} from '@/components/AdminUi';
import { formatDate } from '@/lib/format';

export function AdminCustomersPage() {
  const { cloths, staff, loading, error } = useAdminAppData();
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedName = searchParams.get('customer');

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

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    if (filtered.length === 0) return;
    const stillVisible = filtered.some((customer) => customer.name === selectedName);
    if (!selectedName || !stillVisible) {
      setSearchParams({ customer: filtered[0].name }, { replace: true });
    }
  }, [filtered, selectedName, setSearchParams]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageIntro
        title="Customers"
        subtitle="Orders and balances by person"
      />

      {error && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      )}

      {!error && filtered.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No customers in Supabase yet</p>
          <p className="mt-2">
            Customers appear from <strong>cloth orders</strong> in the <code className="rounded bg-amber-100 px-1">cloths</code> table.
            Run <code className="rounded bg-amber-100 px-1">supabase/upgrade-schema.sql</code>, then open the mobile app to sync phone data.
          </p>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="py-12 text-center text-sm text-slate-500">No customers found.</Card>
      ) : (
        <MasterDetail
          detailActive={!!selected}
          onDetailBack={() => setSearchParams({}, { replace: true })}
          detailTitle={selected?.name}
          list={
            <>
              <ListPanelHeader>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search customers..."
                />
                <p className="mt-2 text-xs text-slate-500">
                  {filtered.length} customer{filtered.length === 1 ? '' : 's'}
                </p>
              </ListPanelHeader>
              <ListPanelBody>
                <div className="space-y-1">
                  {filtered.map((customer) => (
                    <SelectableListItem
                      key={customer.name}
                      active={selectedName === customer.name}
                      onClick={() => setSearchParams({ customer: customer.name })}
                      title={customer.name}
                      subtitle={`${customer.orderCount} order${customer.orderCount === 1 ? '' : 's'} · Last ${formatDate(customer.lastOrderDate)}`}
                      meta={`Pending ${formatCurrency(customer.totalPending)}`}
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
                  subtitle={`${selected.orderCount} saved order${selected.orderCount === 1 ? '' : 's'}`}
                />
                <DetailPanelBody>
                  <SummaryGrid>
                    <SummaryCard label="Total Billed" value={formatCurrency(selected.totalBilled)} />
                    <SummaryCard label="Total Paid" value={formatCurrency(selected.totalPaid)} tone="success" />
                    <SummaryCard
                      label="Pending"
                      value={formatCurrency(selected.totalPending)}
                      tone={selected.totalPending > 0 ? 'warning' : 'default'}
                    />
                    <SummaryCard label="Orders" value={String(selected.orderCount)} />
                  </SummaryGrid>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-ink">Orders</h4>
                    {selected.cloths.map((cloth) => (
                      <ClothOrderCard key={cloth.id} cloth={cloth} staff={staff} />
                    ))}
                  </div>
                </DetailPanelBody>
              </>
            ) : (
              <EmptyDetail message="Select a customer from the list to view their full order history." />
            )
          }
        />
      )}
    </div>
  );
}
