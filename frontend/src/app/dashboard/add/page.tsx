"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, RotateCcw, ArrowLeft } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  AGE_OPTIONS, FOOD_OPTIONS, IRON_OPTIONS, NUTRITION_OPTIONS, SOCIAL_OPTIONS, computeScore
} from "@/lib/constants";
import { CHILD_CSV_COLUMNS } from "@/lib/csv";
import { CsvImport } from "@/components/CsvImport";
import { AddressFields } from "@/components/AddressFields";
import type { Child } from "@/lib/types";
import { isStaff, useMe, useToast } from "@/components/AppContext";
import { Card, ErrorBox, Field, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

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
  const score = computeScore(form);

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
        actions={!editId && <CsvImport columns={CHILD_CSV_COLUMNS} importPath="/children/import" doneHref="/dashboard/children" />}
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
              <AddressFields value={form} onChange={set} />
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

export default function AddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AddContent />
    </Suspense>
  );
}
