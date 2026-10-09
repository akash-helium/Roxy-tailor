import { Button, Input } from './ui';
import { todayDateString, tomorrowDateString } from '../lib/utils';

export function DeliveryDayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const today = todayDateString();
  const tomorrow = tomorrowDateString();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-[11.5rem]">
        <Input
          label="Delivery date"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <Button type="button" size="sm" variant={value === today ? 'primary' : 'secondary'} onClick={() => onChange(today)}>
        Today
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === tomorrow ? 'primary' : 'secondary'}
        onClick={() => onChange(tomorrow)}
      >
        Tomorrow
      </Button>
      {value ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
          All dates
        </Button>
      ) : null}
    </div>
  );
}
