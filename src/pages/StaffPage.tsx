import { useState, type FormEvent } from 'react';
import { Plus, Scissors, Shirt, Trash2, Wallet } from 'lucide-react';
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

export function StaffPage() {
  const { staff, cloths, loading, error, refetch } = useAppData();
  const { types, loading: typesLoading, error: typesError, getLabel } = useStaffTypes();
  const [open, setOpen] = useState(false);
  const [paymentStaff, setPaymentStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cutters = staff.filter((member) => member.type === 'cutter');
  const tailors = staff.filter((member) => member.type === 'tailor');

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
    <div className="p-5 pb-6">
      <PageHeader
        title="Staff"
        subtitle="Manage staff, agreed pay, and payout ledger"
        action={
          <Button onClick={() => setOpen(true)} className="rounded-full px-4">
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

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card className="bg-amber-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{cutters.length}</p>
              <p className="text-xs text-slate-500">Cutters</p>
            </div>
          </div>
        </Card>
        <Card className="bg-violet-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Shirt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{tailors.length}</p>
              <p className="text-xs text-slate-500">Tailors</p>
            </div>
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
        <div className="space-y-3">
          {staff.map((member) => {
            const pay = summarizeStaffPayments(member, cloths);
            return (
              <Card key={member.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setPaymentStaff(member)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                        member.type === 'cutter'
                          ? 'bg-amber-100 text-amber-700'
                          : member.type === 'tailor'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{member.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={staffTypeBadgeClass(member.type)}>
                          {getLabel(member.type)}
                        </Badge>
                        {member.phone && (
                          <span className="text-xs text-slate-500">{member.phone}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {pay.clothCount} cloth{pay.clothCount === 1 ? '' : 's'} · Pending{' '}
                        {formatCurrency(pay.totalPending)}
                        {pay.ledgerPaid > 0 ? ` · Ledger ${formatCurrency(pay.ledgerPaid)}` : ''}
                      </p>
                    </div>
                  </div>
                  <Wallet className="h-5 w-5 shrink-0 text-indigo-500" />
                </button>
                <div className="flex items-center justify-end border-t border-slate-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void handleRemove(member.id)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    aria-label={`Remove ${member.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
          />
          <Button type="submit" disabled={saving} className="w-full rounded-full py-3.5">
            {saving ? 'Saving...' : 'Save Staff'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
