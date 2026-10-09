import type { Cloth, Staff } from '../types';
import { getStaffById } from '../lib/data';
import { clothStageBadge } from '../lib/cloth-status';
import { clothBillName, formatCalendarDate, isPastDue } from '../lib/utils';
import { Badge } from './ui';

function assignedName(staff: Staff[], id: string | null) {
  return getStaffById(staff, id)?.name?.trim() || 'Not assigned';
}

function dueLine(label: string, date: string | null, done: boolean) {
  if (!date) return { label, value: '—', overdue: false };
  const overdue = isPastDue(date, done);
  return {
    label,
    value: `${overdue ? 'Overdue' : 'By'} ${formatCalendarDate(date)}`,
    overdue,
  };
}

export function CustomerOrderProgress({
  cloths,
  staff,
}: {
  cloths: Cloth[];
  staff: Staff[];
}) {
  const total = cloths.length;
  const completed = cloths.filter((cloth) => cloth.status === 'completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;
  const latestDelivery = cloths.map((cloth) => cloth.deliveryDate).filter(Boolean).sort().at(-1) ?? null;
  const deliveryOverdue = isPastDue(latestDelivery, allDone);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {allDone ? 'All clothes ready' : `${completed} of ${total} completed`}
          </p>
          {latestDelivery ? (
            <p className={`text-xs font-medium ${deliveryOverdue ? 'text-overdue' : 'text-ink-muted'}`}>
              {allDone ? 'Ready' : deliveryOverdue ? 'Overdue' : 'Complete by'}{' '}
              {formatCalendarDate(latestDelivery)}
            </p>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-seam" aria-hidden="true">
          <div
            className={`h-full rounded-full ${allDone ? 'bg-done' : 'bg-action'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="sr-only">
          {completed} of {total} clothes completed
        </p>
      </div>

      <ul className="divide-y divide-seam rounded-lg border border-seam bg-white">
        {cloths.map((cloth) => {
          const stage = clothStageBadge(cloth);
          const done = cloth.status === 'completed';
          const cutterDue = dueLine('Cutter', cloth.cutterExpectedDate, done || cloth.status !== 'cutting');
          const tailorDue = dueLine(
            'Tailor',
            cloth.tailorExpectedDate,
            done || cloth.status === 'cutting',
          );
          const deliveryDue = dueLine('Delivery', cloth.deliveryDate, done);

          return (
            <li key={cloth.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{clothBillName(cloth)}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{cloth.code}</p>
                </div>
                <Badge className={`shrink-0 ${stage.className}`}>{stage.label}</Badge>
              </div>

              <dl className="mt-2 grid grid-cols-1 gap-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Cutter</dt>
                  <dd className="min-w-0 text-right font-medium text-ink">
                    {assignedName(staff, cloth.cutterId)}
                    {cloth.cutterExpectedDate ? (
                      <span className={cutterDue.overdue ? ' text-overdue' : ' text-ink-muted'}>
                        {' · '}
                        {cutterDue.value}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Tailor</dt>
                  <dd className="min-w-0 text-right font-medium text-ink">
                    {assignedName(staff, cloth.tailorId)}
                    {cloth.tailorExpectedDate ? (
                      <span className={tailorDue.overdue ? ' text-overdue' : ' text-ink-muted'}>
                        {' · '}
                        {tailorDue.value}
                      </span>
                    ) : null}
                  </dd>
                </div>
                {cloth.deliveryDate ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Delivery</dt>
                    <dd className={`font-medium ${deliveryDue.overdue ? 'text-overdue' : 'text-ink'}`}>
                      {deliveryDue.value}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
