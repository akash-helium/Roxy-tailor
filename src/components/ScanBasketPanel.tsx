import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Scissors, Shirt, Trash2 } from 'lucide-react';
import type { Cloth, Staff } from '../types';
import { assignCutter, assignTailor, markCuttingComplete, markSewingComplete } from '../lib/data';
import { clothBillName } from '../lib/utils';
import { splitBasket } from '../lib/scan-basket';
import { clothStageBadge } from '../lib/cloth-status';
import { Badge, Button, Select, showToast } from './ui';

function PieceRow({
  cloth,
  checked,
  onToggle,
}: {
  cloth: Cloth;
  checked: boolean;
  onToggle: () => void;
}) {
  const stage = clothStageBadge(cloth);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 hover:bg-paper/80">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-action focus:ring-action/30"
        checked={checked}
        onChange={onToggle}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span>
            <span className="block font-semibold text-ink">{clothBillName(cloth)}</span>
            <span className="block text-sm text-slate-600">{cloth.customerName}</span>
            <span className="mt-0.5 block font-mono text-xs text-ink-muted">
              {cloth.orderCode ? `${cloth.orderCode} · ` : ''}
              {cloth.code}
            </span>
          </span>
          <Badge className={`shrink-0 ${stage.className}`}>{stage.label}</Badge>
        </span>
      </span>
    </label>
  );
}

