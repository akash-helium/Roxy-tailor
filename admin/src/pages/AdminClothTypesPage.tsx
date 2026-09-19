import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useGarmentCatalog } from '@app/contexts/GarmentCatalogContext';
import {
  addGarmentSizeField,
  createGarmentType,
  deleteGarmentType,
  fieldKeyFromLabel,
  removeGarmentSizeField,
  updateGarmentSizeField,
} from '@app/lib/garment-catalog-db';
import {
  GARMENT_GENDER_LABELS,
  measurementFieldType,
  type GarmentGender,
  type MeasurementField,
  type MeasurementFieldType,
} from '@app/lib/garments';
import { Button, Card, Input, Select } from '@app/components/ui';
import { AdminPageShell } from '@/components/AdminUi';

type SizeDraft = {
  label: string;
  placeholder: string;
  type: MeasurementFieldType;
  options: string[];
};

const emptySizeDraft = (): SizeDraft => ({
  label: '',
  placeholder: '',
  type: 'number',
  options: [''],
});

function fieldToSizeDraft(field: MeasurementField): SizeDraft {
  const type = measurementFieldType(field);
  return {
    label: field.label,
    placeholder: field.placeholder ?? '',
    type,
    options: type === 'select' && field.options?.length ? field.options.map((item) => item.label) : [''],
  };
}

function sizeDraftToField(draft: SizeDraft, keepId?: string, existing?: MeasurementField): MeasurementField | null {
  if (!draft.label.trim()) return null;
  const type = draft.type;
  const field: MeasurementField = {
    id: keepId || fieldKeyFromLabel(draft.label),
    label: draft.label.trim(),
    type,
  };
  if (type === 'number') {
    field.placeholder = draft.placeholder.trim() || '0';
  }
  if (type === 'select') {
    const options = draft.options
      .map((item) => item.trim())
      .filter(Boolean)
      .map((label) => {
        const match = existing?.options?.find(
          (option) => option.label === label || option.id === fieldKeyFromLabel(label),
        );
        return { id: match?.id ?? fieldKeyFromLabel(label), label };
      });
    if (options.length === 0) return null;
    field.options = options;
  }
  return field;
}

function fieldTypeLabel(field: MeasurementField) {
  const type = measurementFieldType(field);
  if (type === 'boolean') return 'Yes / No checkbox';
  if (type === 'select') return 'Dropdown';
  return 'Number (inches)';
}

function SizeDraftEditor({
  draft,
  onChange,
  disabled,
  showLabels,
}: {
  draft: SizeDraft;
  onChange: (next: SizeDraft) => void;
  disabled?: boolean;
  showLabels?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          label={showLabels ? 'Size name' : 'Size name'}
          value={draft.label}
          onChange={(event) => onChange({ ...draft, label: event.target.value })}
          placeholder="e.g. Chest or Double Breasted"
          disabled={disabled}
        />
        <Select
          label="Input type"
          value={draft.type}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, type: event.target.value as MeasurementFieldType })
          }
        >
          <option value="number">Number (inches)</option>
          <option value="boolean">Yes / No (checkbox)</option>
          <option value="select">Options (dropdown)</option>
        </Select>
      </div>
      {draft.type === 'number' && (
        <Input
          label="Example"
          value={draft.placeholder}
          onChange={(event) => onChange({ ...draft, placeholder: event.target.value })}
          placeholder="40"
          disabled={disabled}
        />
      )}
      {draft.type === 'select' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Dropdown options</p>
          {draft.options.map((option, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={index === 0 ? 'Option' : '\u00a0'}
                  value={option}
                  onChange={(event) => {
                    const options = [...draft.options];
                    options[index] = event.target.value;
                    onChange({ ...draft, options });
                  }}
                  placeholder="e.g. V Double Breasted"
                  disabled={disabled}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    options: draft.options.filter((_, optionIndex) => optionIndex !== index),
                  })
                }
                disabled={disabled || draft.options.length === 1}
                className="mb-1 inline-flex h-[46px] items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-white disabled:opacity-40"
                aria-label="Remove option"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => onChange({ ...draft, options: [...draft.options, ''] })}
            className="rounded-lg px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add option
          </Button>
        </div>
      )}
      {draft.type === 'boolean' && (
        <p className="text-xs text-slate-500">On register, this becomes a check / uncheck box.</p>
      )}
    </div>
  );
}

