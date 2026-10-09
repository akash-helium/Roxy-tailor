import { useMemo, useState } from 'react';
import type { Cloth, Staff } from '../types';
import { clothStageBadge } from '../lib/cloth-status';
import {
  staffWorkBoardLabel,
  staffWorkBoards,
  type StaffWorkBoard as StaffWorkBoardId,
} from '../lib/staff-work';
import { clothBillName } from '../lib/utils';
import { Badge } from './ui';

export function StaffWorkBoard({ staff, cloths }: { staff: Staff; cloths: Cloth[] }) {
  const boards = useMemo(() => staffWorkBoards(staff, cloths), [staff, cloths]);
  const [tab, setTab] = useState<StaffWorkBoardId>(() =>
    boards.working.length > 0 ? 'working' : boards.pending.length > 0 ? 'pending' : 'done',
  );
  const [query, setQuery] = useState('');

  const tabs: { id: StaffWorkBoardId; count: number }[] = [
    { id: 'pending', count: boards.pending.length },
    { id: 'working', count: boards.working.length },
    { id: 'done', count: boards.done.length },
  ];
  const list = boards[tab];
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? list.filter((cloth) => {
        const hay = `${cloth.code} ${clothBillName(cloth)} ${cloth.customerName} ${cloth.customerPhone}`.toLowerCase();
        return hay.includes(needle);
      })
    : list;

  return (
    <div className="rounded-lg border border-seam bg-white p-4">
      <p className="text-sm font-semibold text-ink">Clothes</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        Pending is not with them yet. Working is in their hands. Done is finished for this person.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-[10px] px-2 py-2 text-center ${
                active ? 'bg-action text-white' : 'bg-paper text-ink'
              }`}
            >
              <p className="font-display text-lg font-semibold tabular-nums">{item.count}</p>
              <p className={`text-[11px] font-medium ${active ? 'text-white/80' : 'text-ink-muted'}`}>
                {item.id === 'pending' ? 'Pending' : item.id === 'working' ? 'Working' : 'Done'}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-medium text-ink-muted">{staffWorkBoardLabel(tab, staff.type)}</p>
      {list.length > 8 ? (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cloth code, customer, or garment"
          data-allow-typing
          autoComplete="off"
          className="mt-2 w-full rounded-[10px] border border-seam bg-paper px-3 py-2 text-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20"
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="mt-3 rounded-[10px] bg-paper px-3 py-3 text-sm text-ink-muted">
          {needle ? 'No cloth matches that search.' : 'No clothes in this list.'}
        </p>
      ) : (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
          {visible.map((cloth) => {
            const stage = clothStageBadge(cloth);
            return (
              <li
                key={cloth.id}
                className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{clothBillName(cloth)}</p>
                  <p className="truncate text-xs text-ink-muted">
                    <span className="font-mono font-semibold tracking-wide text-ink">{cloth.code}</span>
                    {' · '}
                    {cloth.customerName}
                  </p>
                </div>
                <Badge className={`shrink-0 ${stage.className}`}>{stage.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
