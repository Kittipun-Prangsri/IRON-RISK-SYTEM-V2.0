import type { Child } from "./types";

// Export and import share these columns, so an exported file can be edited in Excel
// and imported back. Import also accepts the raw field names as headers.
export const CSV_COLUMNS: { key: keyof Child; header: string; exportOnly?: boolean }[] = [
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

function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function childrenToCSV(children: Child[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const child of children) lines.push(CSV_COLUMNS.map((c) => escapeCell(child[c.key])).join(","));
  return "﻿" + lines.join("\r\n"); // BOM so Excel reads Thai as UTF-8
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
  const s = text.replace(/^﻿/, "");
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

// Maps CSV rows to child objects by header. Unknown columns are ignored.
export function csvToChildren(text: string): { children: Record<string, string>[]; unknownHeaders: string[] } {
  const [header, ...rows] = parseCSV(text);
  if (!header) return { children: [], unknownHeaders: [] };
  const keys = header.map((h) => {
    const t = h.trim();
    const col = CSV_COLUMNS.find((c) => c.header === t || c.key === t);
    return col && !col.exportOnly ? col.key : null;
  });
  const unknownHeaders = header.filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean);
  const children = rows.map((r) => {
    const obj: Record<string, string> = {};
    keys.forEach((k, i) => { if (k) obj[k] = (r[i] ?? "").trim(); });
    return obj;
  });
  return { children, unknownHeaders };
}
