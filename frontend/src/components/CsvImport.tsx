"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet } from "lucide-react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { csvToRows, type CsvColumn } from "@/lib/csv";
import { useToast } from "./AppContext";
import { Modal, btn, inputInline } from "./ui";

// Import a CSV into a registry. Rows are mapped by header (see lib/csv.ts columns);
// the server validates everything and rejects the whole file if any row is bad.
export function CsvImport<T>({ columns, importPath, doneHref }: { columns: CsvColumn<T>[]; importPath: string; doneHref: string }) {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [encoding, setEncoding] = useState("utf-8");
  const [preview, setPreview] = useState<{ file: string; rows: Record<string, string>[]; unknownHeaders: string[] } | null>(null);
  const [errors, setErrors] = useState<{ row: number; name: string; error: string }[] | null>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = new TextDecoder(encoding).decode(await file.arrayBuffer());
    const parsed = csvToRows(text, columns);
    if (parsed.rows.length === 0) return toast("ไม่พบข้อมูลในไฟล์ CSV", "error");
    setErrors(null);
    setPreview({ file: file.name, ...parsed });
  }

  async function doImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const r = await api<{ inserted: number; updated: number }>(importPath, { method: "POST", body: { rows: preview.rows } });
      toast(`นำเข้าสำเร็จ: เพิ่มใหม่ ${r.inserted} คน, อัปเดต ${r.updated} คน`);
      setPreview(null);
      router.push(doneHref);
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      else toast(errorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <select value={encoding} onChange={(e) => setEncoding(e.target.value)} className={inputInline} title="การเข้ารหัสไฟล์">
        <option value="utf-8">UTF-8</option>
        <option value="windows-874">TIS-620 (Excel ภาษาไทย)</option>
      </select>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <button type="button" onClick={() => fileRef.current?.click()} className={btn.secondary}><Upload size={16} /> นำเข้า CSV</button>

      {preview && (
        <Modal title={<span className="flex items-center gap-2"><FileSpreadsheet size={20} /> นำเข้าข้อมูลจาก CSV</span>} onClose={() => setPreview(null)} footer={<>
          <button onClick={() => setPreview(null)} className={btn.secondary}>ยกเลิก</button>
          <button onClick={doImport} disabled={importing} className={btn.primary}>{importing ? "กำลังนำเข้า..." : `นำเข้า ${preview.rows.length} แถว`}</button>
        </>}>
          <div className="space-y-3 text-sm">
            <p>ไฟล์ <b>{preview.file}</b>: พบข้อมูล <b>{preview.rows.length}</b> แถว</p>
            <p className="text-slate-500">แถวที่มี ID ตรงกับข้อมูลเดิมจะถูกอัปเดต แถวอื่นจะเพิ่มเป็นรายการใหม่ ถ้ามีแถวใดผิดพลาดจะไม่นำเข้าเลยทั้งไฟล์</p>
            {preview.unknownHeaders.length > 0 && (
              <p className="text-amber-700 bg-amber-50 rounded-lg p-2">คอลัมน์ที่ไม่รู้จักจะถูกข้าม: {preview.unknownHeaders.join(", ")}</p>
            )}
            <ul className="list-disc pl-5 text-slate-600 max-h-40 overflow-y-auto">
              {preview.rows.slice(0, 10).map((c, i) => <li key={i}>{c.name || <i className="text-red-500">ไม่มีชื่อ</i>} {c.village_name && `· ${c.village_name}`}</li>)}
              {preview.rows.length > 10 && <li>และอีก {preview.rows.length - 10} แถว</li>}
            </ul>
            {errors && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 max-h-48 overflow-y-auto">
                <p className="font-medium mb-1">พบข้อมูลไม่ถูกต้อง {errors.length} แถว (ยังไม่ได้นำเข้า):</p>
                <ul className="list-disc pl-5">{errors.map((e) => <li key={e.row}>แถว {e.row + 1} {e.name}: {e.error}</li>)}</ul>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
