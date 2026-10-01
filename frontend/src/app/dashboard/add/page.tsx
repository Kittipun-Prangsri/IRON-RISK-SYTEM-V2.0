"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, RotateCcw, ArrowLeft, Upload, FileSpreadsheet, MapPin } from "lucide-react";
import { ApiError, api, errorMessage } from "@/lib/api";
import {
  AGE_OPTIONS, FOOD_OPTIONS, IRON_OPTIONS, KHLONG_HAT_VILLAGES, NUTRITION_OPTIONS, SAKAEO_DISTRICTS, SOCIAL_OPTIONS, computeScore
} from "@/lib/constants";
import { csvToChildren } from "@/lib/csv";
import type { Child } from "@/lib/types";
import { isStaff, useMe, useToast } from "@/components/AppContext";
import { Card, ErrorBox, Field, Loading, Modal, PageHeader, RiskBadge, btn, input } from "@/components/ui";

const FIELDS = [
  "name", "age", "caregiver_name", "province", "amphoe", "tambon", "house_number", "village_no", "village_name",
  "latitude", "longitude", "notes", "hct", "weight_kg", "height_cm", "nutrition_status", "iron_status", "food_behavior", "social_status",
] as const;
type Form = Record<(typeof FIELDS)[number], string>;

const EMPTY: Form = {
  name: "", age: "4 ปี", caregiver_name: "", province: "สระแก้ว", amphoe: "คลองหาด", tambon: "คลองหาด",
  house_number: "", village_no: "1", village_name: "บ้านคลองหาด", latitude: "", longitude: "", notes: "",
  hct: "", weight_kg: "", height_cm: "", nutrition_status: "สมส่วน", iron_status: "สม่ำเสมอ",
  food_behavior: "เป็นประจำ", social_status: "เพียงพอ",
};

const toForm = (c: Child): Form =>
  Object.fromEntries(FIELDS.map((f) => [f, c[f] == null ? "" : String(c[f])])) as Form;

const isKhlongHat = (f: Form) => f.amphoe === "คลองหาด" && f.tambon === "คลองหาด";

