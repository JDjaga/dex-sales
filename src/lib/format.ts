export function formatCents(cents: number, currency = 'USD'): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function calcLineTotalCents(
  quantityThousandths: number,
  unitPriceCents: number,
  discountCents: number
): number {
  const gross = Math.round((quantityThousandths * unitPriceCents) / 1000);
  return Math.max(0, gross - Math.max(0, discountCents));
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isPastDate(dateIso: string): boolean {
  if (!dateIso) return false;
  return dateIso.slice(0, 10) < todayIso();
}

export function isFutureDate(dateIso: string): boolean {
  if (!dateIso) return false;
  return dateIso.slice(0, 10) > todayIso();
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|llc|corp|corporation|plc|gmbh|ag|sa|pte|co)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areOrgNamesSimilar(a: string, b: string): boolean {
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  // Token overlap check
  const ta = new Set(na.split(' ').filter((w) => w.length > 2));
  const tb = new Set(nb.split(' ').filter((w) => w.length > 2));
  if (ta.size > 0 && tb.size > 0) {
    let overlap = 0;
    for (const t of ta) {
      if (tb.has(t)) overlap++;
    }
    if (overlap >= Math.min(ta.size, tb.size) && overlap >= 1) return true;
  }
  return false;
}

const DIAL_CODES: Record<string, string> = {
  'United States': '+1',
  Canada: '+1',
  'United Kingdom': '+44',
  Singapore: '+65',
  India: '+91',
  Germany: '+49',
  France: '+33',
  Switzerland: '+41',
  'United Arab Emirates': '+971',
  Japan: '+81',
  Australia: '+61',
  Kenya: '+254',
  Nigeria: '+234',
  Brazil: '+55',
};

export function normalizePhone(rawPhone: string, country: string): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  const prefix = DIAL_CODES[country] || '+';
  return prefix === '+' ? `+${digits}` : `${prefix}${digits}`;
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

export function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n') + '\n';
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Singapore',
  'Switzerland',
  'Germany',
  'France',
  'Canada',
  'United Arab Emirates',
  'India',
  'Japan',
  'Australia',
  'Kenya',
  'Nigeria',
  'Brazil',
  'Other',
];
