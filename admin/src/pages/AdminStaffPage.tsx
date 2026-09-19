import { useMemo, useState, type FormEvent } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { useAdminAppData } from '@/hooks/useAdminAppData';
import { addStaff, removeStaff } from '@app/lib/data';
import { useStaffTypes } from '@app/contexts/StaffTypesContext';
import { createStaffType, deleteStaffType } from '@app/lib/staff-types-db';
import type { StaffType } from '@app/types';
import { Button, Card, Input, Select } from '@app/components/ui';
import { AdminPageShell, StaffTypeBadge } from '@/components/AdminUi';

export function AdminStaffPage() {
  const { staff, loading, error, refetch } = useAdminAppData();
  const { types, loading: typesLoading, dbBacked, error: typesError, reload: reloadTypes, initialize, getLabel } =
    useStaffTypes();
  const [name, setName] = useState('');
  const [type, setType] = useState<StaffType>('cutter');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingTypeId, setRemovingTypeId] = useState<string | null>(null);

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      }),
    [staff],
  );

  const setupNeeded = !dbBacked;

  async function handleInitializeTypes() {
    setSaving(true);
    setActionError(null);
    try {
      await initialize();
      await reloadTypes();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to initialize staff types');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddType(event: FormEvent) {
    event.preventDefault();
    if (!newTypeLabel.trim()) return;

    setSaving(true);
    setActionError(null);
    try {
      const created = await createStaffType(newTypeLabel.trim());
      setNewTypeLabel('');
      await reloadTypes();
      setType(created.slug);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add staff type');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveType(dbId: string, label: string) {
    if (!window.confirm(`Remove staff type "${label}"?`)) return;

    setRemovingTypeId(dbId);
    setActionError(null);
    try {
      await deleteStaffType(dbId);
      await reloadTypes();
      if (type !== 'cutter' && type !== 'tailor') {
        setType('cutter');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove staff type');
    } finally {
      setRemovingTypeId(null);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setActionError(null);
    try {
      await addStaff({ name: name.trim(), type, phone: '', notes: '' });
      setName('');
      setType('cutter');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add staff');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, staffName: string) {
    if (!window.confirm(`Remove ${staffName}?`)) return;

    setRemovingId(id);
    setActionError(null);
    try {
      await removeStaff(id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove staff');
    } finally {
      setRemovingId(null);
    }
  }

  if (loading || typesLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading staff...</p>
      </div>
    );
  }

  return (
    <AdminPageShell
      title="Staff"
      subtitle="Manage staff and staff types. Cutter and Tailor are default types and cannot be deleted."
    >
      {(error || typesError || actionError) && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error ?? typesError ?? actionError}
        </Card>
      )}

      {setupNeeded && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Database setup required for custom staff types</p>
          <p className="mt-1 text-amber-800">
            Run supabase/add-staff-types.sql in Supabase, then click Initialize. Cutter and Tailor still work without this.
          </p>
          <Button
            type="button"
            onClick={() => void handleInitializeTypes()}
            disabled={saving}
            className="mt-3 rounded-lg px-4 py-2"
          >
            {saving ? 'Working...' : 'Initialize Staff Types'}
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Staff types</h3>
        <ul className="mb-4 space-y-2">
          {types.map((item) => (
            <li
              key={item.slug}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <StaffTypeBadge type={item.slug} label={item.label} />
                {item.isSystem && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Lock className="h-3 w-3" />
                    Default
                  </span>
                )}
              </div>
              {!item.isSystem && item.dbId && (
                <button
                  type="button"
                  onClick={() => void handleRemoveType(item.dbId!, item.label)}
                  disabled={removingTypeId === item.dbId || setupNeeded}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddType} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            label="New staff type"
            value={newTypeLabel}
            onChange={(e) => setNewTypeLabel(e.target.value)}
            placeholder="e.g. Finishing, Ironing"
            disabled={setupNeeded}
          />
          <Button type="submit" disabled={saving || setupNeeded} className="h-[46px] rounded-lg px-4 sm:mt-6">
            <Plus className="h-4 w-4" />
            Add Type
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Raju"
            required
          />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={saving} className="h-[46px] rounded-lg px-5 sm:mt-6">
            {saving ? 'Adding...' : 'Add Staff'}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaff.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    No staff yet. Add staff above.
                  </td>
                </tr>
              ) : (
                sortedStaff.map((member) => (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                    <td className="px-4 py-3">
                      <StaffTypeBadge type={member.type} label={getLabel(member.type)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRemove(member.id, member.name)}
                        disabled={removingId === member.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {removingId === member.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminPageShell>
  );
}
