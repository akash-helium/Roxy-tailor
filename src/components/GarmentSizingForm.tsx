import { useMemo, type ReactNode } from "react";
import { useGarmentCatalog } from "../contexts/GarmentCatalogContext";
import {
  emptyMeasurementsForGarment,
  GARMENT_GENDER_LABELS,
  isMeasurementOn,
  measurementFieldType,
} from "../lib/garments";
import type { MeasurementData } from "../lib/measurements";
import { Input, Select } from "./ui";

type GarmentSizingValue = MeasurementData;

export function GarmentSizingForm({
  value,
  onChange,
  afterClothType,
  layout = 'stack',
  rememberedSizing,
}: {
  value: GarmentSizingValue;
  onChange: (next: GarmentSizingValue) => void;
  afterClothType?: ReactNode;
  layout?: 'stack' | 'wide';
  rememberedSizing?: (
    garmentType: string,
  ) => { gender?: GarmentSizingValue['gender']; measurements: Record<string, string> } | null;
}) {
  const { catalog, loading, error, reload } = useGarmentCatalog();

  const garments = useMemo(
    () =>
      [...catalog].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    [catalog],
  );

  const garment = useMemo(
    () => catalog.find((item) => item.id === value.garmentType) ?? null,
    [catalog, value.garmentType],
  );
  const rememberedForCurrent = value.garmentType ? rememberedSizing?.(value.garmentType) ?? null : null;
  const hasRememberedSizes = Boolean(
    rememberedForCurrent &&
      Object.values(rememberedForCurrent.measurements).some((item) => String(item ?? '').trim()),
  );

  function setGarmentType(garmentType: string) {
    const selected = catalog.find((item) => item.id === garmentType);
    const empty = emptyMeasurementsForGarment(garmentType, catalog);
    const remembered = garmentType ? rememberedSizing?.(garmentType) : null;
    onChange({
      ...value,
      garmentType,
      gender: selected?.gender ?? remembered?.gender ?? value.gender,
      measurements: remembered?.measurements
        ? { ...empty, ...remembered.measurements }
        : empty,
    });
  }

  function setMeasurement(fieldId: string, measurement: string) {
    onChange({
      ...value,
      measurements: { ...value.measurements, [fieldId]: measurement },
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 text-xs font-semibold text-action underline"
          >
            Retry loading cloth types
          </button>
        </div>
      )}

      <div className={layout === 'wide' ? 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:items-start' : undefined}>
        <div>
          <Select
            label="Cloth Type"
            value={value.garmentType}
            onChange={(e) => setGarmentType(e.target.value)}
            required
            disabled={loading}
            placeholder={
              loading
                ? "Loading cloth types..."
                : garments.length === 0
                  ? "No cloth types available"
                  : "Select cloth type"
            }
          >
            <option value="">
              {loading
                ? "Loading cloth types..."
                : garments.length === 0
                  ? "No cloth types available"
                  : "Select cloth type"}
            </option>
            {garments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({GARMENT_GENDER_LABELS[item.gender]})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[10px] text-slate-400">
            {loading
              ? "Fetching cloth types from cloud…"
              : garments.length === 0
                ? "No cloth types found in database."
                : `${garments.length} cloth type${garments.length === 1 ? "" : "s"} loaded from database.`}
          </p>
        </div>
        {afterClothType}
      </div>

      {garment && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Measurements
            {garment.fields.some((field) => measurementFieldType(field) === 'number') ? (
              <span className="font-normal text-slate-400"> (inches)</span>
            ) : null}
          </p>
          {hasRememberedSizes ? (
            <p className="mb-2 text-xs font-medium text-action">
              Last sizes for this person were filled. You can edit them.
            </p>
          ) : null}
          <div className={layout === 'wide' ? 'grid grid-cols-2 gap-3 lg:grid-cols-3' : 'grid grid-cols-2 gap-3'}>
            {garment.fields.map((field) => {
              const kind = measurementFieldType(field);
              if (kind === 'boolean') {
                const checked = isMeasurementOn(value.measurements[field.id]);
                return (
                  <label
                    key={field.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setMeasurement(field.id, event.target.checked ? 'yes' : '')
                      }
                      className="h-5 w-5 shrink-0 rounded border-seam accent-action"
                    />
                    <span className="text-sm font-medium text-slate-800">{field.label}</span>
                  </label>
                );
              }
              if (kind === 'select') {
                return (
                  <div key={field.id} className="col-span-2">
                    <Select
                      label={field.label}
                      value={value.measurements[field.id] ?? ''}
                      onChange={(event) => setMeasurement(field.id, event.target.value)}
                    >
                      <option value="">Select {field.label}</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              }
              return (
                <Input
                  key={field.id}
                  label={field.label}
                  type="text"
                  inputMode="decimal"
                  value={value.measurements[field.id] ?? ''}
                  onChange={(event) => setMeasurement(field.id, event.target.value)}
                  placeholder={field.placeholder ?? '0'}
                />
              );
            })}
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-action/20 bg-action/5 px-4 py-3">
        <input
          type="checkbox"
          checked={value.inGroup}
          onChange={(e) => onChange({ ...value, inGroup: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-seam accent-action"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800">
            Image in Whatsapp Group
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Check if this cloth is in the IN group. No photo required.
          </span>
        </span>
      </label>
    </div>
  );
}

export const emptyGarmentSizing: GarmentSizingValue = {
  garmentType: "",
  gender: "male",
  measurements: {},
  inGroup: false,
};