function AddContent() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const [form, setForm] = useState<Form>(EMPTY);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    api<Child>(`/children/${encodeURIComponent(editId)}`)
      .then((c) => setForm(toForm(c)))
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [editId]);

  if (!isStaff(me)) return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับเจ้าหน้าที่ รพ. เท่านั้น" /></div>;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const district = SAKAEO_DISTRICTS.find((d) => d.name === form.amphoe);
  const score = computeScore(form);

  function fillMyLocation() {
    if (!navigator.geolocation) return toast("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง", "error");
    navigator.geolocation.getCurrentPosition(
      (p) => set({ latitude: p.coords.latitude.toFixed(7), longitude: p.coords.longitude.toFixed(7) }),
      () => toast("ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = editId
        ? await api<Child>(`/children/${encodeURIComponent(editId)}`, { method: "PUT", body: form })
        : await api<Child>("/children", { method: "POST", body: form });
      toast(`${editId ? "แก้ไข" : "เพิ่ม"}ข้อมูล ${saved.name} แล้ว (${saved.risk_level} ${saved.total_score}/10)`);
      router.push("/dashboard/children");
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (loadError) return <div className="p-6"><ErrorBox message={loadError} /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={editId ? "แก้ไขข้อมูลเด็ก" : "เพิ่มข้อมูลเด็ก"}
        subtitle="กรอกข้อมูลเด็กและผลตรวจสุขภาพ ระบบจะคำนวณคะแนนความเสี่ยงให้อัตโนมัติ"
        actions={!editId && <CsvImport />}
      />

      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <Card title="ข้อมูลส่วนตัวและที่อยู่" className="p-0">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="ชื่อเด็ก" required className="md:col-span-2">
                <input required value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="ด.ช. / ด.ญ. ชื่อ นามสกุล" className={input} />
              </Field>
              <Field label="อายุ">
                <select value={form.age} onChange={(e) => set({ age: e.target.value })} className={input}>
                  {!AGE_OPTIONS.includes(form.age) && form.age && <option value={form.age}>{form.age}</option>}
                  {AGE_OPTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="ผู้ดูแล">
                <input value={form.caregiver_name} onChange={(e) => set({ caregiver_name: e.target.value })} placeholder="ชื่อผู้ดูแล" className={input} />
              </Field>
              <Field label="อำเภอ (จ.สระแก้ว)">
                <select value={form.amphoe} onChange={(e) => {
                  const d = SAKAEO_DISTRICTS.find((x) => x.name === e.target.value);
                  set({ amphoe: e.target.value, tambon: d?.sub_districts[0]?.name ?? "", village_name: "", village_no: "" });
                }} className={input}>
                  {SAKAEO_DISTRICTS.map((d) => <option key={d.name}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="ตำบล">
                <select value={form.tambon} onChange={(e) => {
                  const next = { ...form, tambon: e.target.value };
                  set(isKhlongHat(next) ? { tambon: e.target.value, village_no: "1", village_name: "บ้านคลองหาด" } : { tambon: e.target.value, village_no: "", village_name: "" });
                }} className={input}>
                  {district?.sub_districts.map((s) => <option key={s.name}>{s.name}</option>)}
                </select>
              </Field>
              {isKhlongHat(form) ? (
                <Field label="หมู่บ้าน">
                  <select value={form.village_no} onChange={(e) => {
                    const v = KHLONG_HAT_VILLAGES.find((x) => String(x.moo) === e.target.value);
                    set({ village_no: e.target.value, village_name: v?.name ?? "" });
                  }} className={input}>
                    <option value="">-- เลือกหมู่บ้าน --</option>
                    {KHLONG_HAT_VILLAGES.map((v) => <option key={v.moo} value={v.moo}>หมู่ {v.moo} {v.name}</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="หมู่ที่"><input type="number" min={1} value={form.village_no} onChange={(e) => set({ village_no: e.target.value })} className={input} /></Field>
                  <Field label="ชื่อหมู่บ้าน"><input value={form.village_name} onChange={(e) => set({ village_name: e.target.value })} className={input} /></Field>
                </>
              )}
              <Field label="บ้านเลขที่"><input value={form.house_number} onChange={(e) => set({ house_number: e.target.value })} placeholder="เช่น 12/3" className={input} /></Field>
              <Field label="Latitude"><input type="number" step="any" value={form.latitude} onChange={(e) => set({ latitude: e.target.value })} placeholder="เช่น 13.453589" className={input} /></Field>
              <Field label="Longitude"><input type="number" step="any" value={form.longitude} onChange={(e) => set({ longitude: e.target.value })} placeholder="เช่น 102.299076" className={input} /></Field>
              <div className="flex items-end">
                <button type="button" onClick={fillMyLocation} className={btn.secondary}><MapPin size={16} /> ใช้ตำแหน่งปัจจุบัน</button>
              </div>
              <Field label="หมายเหตุ" className="md:col-span-3">
                <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="เช่น ขนาดยาที่เด็กกิน, ค่า Hct ก่อน-หลัง" className={input} />
              </Field>
            </div>
          </Card>

          <Card title="ผลการเจริญเติบโตและผลเลือด" className="p-0">
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Hct (%)"><input type="number" step="0.1" min={1} max={80} value={form.hct} onChange={(e) => set({ hct: e.target.value })} placeholder="เช่น 35" className={input} /></Field>
              <Field label="น้ำหนัก (กก.)"><input type="number" step="0.01" min={0.5} max={100} value={form.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} placeholder="เช่น 15.5" className={input} /></Field>
              <Field label="ส่วนสูง (ซม.)"><input type="number" step="0.1" min={20} max={200} value={form.height_cm} onChange={(e) => set({ height_cm: e.target.value })} placeholder="เช่น 100" className={input} /></Field>
              <Field label="สถานะโภชนาการ">
                <select value={form.nutrition_status} onChange={(e) => set({ nutrition_status: e.target.value })} className={input}>
                  <option value="">ไม่ระบุ</option>
                  {NUTRITION_OPTIONS.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="การประเมินความเสี่ยง มิติที่ 3-5" className="p-0">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="มิติที่ 3: การได้รับยาเสริมธาตุเหล็ก">
                <select value={form.iron_status} onChange={(e) => set({ iron_status: e.target.value })} className={input}>
                  {form.iron_status === "ได้" && <option value="ได้">ได้รับยา (ยังไม่ประเมินความสม่ำเสมอ)</option>}
                  {IRON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="มิติที่ 4: การกินอาหารธาตุเหล็กสูง">
                <select value={form.food_behavior} onChange={(e) => set({ food_behavior: e.target.value })} className={input}>
                  <option value="">ยังไม่ประเมิน</option>
                  {FOOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="มิติที่ 5: การดูแลและเศรษฐานะ">
                <select value={form.social_status} onChange={(e) => set({ social_status: e.target.value })} className={input}>
                  <option value="">ยังไม่ประเมิน</option>
                  {SOCIAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </Card>
        </div>

        <div className="xl:sticky xl:top-0 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-sm text-slate-500">คะแนนความเสี่ยง (คำนวณอัตโนมัติ)</p>
          <p className="font-kanit"><span className="text-4xl font-bold">{score.total}</span> <span className="text-slate-500">/ 10</span></p>
          <RiskBadge level={score.risk} />
          <p className="text-xs text-slate-500">Hct {score.hctScore} · โภชนาการ {score.nutritionScore} · ยาเหล็ก {score.ironScore} · อาหาร {score.foodScore} · ครอบครัว {score.socialScore}</p>
          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={saving} className={btn.primary}><Save size={16} /> {saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            {!editId && <button type="button" onClick={() => setForm(EMPTY)} className={btn.secondary}><RotateCcw size={16} /> ล้างข้อมูล</button>}
            <Link href="/dashboard/children" className={btn.secondary}><ArrowLeft size={16} /> กลับ</Link>
          </div>
        </div>
      </form>
    </div>
  );
}

function CsvImport() {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [encoding, setEncoding] = useState("utf-8");
  const [preview, setPreview] = useState<{ file: string; children: Record<string, string>[]; unknownHeaders: string[] } | null>(null);
  const [errors, setErrors] = useState<{ row: number; name: string; error: string }[] | null>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = new TextDecoder(encoding).decode(await file.arrayBuffer());
    const parsed = csvToChildren(text);
    if (parsed.children.length === 0) return toast("ไม่พบข้อมูลในไฟล์ CSV", "error");
    setErrors(null);
    setPreview({ file: file.name, ...parsed });
  }

  async function doImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const r = await api<{ inserted: number; updated: number }>("/children/import", { method: "POST", body: { children: preview.children } });
      toast(`นำเข้าสำเร็จ: เพิ่มใหม่ ${r.inserted} คน, อัปเดต ${r.updated} คน`);
      setPreview(null);
      router.push("/dashboard/children");
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      else toast(errorMessage(err), "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <select value={encoding} onChange={(e) => setEncoding(e.target.value)} className={`${input} w-auto`} title="การเข้ารหัสไฟล์">
        <option value="utf-8">UTF-8</option>
        <option value="windows-874">TIS-620 (Excel ภาษาไทย)</option>
      </select>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <button type="button" onClick={() => fileRef.current?.click()} className={btn.secondary}><Upload size={16} /> นำเข้า CSV</button>

      {preview && (
        <Modal title={<span className="flex items-center gap-2"><FileSpreadsheet size={20} /> นำเข้าข้อมูลจาก CSV</span>} onClose={() => setPreview(null)} footer={<>
          <button onClick={() => setPreview(null)} className={btn.secondary}>ยกเลิก</button>
          <button onClick={doImport} disabled={importing} className={btn.primary}>{importing ? "กำลังนำเข้า..." : `นำเข้า ${preview.children.length} แถว`}</button>
        </>}>
          <div className="space-y-3 text-sm">
            <p>ไฟล์ <b>{preview.file}</b>: พบข้อมูล <b>{preview.children.length}</b> แถว</p>
            <p className="text-slate-500">แถวที่มี ID ตรงกับข้อมูลเดิมจะถูกอัปเดต แถวอื่นจะเพิ่มเป็นเด็กคนใหม่ ถ้ามีแถวใดผิดพลาดจะไม่นำเข้าเลยทั้งไฟล์</p>
            {preview.unknownHeaders.length > 0 && (
              <p className="text-amber-700 bg-amber-50 rounded-lg p-2">คอลัมน์ที่ไม่รู้จักจะถูกข้าม: {preview.unknownHeaders.join(", ")}</p>
            )}
            <ul className="list-disc pl-5 text-slate-600 max-h-40 overflow-y-auto">
              {preview.children.slice(0, 10).map((c, i) => <li key={i}>{c.name || <i className="text-red-500">ไม่มีชื่อ</i>} {c.village_name && `· ${c.village_name}`}</li>)}
              {preview.children.length > 10 && <li>และอีก {preview.children.length - 10} แถว</li>}
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

export default function AddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AddContent />
    </Suspense>
  );
}