export function AdminClothTypesPage() {
  const { catalog, loading, dbBacked, error, reload, initialize } = useGarmentCatalog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [typeGender, setTypeGender] = useState<GarmentGender>('male');
  const [newSizes, setNewSizes] = useState<SizeDraft[]>([emptySizeDraft()]);
  const [addSizeDraft, setAddSizeDraft] = useState<SizeDraft>(emptySizeDraft());
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SizeDraft>(emptySizeDraft());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = useMemo(
    () => catalog.find((item) => item.id === selectedId) ?? catalog[0] ?? null,
    [catalog, selectedId],
  );

  const setupNeeded = !dbBacked;

  async function handleInitialize() {
    setBusy(true);
    setActionError(null);
    try {
      await initialize();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to initialize catalog');
    } finally {
      setBusy(false);
    }
  }

  function buildSizeFields(drafts: SizeDraft[]) {
    return drafts
      .map((item) => sizeDraftToField(item))
      .filter((item): item is MeasurementField => Boolean(item));
  }

  async function handleAddType(event: FormEvent) {
    event.preventDefault();
    if (!typeLabel.trim()) return;

    const fields = buildSizeFields(newSizes);
    if (newSizes.some((item) => item.type === 'select' && item.label.trim() && !sizeDraftToField(item))) {
      setActionError('Add at least one dropdown option for option-type sizes');
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const created = await createGarmentType({
        label: typeLabel.trim(),
        gender: typeGender,
        fields,
      });
      setTypeLabel('');
      setNewSizes([emptySizeDraft()]);
      await reload();
      setSelectedId(created.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add cloth type');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteType() {
    if (!selected?.dbId) return;
    if (!window.confirm(`Delete "${selected.label}" and all its sizes?`)) return;

    setBusy(true);
    setActionError(null);
    try {
      await deleteGarmentType(selected.dbId);
      setSelectedId(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete cloth type');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSize(event: FormEvent) {
    event.preventDefault();
    const field = sizeDraftToField(addSizeDraft);
    if (!addSizeDraft.label.trim()) {
      setActionError('Enter a size / measurement name');
      return;
    }
    if (!field) {
      setActionError(
        addSizeDraft.type === 'select'
          ? 'Add at least one dropdown option'
          : 'Enter a size / measurement name',
      );
      return;
    }
    if (!selected?.dbId) {
      setActionError('Save the cloth type to the database first (run setup or initialize)');
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await addGarmentSizeField(selected.dbId, field);
      setAddSizeDraft(emptySizeDraft());
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add size field');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSize(fieldId: string, fieldLabel: string) {
    if (!selected?.dbId) return;
    if (!window.confirm(`Remove size "${fieldLabel}"?`)) return;

    setBusy(true);
    setActionError(null);
    try {
      await removeGarmentSizeField(selected.dbId, fieldId);
      if (editingFieldId === fieldId) {
        setEditingFieldId(null);
        setEditDraft(emptySizeDraft());
      }
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove size field');
    } finally {
      setBusy(false);
    }
  }

  function startEditSize(field: MeasurementField) {
    setActionError(null);
    setEditingFieldId(field.id);
    setEditDraft(fieldToSizeDraft(field));
  }

  function cancelEditSize() {
    setEditingFieldId(null);
    setEditDraft(emptySizeDraft());
  }

  async function handleSaveSize(event: FormEvent) {
    event.preventDefault();
    if (!selected?.dbId || !editingFieldId) return;

    const existing = selected.fields.find((item) => item.id === editingFieldId);
    const field = sizeDraftToField(editDraft, editingFieldId, existing);
    if (!editDraft.label.trim()) {
      setActionError('Enter a size / measurement name');
      return;
    }
    if (!field) {
      setActionError(
        editDraft.type === 'select'
          ? 'Add at least one dropdown option'
          : 'Enter a size / measurement name',
      );
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await updateGarmentSizeField(selected.dbId, editingFieldId, field);
      setEditingFieldId(null);
      setEditDraft(emptySizeDraft());
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update size field');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading cloth types...</p>
      </div>
    );
  }

  return (
    <AdminPageShell
      title="Cloth Types"
      subtitle="Manage cloth types and measurement sizes for the mobile register form"
    >
      {setupNeeded && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Database setup required</p>
          <p className="mt-1 text-amber-800">
            {error ??
              'Run supabase/add-garment-catalog.sql in Supabase, then click Initialize to enable adding types and sizes.'}
          </p>
          <Button
            type="button"
            onClick={() => void handleInitialize()}
            disabled={busy}
            className="mt-3 rounded-lg px-4 py-2"
          >
            {busy ? 'Working...' : 'Initialize Default Cloth Types'}
          </Button>
        </Card>
      )}

      {actionError && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{actionError}</Card>
      )}

      <Card className="p-4">
        <form onSubmit={handleAddType} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_140px] lg:items-end">
            <Input
              label="New cloth type"
              value={typeLabel}
              onChange={(e) => setTypeLabel(e.target.value)}
              placeholder="e.g. Shirt, Sherwani"
              disabled={setupNeeded}
              required
            />
            <Select
              label="Gender"
              value={typeGender}
              onChange={(e) => setTypeGender(e.target.value as GarmentGender)}
              disabled={setupNeeded}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Sizes / measurements (optional)</p>
            {newSizes.map((size, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SizeDraftEditor
                    draft={size}
                    disabled={setupNeeded}
                    showLabels
                    onChange={(next) => {
                      const nextSizes = [...newSizes];
                      nextSizes[index] = next;
                      setNewSizes(nextSizes);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setNewSizes(newSizes.filter((_, i) => i !== index))}
                  disabled={setupNeeded || newSizes.length === 1}
                  className="mt-3 inline-flex h-[46px] items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Remove size row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={setupNeeded}
              onClick={() => setNewSizes([...newSizes, emptySizeDraft()])}
              className="rounded-lg px-3 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add another size
            </Button>
          </div>

          <Button type="submit" disabled={busy || setupNeeded} className="rounded-lg px-4">
            <Plus className="h-4 w-4" />
            Add Cloth Type
          </Button>
        </form>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Cloth types ({catalog.length})
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {catalog.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No cloth types yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {catalog.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setEditingFieldId(null);
                        setEditDraft(emptySizeDraft());
                      }}
                      className={`w-full px-4 py-3 text-left transition ${
                        selected?.id === item.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        {GARMENT_GENDER_LABELS[item.gender]} · {item.fields.length} size
                        {item.fields.length === 1 ? '' : 's'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">{selected.label}</h3>
                  <p className="text-sm text-slate-500">{GARMENT_GENDER_LABELS[selected.gender]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteType()}
                  disabled={busy || !selected.dbId || setupNeeded}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

              <form onSubmit={handleAddSize} className="space-y-3">
                <SizeDraftEditor
                  draft={addSizeDraft}
                  disabled={setupNeeded || !selected.dbId}
                  showLabels
                  onChange={setAddSizeDraft}
                />
                <Button
                  type="submit"
                  disabled={busy || setupNeeded || !selected.dbId}
                  className="rounded-lg px-4"
                >
                  Add Size Field
                </Button>
              </form>

              <div className="space-y-2">
                {selected.fields.length === 0 ? (
                  <p className="text-sm text-slate-500">No size fields yet.</p>
                ) : (
                  selected.fields.map((field) =>
                    editingFieldId === field.id ? (
                      <form
                        key={field.id}
                        onSubmit={handleSaveSize}
                        className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3"
                      >
                        <SizeDraftEditor
                          draft={editDraft}
                          disabled={busy || setupNeeded || !selected.dbId}
                          showLabels
                          onChange={setEditDraft}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            disabled={busy || setupNeeded || !selected.dbId}
                            className="rounded-lg px-4"
                          >
                            Save size
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={cancelEditSize}
                            className="rounded-lg px-4"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div
                        key={field.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{field.label}</p>
                          <p className="text-xs text-slate-500">{fieldTypeLabel(field)}</p>
                          {measurementFieldType(field) === 'number' && field.placeholder ? (
                            <p className="text-xs text-slate-500">Example: {field.placeholder}</p>
                          ) : null}
                          {measurementFieldType(field) === 'select' && field.options?.length ? (
                            <p className="truncate text-xs text-slate-500">
                              {field.options.map((option) => option.label).join(', ')}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            onClick={() => startEditSize(field)}
                            disabled={busy || setupNeeded || !selected.dbId}
                            className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-indigo-600 disabled:opacity-50"
                            aria-label={`Edit ${field.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveSize(field.id, field.label)}
                            disabled={busy || setupNeeded || !selected.dbId}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            aria-label={`Remove ${field.label}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Select a cloth type to manage sizes.</p>
          )}
        </Card>
      </div>
    </AdminPageShell>
  );
}
