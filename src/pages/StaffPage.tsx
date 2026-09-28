import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Scissors, Search, Shirt, Trash2, Wallet } from 'lucide-react';
import { addStaff, removeStaff } from '../lib/data';
import { useAppData } from '../hooks/useAppData';
import { formatCurrency, summarizeStaffPayments } from '../lib/payments';
import { StaffPaymentSheet } from '../components/StaffPaymentSheet';
import { useStaffTypes } from '../contexts/StaffTypesContext';
import { staffTypeBadgeClass, type Staff, type StaffType } from '../types';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Textarea } from '../components/ui';

const emptyForm = {
  name: '',
  type: 'cutter' as StaffType,
  phone: '',
  notes: '',
};

function avatarClass(type: string) {
  if (type === 'cutter') return 'bg-cut/15 text-cut';
  if (type === 'tailor') return 'bg-sew/15 text-sew';
  return 'bg-linen text-ink-soft';
}

export function StaffPage() {
  const { staff, cloths, loading, error, refetch } = useAppData();
  const { types, loading: typesLoading, error: typesError, getLabel } = useStaffTypes();
  const [open, setOpen] = useState(false);
  const [paymentStaff, setPaymentStaff] = useState<Staff | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cutters = staff.filter((member) => member.type === 'cutter');
  const tailors = staff.filter((member) => member.type === 'tailor');
  const payRows = useMemo(
    () =>
      staff
        .map((member) => ({
          member,
          pay: summarizeStaffPayments(member, cloths),
        }))
        .sort((a, b) => {
          const pending = b.pay.totalPending - a.pay.totalPending;
          if (pending !== 0) return pending;
          return a.member.name.localeCompare(b.member.name);
        }),
    [staff, cloths],
  );
  const totalPending = payRows.reduce((sum, row) => sum + row.pay.totalPending, 0);
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle
        ? payRows.filter((row) =>
            `${row.member.name} ${row.member.phone} ${getLabel(row.member.type)}`
              .toLowerCase()
              .includes(needle),
          )
        : payRows,
    [payRows, needle, getLabel],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);

    try {
      await addStaff(form);
      setForm(emptyForm);
      setOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add staff');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setActionError(null);
    try {
      await removeStaff(id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove staff');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-5">
        <p className="text-sm text-slate-500">Loading staff...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-6">
      <PageHeader
        title="Staff pay"
        subtitle={`Open a person to pay for their work. ${formatCurrency(totalPending)} still due.`}
        action={
          <Button onClick={() => setOpen(true)} className="px-4">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      />

      {(error || typesError || actionError) && (
        <Card className="mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error ?? typesError ?? actionError}
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cut/15 text-cut">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink">{cutters.length}</p>
            <p className="text-xs text-ink-muted">Cutters</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sew/15 text-sew">
            <Shirt className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink">{tailors.length}</p>
            <p className="text-xs text-ink-muted">Tailors</p>
          </div>
        </Card>
      </div>

      {staff.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-slate-700">No staff yet</p>
          <p className="mt-1 text-sm text-slate-500">Add your first cutter or tailor to get started</p>
          <Button onClick={() => setOpen(true)} className="mt-4">
            Add Staff
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {staff.length > 8 && (
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search staff..."
                className="w-full rounded-[10px] border border-seam bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20"
              />
            </div>
          )}

          {visible.length === 0 ? (
            <Card className="py-8 text-center text-sm text-ink-muted">No one matches that search.</Card>
          ) : (
            visible.map((row) => {
              const pending = row.pay.totalPending;
              const meta = [
                pending > 0 ? `Still due ${formatCurrency(pending)}` : 'Settled',
                `${row.pay.clothCount} cloth${row.pay.clothCount === 1 ? '' : 's'}`,
              ].join(' · ');

              return (
                <Card key={row.member.id} className="p-0">
                  <div className="flex items-center gap-2 p-3 sm:gap-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setPaymentStaff(row.member)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${avatarClass(row.member.type)}`}
                      >
                        {row.member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{row.member.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <Badge className={staffTypeBadgeClass(row.member.type)}>
                            {getLabel(row.member.type)}
                          </Badge>
                          {row.member.phone ? (
                            <span className="text-xs text-ink-muted">{row.member.phone}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{meta}</p>
                      </div>
                      {pending > 0 ? (
                        <span className="shrink-0 font-display text-base font-bold tabular-nums text-cut">
                          {formatCurrency(pending)}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStaff(row.member)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-action/10 text-action hover:bg-action/15"
                      aria-label={`Pay ${row.member.name}`}
                    >
                      <Wallet className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemove(row.member.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-linen text-ink-muted hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove ${row.member.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {paymentStaff && (
        <StaffPaymentSheet
          staff={staff.find((member) => member.id === paymentStaff.id) ?? paymentStaff}
          cloths={cloths}
          onClose={() => setPaymentStaff(null)}
          onUpdated={() => void refetch()}
        />
      )}

      <Modal open={open} title="Add Staff" onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Raju"
            required
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as StaffType })}
            disabled={typesLoading}
          >
            {typesLoading ? (
              <option value="cutter">Loading types...</option>
            ) : (
              types.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))
            )}
          </Select>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="9876543210"
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full py-3.5 sm:col-span-2">
            {saving ? 'Saving...' : 'Save Staff'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