export function ScanBasketPanel({
  basket,
  cutters,
  tailors,
  busy,
  onBusy,
  onBasketChange,
  onUpdated,
  onClear,
  onDone,
  embedded = false,
}: {
  basket: Cloth[];
  cutters: Staff[];
  tailors: Staff[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onBasketChange: (next: Cloth[]) => void;
  onUpdated: () => Promise<void> | void;
  onClear: () => void;
  onDone?: () => void;
  embedded?: boolean;
}) {
  const groups = useMemo(() => splitBasket(basket), [basket]);
  const [cutterTicks, setCutterTicks] = useState<string[]>([]);
  const [tailorTicks, setTailorTicks] = useState<string[]>([]);
  const [cutDoneTicks, setCutDoneTicks] = useState<string[]>([]);
  const [sewDoneTicks, setSewDoneTicks] = useState<string[]>([]);
  const [cutterId, setCutterId] = useState('');
  const [tailorId, setTailorId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cutterKey = groups.needsCutter.map((item) => item.id).join('|');
  const tailorKey = groups.needsTailor.map((item) => item.id).join('|');
  const cutDoneKey = groups.markCutting.map((item) => item.id).join('|');
  const sewDoneKey = groups.markSewing.map((item) => item.id).join('|');

  useEffect(() => {
    setCutterTicks(groups.needsCutter.map((item) => item.id));
  }, [cutterKey]);

  useEffect(() => {
    setTailorTicks(groups.needsTailor.map((item) => item.id));
  }, [tailorKey]);

  useEffect(() => {
    setCutDoneTicks(groups.markCutting.map((item) => item.id));
  }, [cutDoneKey]);

  useEffect(() => {
    setSewDoneTicks(groups.markSewing.map((item) => item.id));
  }, [sewDoneKey]);

  function toggle(ids: string[], setIds: (next: string[]) => void, id: string) {
    setIds(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  function removeIds(ids: string[]) {
    const drop = new Set(ids);
    onBasketChange(basket.filter((item) => !drop.has(item.id)));
  }

  async function handleAssignCutter() {
    if (!cutterId || cutterTicks.length === 0) return;
    onBusy(true);
    setError(null);
    try {
      for (const id of cutterTicks) {
        await assignCutter(id, cutterId);
      }
      showToast(`Assigned cutter to ${cutterTicks.length}`);
      removeIds(cutterTicks);
      setCutterId('');
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign cutter');
    } finally {
      onBusy(false);
    }
  }

  async function handleAssignTailor() {
    if (!tailorId || tailorTicks.length === 0) return;
    onBusy(true);
    setError(null);
    try {
      for (const id of tailorTicks) {
        const piece = groups.needsTailor.find((item) => item.id === id);
        await assignTailor(id, tailorId, piece?.tailorExpectedDate ?? null, { startSewing: true });
      }
      showToast(`Assigned tailor to ${tailorTicks.length}`);
      removeIds(tailorTicks);
      setTailorId('');
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tailor');
    } finally {
      onBusy(false);
    }
  }

  async function handleMarkCutting() {
    if (cutDoneTicks.length === 0) return;
    onBusy(true);
    setError(null);
    try {
      for (const id of cutDoneTicks) {
        await markCuttingComplete(id);
      }
      showToast(`Marked cutting done for ${cutDoneTicks.length}`);
      removeIds(cutDoneTicks);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark cutting done');
    } finally {
      onBusy(false);
    }
  }

  async function handleMarkSewing() {
    if (sewDoneTicks.length === 0) return;
    onBusy(true);
    setError(null);
    try {
      for (const id of sewDoneTicks) {
        await markSewingComplete(id);
      }
      showToast(`Marked sewing done for ${sewDoneTicks.length}`);
      removeIds(sewDoneTicks);
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark sewing done');
    } finally {
      onBusy(false);
    }
  }

  if (basket.length === 0) {
    if (embedded) return null;
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
        Scan tickets into this list, then assign a cutter or tailor to the ticked rows.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {embedded ? (
        <p className="text-sm text-ink-muted">Keep scanning to add more of this stage. Untick rows to split 4 / 3 / 3.</p>
      ) : (
      <div className="flex items-center justify-between gap-3">
        <p className="rounded-full border border-action/25 bg-white px-2.5 py-1 text-sm font-semibold tabular text-action">
          {basket.length} scanned
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear list
          </button>
          {onDone ? (
            <Button variant="secondary" size="sm" onClick={onDone}>
              Done
            </Button>
          ) : null}
        </div>
      </div>
      )}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      {groups.needsCutter.length > 0 ? (
        <div className="rounded-2xl border border-cut/25 bg-cut/5 p-3 sm:p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-cut">
            <Scissors className="h-4 w-4" />
            Needs cutter ({groups.needsCutter.length})
          </p>
          <div className="divide-y divide-cut/15">
            {groups.needsCutter.map((cloth) => (
              <PieceRow
                key={cloth.id}
                cloth={cloth}
                checked={cutterTicks.includes(cloth.id)}
                onToggle={() => toggle(cutterTicks, setCutterTicks, cloth.id)}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label="Cutter"
              value={cutterId}
              searchable={false}
              placeholder="Choose cutter"
              onChange={(e) => setCutterId(e.target.value)}
            >
              <option value="">Choose cutter</option>
              {cutters.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
            <Button
              disabled={busy || !cutterId || cutterTicks.length === 0 || cutters.length === 0}
              onClick={() => void handleAssignCutter()}
              className="sm:mb-0.5"
            >
              Assign cutter to {cutterTicks.length}
            </Button>
          </div>
        </div>
      ) : null}

      {groups.needsTailor.length > 0 ? (
        <div className="rounded-2xl border border-sew/25 bg-sew/5 p-3 sm:p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-sew">
            <Shirt className="h-4 w-4" />
            Needs tailor ({groups.needsTailor.length})
          </p>
          <div className="divide-y divide-sew/15">
            {groups.needsTailor.map((cloth) => (
              <PieceRow
                key={cloth.id}
                cloth={cloth}
                checked={tailorTicks.includes(cloth.id)}
                onToggle={() => toggle(tailorTicks, setTailorTicks, cloth.id)}
              />
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label="Tailor"
              value={tailorId}
              searchable={false}
              placeholder="Choose tailor"
              onChange={(e) => setTailorId(e.target.value)}
            >
              <option value="">Choose tailor</option>
              {tailors.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
            <Button
              disabled={busy || !tailorId || tailorTicks.length === 0 || tailors.length === 0}
              onClick={() => void handleAssignTailor()}
              className="sm:mb-0.5"
            >
              Assign tailor to {tailorTicks.length}
            </Button>
          </div>
        </div>
      ) : null}

      {groups.markCutting.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            Mark cutting done ({groups.markCutting.length})
          </p>
          <div className="divide-y divide-amber-100">
            {groups.markCutting.map((cloth) => (
              <PieceRow
                key={cloth.id}
                cloth={cloth}
                checked={cutDoneTicks.includes(cloth.id)}
                onToggle={() => toggle(cutDoneTicks, setCutDoneTicks, cloth.id)}
              />
            ))}
          </div>
          <Button
            className="mt-3"
            disabled={busy || cutDoneTicks.length === 0}
            onClick={() => void handleMarkCutting()}
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark cutting done for {cutDoneTicks.length}
          </Button>
        </div>
      ) : null}

      {groups.markSewing.length > 0 ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 sm:p-4">
          <p className="mb-2 text-sm font-semibold text-sky-800">
            Mark sewing done ({groups.markSewing.length})
          </p>
          <div className="divide-y divide-sky-100">
            {groups.markSewing.map((cloth) => (
              <PieceRow
                key={cloth.id}
                cloth={cloth}
                checked={sewDoneTicks.includes(cloth.id)}
                onToggle={() => toggle(sewDoneTicks, setSewDoneTicks, cloth.id)}
              />
            ))}
          </div>
          <Button
            className="mt-3"
            disabled={busy || sewDoneTicks.length === 0}
            onClick={() => void handleMarkSewing()}
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark sewing done for {sewDoneTicks.length}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
