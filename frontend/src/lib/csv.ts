import type { Child, Pregnancy } from "./types";

// Export and import share these columns, so an exported file can be edited in Excel
// and imported back. Import also accepts the raw field names as headers.
export type CsvColumn<T> = { key: keyof T & string; header: string; exportOnly?: boolean };

export const CHILD_CSV_COLUMNS: CsvColumn<Child>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "ชื่อเด็ก" },
  { key: "age", header: "อายุ" },
  { key: "house_number", header: "บ้านเลขที่" },
  { key: "village_no", header: "หมู่" },
  { key: "village_name", header: "ชื่อหมู่บ้าน" },
  { key: "tambon", header: "ตำบล" },
  { key: "amphoe", header: "อำเภอ" },
  { key: "province", header: "จังหวัด" },
  { key: "latitude", header: "Latitude" },
  { key: "longitude", header: "Longitude" },
  { key: "hct", header: "Hct (%)" },
  { key: "weight_kg", header: "น้ำหนัก (กก.)" },
  { key: "height_cm", header: "ส่วนสูง (ซม.)" },
  { key: "nutrition_status", header: "สถานะโภชนาการ" },
  { key: "iron_status", header: "ยาเสริมธาตุเหล็ก" },
  { key: "food_behavior", header: "การกินอาหารธาตุเหล็กสูง" },
  { key: "social_status", header: "การดูแลและเศรษฐานะ" },
  { key: "caregiver_name", header: "ผู้ดูแล" },
  { key: "notes", header: "หมายเหตุ" },
  { key: "total_score", header: "คะแนนรวม", exportOnly: true },
  { key: "risk_level", header: "ระดับความเสี่ยง", exportOnly: true },
  { key: "last_medication_at", header: "กินยาล่าสุด", exportOnly: true },
];

export const PREG_CSV_COLUMNS: CsvColumn<Pregnancy>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "ชื่อ-นามสกุล" },
  { key: "age_years", header: "อายุ (ปี)" },
  { key: "house_number", header: "บ้านเลขที่" },
  { key: "village_no", header: "หมู่" },
  { key: "village_name", header: "ชื่อหมู่บ้าน" },
  { key: "tambon", header: "ตำบล" },
  { key: "amphoe", header: "อำเภอ" },
  { key: "province", header: "จังหวัด" },
  { key: "latitude", header: "Latitude" },
  { key: "longitude", header: "Longitude" },
  { key: "husband_name", header: "สามี/ผู้ดูแล" },
  { key: "phone", header: "เบอร์โทร" },
  { key: "lmp_date", header: "LMP (ปปปป-ดด-วว)" },
  { key: "delivered_on", header: "วันที่คลอด" },
  { key: "hct", header: "Hct (%)" },
  { key: "pre_weight_kg", header: "น้ำหนักก่อนตั้งครรภ์ (กก.)" },
  { key: "current_weight_kg", header: "น้ำหนักปัจจุบัน (กก.)" },
  { key: "height_cm", header: "ส่วนสูง (ซม.)" },
  { key: "weight_gain", header: "น้ำหนักขึ้น" },
  { key: "iron_status", header: "การกิน Triferdine" },
  { key: "food_behavior", header: "การกินอาหารธาตุเหล็กสูง" },
  { key: "social_status", header: "การดูแลและเศรษฐานะ" },
  { key: "risk_factors", header: "ปัจจัยเสี่ยง (คั่นด้วย |)" },
  { key: "notes", header: "หมายเหตุ" },
  { key: "total_score", header: "คะแนนรวม", exportOnly: true },
  { key: "risk_level", header: "ระดับความเสี่ยง", exportOnly: true },
  { key: "last_medication_at", header: "กินยาล่าสุด", exportOnly: true },
];

function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("|") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => c.header).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c.key])).join(","));
  return "\uFEFF" + lines.join("\r\n"); // BOM so Excel reads Thai as UTF-8
}

export function downloadCSV(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// RFC 4180 parser: quoted fields, escaped quotes, newlines inside quotes.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Maps CSV rows to objects by header. Unknown and export-only columns are ignored.
export function csvToRows<T>(text: string, columns: CsvColumn<T>[]): { rows: Record<string, string>[]; unknownHeaders: string[] } {
  const [header, ...rows] = parseCSV(text);
  if (!header) return { rows: [], unknownHeaders: [] };
  const keys = header.map((h) => {
    const t = h.trim();
    const col = columns.find((c) => c.header === t || c.key === t);
    return col && !col.exportOnly ? col.key : null;
  });
  const unknownHeaders = header.filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean);
  return {
    rows: rows.map((r) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, i) => { if (k) obj[k] = (r[i] ?? "").trim(); });
      return obj;
    }),
    unknownHeaders,
  };
}
