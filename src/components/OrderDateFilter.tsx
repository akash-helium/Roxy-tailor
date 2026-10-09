import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayDateString } from '../lib/utils';
import { Button } from './ui';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

export function OrderDateFilter({
  from,
  to,
  busyDays,
  onChange,
}: {
  from: string;
  to: string;
  busyDays: Set<string>;
  onChange: (from: string, to: string) => void;
}) {
  const today = todayDateString();
  const initial = parseIso(from || to || today);
  const [cursor, setCursor] = useState(() => ({
    year: initial?.year ?? new Date().getFullYear(),
    month: initial?.month ?? new Date().getMonth(),
  }));

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const pad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const items: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < pad; i += 1) {
      items.push({ iso: '', day: 0, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      items.push({ iso: isoDay(cursor.year, cursor.month, day), day, inMonth: true });
    }
    while (items.length % 7 !== 0) {
      items.push({ iso: '', day: 0, inMonth: false });
    }
    return items;
  }, [cursor]);

  const start = from && to && from <= to ? from : to;
  const end = from && to && from <= to ? to : from;
  const hasRange = Boolean(start && end);

  function pickDay(iso: string) {
    onChange(iso, iso);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Order date</p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const day = todayDateString();
              const parsed = parseIso(day);
              if (parsed) setCursor({ year: parsed.year, month: parsed.month });
              onChange(day, day);
            }}
          >
            Today
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange('', '')}>
            All dates
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-seam bg-paper/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-white hover:text-ink"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-display text-sm font-semibold text-ink">{monthLabel(cursor.year, cursor.month)}</p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-white hover:text-ink"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((label) => (
            <span key={label} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {label}
            </span>
          ))}
          {cells.map((cell, index) => {
            if (!cell.inMonth) {
              return <span key={`pad-${index}`} />;
            }
            const selected = hasRange && cell.iso >= start && cell.iso <= end;
            const edge = cell.iso === start || cell.iso === end;
            const isToday = cell.iso === today;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => pickDay(cell.iso)}
                aria-pressed={selected}
                aria-label={cell.iso}
                className={`relative flex h-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
                  edge
                    ? 'bg-done text-white'
                    : selected
                      ? 'bg-done/15 text-ink'
                      : isToday
                        ? 'ring-1 ring-done/50 text-ink'
                        : 'text-ink hover:bg-white'
                }`}
              >
                {cell.day}
                {busyDays.has(cell.iso) ? (
                  <span
                    className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      edge ? 'bg-white' : 'bg-done'
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">From</span>
          <input
            type="date"
            data-allow-typing
            value={from}
            max={to || undefined}
            onChange={(event) => {
              const next = event.target.value;
              onChange(next, to && next && to < next ? next : to);
            }}
            className="w-full rounded-md border border-seam bg-white px-3 py-2 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">To</span>
          <input
            type="date"
            data-allow-typing
            value={to}
            min={from || undefined}
            onChange={(event) => {
              const next = event.target.value;
              onChange(from && next && from > next ? next : from, next);
            }}
            className="w-full rounded-md border border-seam bg-white px-3 py-2 text-sm text-ink outline-none focus:border-action focus:ring-2 focus:ring-action/20"
          />
        </label>
      </div>
    </div>
  );
}
