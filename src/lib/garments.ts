export type GarmentGender = 'male' | 'female';

export type MeasurementFieldType = 'number' | 'boolean' | 'select';

export type MeasurementOption = {
  id: string;
  label: string;
};

export type MeasurementField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: MeasurementFieldType;
  options?: MeasurementOption[];
};

export type GarmentType = {
  id: string;
  label: string;
  gender: GarmentGender;
  fields: MeasurementField[];
  /** Supabase row id (admin catalog only) */
  dbId?: string;
};

const shirtMale: MeasurementField[] = [
  { id: 'chest', label: 'Chest', placeholder: '40' },
  { id: 'waist', label: 'Waist', placeholder: '34' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '18' },
  { id: 'sleeve', label: 'Sleeve Length', placeholder: '24' },
  { id: 'length', label: 'Shirt Length', placeholder: '30' },
  { id: 'neck', label: 'Neck', placeholder: '15.5' },
  { id: 'bicep', label: 'Bicep', placeholder: '14' },
];

const pantMale: MeasurementField[] = [
  { id: 'waist', label: 'Waist', placeholder: '34' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'thigh', label: 'Thigh', placeholder: '22' },
  { id: 'knee', label: 'Knee', placeholder: '16' },
  { id: 'inseam', label: 'Inseam', placeholder: '40' },
  { id: 'outseam', label: 'Outseam', placeholder: '42' },
  { id: 'bottom', label: 'Bottom', placeholder: '16' },
];

const coatMale: MeasurementField[] = [
  { id: 'chest', label: 'Chest', placeholder: '42' },
  { id: 'waist', label: 'Waist', placeholder: '36' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '18.5' },
  { id: 'sleeve', label: 'Sleeve Length', placeholder: '25' },
  { id: 'length', label: 'Coat Length', placeholder: '32' },
  { id: 'back', label: 'Back Width', placeholder: '17' },
];

const jacketMale: MeasurementField[] = [
  { id: 'chest', label: 'Chest', placeholder: '40' },
  { id: 'waist', label: 'Waist', placeholder: '34' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '18' },
  { id: 'sleeve', label: 'Sleeve Length', placeholder: '24' },
  { id: 'length', label: 'Jacket Length', placeholder: '28' },
];

const pyjamaMale: MeasurementField[] = [
  { id: 'waist', label: 'Waist', placeholder: '34' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'thigh', label: 'Thigh', placeholder: '24' },
  { id: 'inseam', label: 'Inseam', placeholder: '38' },
  { id: 'bottom', label: 'Bottom', placeholder: '14' },
];

const safariMale: MeasurementField[] = [
  { id: 'top_chest', label: 'Top Chest', placeholder: '40' },
  { id: 'top_waist', label: 'Top Waist', placeholder: '34' },
  { id: 'top_shoulder', label: 'Top Shoulder', placeholder: '18' },
  { id: 'top_sleeve', label: 'Top Sleeve', placeholder: '24' },
  { id: 'top_length', label: 'Top Length', placeholder: '30' },
  { id: 'pant_waist', label: 'Pant Waist', placeholder: '34' },
  { id: 'pant_hip', label: 'Pant Hip', placeholder: '38' },
  { id: 'pant_inseam', label: 'Pant Inseam', placeholder: '40' },
  { id: 'pant_bottom', label: 'Pant Bottom', placeholder: '16' },
];

const waistcoatMale: MeasurementField[] = [
  { id: 'chest', label: 'Chest', placeholder: '40' },
  { id: 'waist', label: 'Waist', placeholder: '34' },
  { id: 'length', label: 'Length', placeholder: '24' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '17' },
];

const sherwaniMale: MeasurementField[] = [
  { id: 'chest', label: 'Chest', placeholder: '42' },
  { id: 'waist', label: 'Waist', placeholder: '36' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '18' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '24' },
  { id: 'length', label: 'Sherwani Length', placeholder: '44' },
  { id: 'collar', label: 'Collar', placeholder: '16' },
  { id: 'bicep', label: 'Bicep', placeholder: '15' },
];

const shirtFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '14' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '22' },
  { id: 'length', label: 'Length', placeholder: '26' },
];

const pantFemale: MeasurementField[] = [
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'thigh', label: 'Thigh', placeholder: '22' },
  { id: 'inseam', label: 'Inseam', placeholder: '38' },
  { id: 'bottom', label: 'Bottom', placeholder: '14' },
];

const coatFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '14' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '22' },
  { id: 'length', label: 'Coat Length', placeholder: '32' },
];

const jacketFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '14' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '22' },
  { id: 'length', label: 'Jacket Length', placeholder: '26' },
];

const pyjamaFemale: MeasurementField[] = [
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'thigh', label: 'Thigh', placeholder: '22' },
  { id: 'inseam', label: 'Inseam', placeholder: '36' },
  { id: 'bottom', label: 'Bottom', placeholder: '12' },
];

const safariFemale: MeasurementField[] = [
  { id: 'top_bust', label: 'Top Bust', placeholder: '36' },
  { id: 'top_waist', label: 'Top Waist', placeholder: '30' },
  { id: 'top_shoulder', label: 'Top Shoulder', placeholder: '14' },
  { id: 'top_sleeve', label: 'Top Sleeve', placeholder: '22' },
  { id: 'top_length', label: 'Top Length', placeholder: '26' },
  { id: 'pant_waist', label: 'Pant Waist', placeholder: '30' },
  { id: 'pant_hip', label: 'Pant Hip', placeholder: '38' },
  { id: 'pant_inseam', label: 'Pant Inseam', placeholder: '38' },
];

const waistcoatFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'length', label: 'Length', placeholder: '20' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '13' },
];

const sherwaniFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '14' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '22' },
  { id: 'length', label: 'Sherwani Length', placeholder: '42' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
];

const kurtiFemale: MeasurementField[] = [
  { id: 'bust', label: 'Bust', placeholder: '36' },
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'shoulder', label: 'Shoulder', placeholder: '14' },
  { id: 'sleeve', label: 'Sleeve', placeholder: '22' },
  { id: 'length', label: 'Kurti Length', placeholder: '42' },
  { id: 'slit', label: 'Slit', placeholder: '18' },
];

const lehengaFemale: MeasurementField[] = [
  { id: 'waist', label: 'Waist', placeholder: '30' },
  { id: 'hip', label: 'Hip', placeholder: '38' },
  { id: 'length', label: 'Lehenga Length', placeholder: '42' },
  { id: 'flare', label: 'Flare', placeholder: '120' },
];

export const GARMENT_CATALOG: GarmentType[] = [
  { id: 'shirt_male', label: 'Shirt', gender: 'male', fields: shirtMale },
  { id: 'pant_male', label: 'Pant', gender: 'male', fields: pantMale },
  { id: 'coat_male', label: 'Coat', gender: 'male', fields: coatMale },
  { id: 'jacket_male', label: 'Jacket', gender: 'male', fields: jacketMale },
  { id: 'pyjama_male', label: 'Pyjama', gender: 'male', fields: pyjamaMale },
  { id: 'safari_male', label: 'Safari Suit', gender: 'male', fields: safariMale },
  { id: 'waistcoat_male', label: 'Waistcoat', gender: 'male', fields: waistcoatMale },
  { id: 'sherwani_male', label: 'Sherwani', gender: 'male', fields: sherwaniMale },
  { id: 'shirt_female', label: 'Shirt / Kurti', gender: 'female', fields: shirtFemale },
  { id: 'kurti_female', label: 'Kurti', gender: 'female', fields: kurtiFemale },
  { id: 'pant_female', label: 'Pant / Salwar', gender: 'female', fields: pantFemale },
  { id: 'coat_female', label: 'Coat / Blazer', gender: 'female', fields: coatFemale },
  { id: 'jacket_female', label: 'Jacket', gender: 'female', fields: jacketFemale },
  { id: 'pyjama_female', label: 'Pyjama / Salwar', gender: 'female', fields: pyjamaFemale },
  { id: 'safari_female', label: 'Safari Suit', gender: 'female', fields: safariFemale },
  { id: 'waistcoat_female', label: 'Waistcoat', gender: 'female', fields: waistcoatFemale },
  { id: 'sherwani_female', label: 'Sherwani', gender: 'female', fields: sherwaniFemale },
  { id: 'lehenga_female', label: 'Lehenga', gender: 'female', fields: lehengaFemale },
];

export const GARMENT_GENDER_LABELS: Record<GarmentGender, string> = {
  male: 'Male',
  female: 'Female',
};

let activeCatalog: GarmentType[] = [...GARMENT_CATALOG];

export function setActiveGarmentCatalog(catalog: GarmentType[]) {
  activeCatalog = catalog;
}

export function getGarmentCatalog() {
  return activeCatalog;
}

export function getGarmentsByGender(gender: GarmentGender) {
  return activeCatalog.filter((item) => item.gender === gender);
}

export function getGarmentType(id: string | null | undefined) {
  if (!id) return null;
  return activeCatalog.find((item) => item.id === id) ?? null;
}

export function garmentDisplayLabel(garmentType: string | null, garment: string) {
  const type = getGarmentType(garmentType);
  if (!type) return garment;
  const gender = GARMENT_GENDER_LABELS[type.gender];
  return `${type.label} (${gender})`;
}

function slugifyPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function measurementFieldType(field: MeasurementField): MeasurementFieldType {
  if (field.type === 'boolean' || field.type === 'select') return field.type;
  return 'number';
}

export function isMeasurementOn(value?: string | null) {
  return /^(yes|true|1|on)$/i.test((value ?? '').trim());
}

export function normalizeMeasurementField(raw: unknown): MeasurementField | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const label = String(item.label ?? '').trim();
  const id = String(item.id ?? '').trim() || slugifyPart(label);
  if (!id && !label) return null;
  const type = measurementFieldType({
    id,
    label,
    type: item.type === 'boolean' || item.type === 'select' ? item.type : 'number',
  });
  const options = Array.isArray(item.options)
    ? item.options
        .map((option) => {
          if (typeof option === 'string') {
            const text = option.trim();
            if (!text) return null;
            return { id: slugifyPart(text) || text, label: text };
          }
          if (!option || typeof option !== 'object') return null;
          const record = option as Record<string, unknown>;
          const optionLabel = String(record.label ?? record.id ?? '').trim();
          if (!optionLabel) return null;
          return {
            id: String(record.id ?? '').trim() || slugifyPart(optionLabel) || optionLabel,
            label: optionLabel,
          };
        })
        .filter((option): option is MeasurementOption => Boolean(option))
    : [];

  return {
    id,
    label: label || id,
    placeholder: item.placeholder ? String(item.placeholder) : undefined,
    type,
    options: type === 'select' ? options : undefined,
  };
}

export function normalizeMeasurementFields(value: unknown): MeasurementField[] {
  let raw: unknown = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeMeasurementField(item))
    .filter((item): item is MeasurementField => Boolean(item));
}

export function emptyMeasurementsForGarment(garmentTypeId: string, catalog = activeCatalog) {
  const garment = catalog.find((item) => item.id === garmentTypeId) ?? getGarmentType(garmentTypeId);
  if (!garment) return {};
  return Object.fromEntries(garment.fields.map((field) => [field.id, '']));
}
