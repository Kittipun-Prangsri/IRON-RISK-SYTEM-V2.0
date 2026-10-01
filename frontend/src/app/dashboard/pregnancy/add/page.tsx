"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, RotateCcw, ArrowLeft } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PREG_CSV_COLUMNS } from "@/lib/csv";
import { formatDate, todayISO } from "@/lib/format";
import {
  PREG_FOOD_OPTIONS, PREG_IRON_OPTIONS, PREG_MAX_SCORE, PREG_SOCIAL_OPTIONS, RISK_FACTOR_OPTIONS, TEEN_FACTOR,
  WEIGHT_GAIN_OPTIONS, computePregnancyScore, gestation
} from "@/lib/pregnancy";
import type { Pregnancy } from "@/lib/types";
import { isStaff, useMe, useToast } from "@/components/AppContext";
import { AddressFields } from "@/components/AddressFields";
import { CsvImport } from "@/components/CsvImport";
import { Card, ErrorBox, Field, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

const TEXT_FIELDS = [
  "name", "age_years", "husband_name", "phone", "province", "amphoe", "tambon", "house_number", "village_no", "village_name",
  "latitude", "longitude", "lmp_date", "delivered_on", "hct", "pre_weight_kg", "current_weight_kg", "height_cm",
  "weight_gain", "iron_status", "food_behavior", "social_status", "notes",
] as const;
type Form = Record<(typeof TEXT_FIELDS)[number], string> & { risk_factors: string[] };

const EMPTY: Form = {
  name: "", age_years: "", husband_name: "", phone: "", province: "สระแก้ว", amphoe: "คลองหาด", tambon: "คลองหาด",
  house_number: "", village_no: "1", village_name: "บ้านคลองหาด", latitude: "", longitude: "", lmp_date: "", delivered_on: "",
  hct: "", pre_weight_kg: "", current_weight_kg: "", height_cm: "", weight_gain: "ตามเกณฑ์", iron_status: "ทุกวัน",
  food_behavior: "เป็นประจำ", social_status: "เพียงพอ", notes: "", risk_factors: [],
};

const toForm = (p: Pregnancy): Form => ({
  ...(Object.fromEntries(TEXT_FIELDS.map((f) => [f, p[f] == null ? "" : String(p[f])])) as Record<(typeof TEXT_FIELDS)[number], string>),
  risk_factors: p.risk_factors ?? [],
});

function PregnancyFormContent() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    api<Pregnancy>(`/pregnancies/${encodeURIComponent(editId)}`)
      .then((p) => setForm(toForm(p)))
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [editId]);

  if (!isStaff(me)) return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับเจ้าหน้าที่ รพ. เท่านั้น" /></div>;
  if (loading) return <Loading />;
  if (loadError) return <div className="p-6"><ErrorBox message={loadError} /></div>;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const toggleFactor = (f: string) =>
    set({ risk_factors: form.risk_factors.includes(f) ? form.risk_factors.filter((x) => x !== f) : [...form.risk_factors, f] });
  const score = computePregnancyScore(form);
  const g = gestation(form.lmp_date || null, form.delivered_on || null);
  const teen = Number(form.age_years) > 0 && Number(form.age_years) < 20;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = editId
        ? await api<Pregnancy>(`/pregnancies/${encodeURIComponent(editId)}`, { method: "PUT", body: form })
        : await api<Pregnancy>("/pregnancies", { method: "POST", body: form });
      toast(`${editId ? "แก้ไข" : "เพิ่ม"}ข้อมูล ${saved.name} แล้ว (${saved.risk_level} ${saved.total_score}/${PREG_MAX_SCORE})`);
      router.push("/dashboard/pregnancy");
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  }

  const select = (field: keyof Form, options: { value: string; label: string }[]) => (
    <select value={form[field] as string} onChange={(e) => set({ [field]: e.target.value } as Partial<Form>)} className={input}>
      <option value="">ยังไม่ประเมิน</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={editId ? "แก้ไขข้อมูลหญิงตั้งครรภ์" : "เพิ่มหญิงตั้งครรภ์"}
        subtitle="กรอกข้อมูลการฝากครรภ์และผลตรวจ ระบบจะคำนวณอายุครรภ์และคะแนนความเสี่ยงให้อัตโนมัติ"
        actions={!editId && <CsvImport columns={PREG_CSV_COLUMNS} importPath="/pregnancies/import" doneHref="/dashboard/pregnancy" />}
      />

      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          <Card title="ข้อมูลส่วนตัวและที่อยู่" className="p-0">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="ชื่อ-นามสกุล" required className="md:col-span-2">
                <input required value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="นาง / นางสาว ชื่อ นามสกุล" className={input} />
              </Field>
              <Field label="อายุ (ปี)"><input type="number" min={10} max={60} value={form.age_years} onChange={(e) => set({ age_years: e.target.value })} className={input} /></Field>
              <Field label="สามี / ผู้ดูแล"><input value={form.husband_name} onChange={(e) => set({ husband_name: e.target.value })} className={input} /></Field>
              <Field label="เบอร์โทรศัพท์"><input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="08x-xxx-xxxx" className={input} /></Field>
              <div className="hidden md:block" />
              <AddressFields value={form} onChange={set} />
              <Field label="หมายเหตุ" className="md:col-span-3">
                <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="เช่น ผลตรวจธาลัสซีเมียของสามี โรคประจำตัว" className={input} />
              </Field>
            </div>
          </Card>

          <Card title="การตั้งครรภ์" className="p-0">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="วันแรกของประจำเดือนครั้งสุดท้าย (LMP)">
                <input type="date" max={todayISO()} value={form.lmp_date} onChange={(e) => set({ lmp_date: e.target.value })} className={input} />
              </Field>
              <div className="text-sm bg-slate-50 rounded-lg p-3 md:col-span-2">
                {g ? <>อายุครรภ์ <b>{g.label}</b> (ไตรมาส {g.trimester}) · กำหนดคลอด (EDC) <b>{formatDate(g.edc)}</b></> : <span className="text-slate-400">กรอก LMP เพื่อคำนวณอายุครรภ์และกำหนดคลอด</span>}
              </div>
              <Field label="วันที่คลอด (ถ้าคลอดแล้ว)">
                <input type="date" max={todayISO()} value={form.delivered_on} onChange={(e) => set({ delivered_on: e.target.value })} className={input} />
              </Field>
            </div>
          </Card>

          <Card title="ผลตรวจและภาวะโภชนาการ (มิติที่ 1-2)" className="p-0">
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Hct (%)"><input type="number" step="0.1" min={1} max={80} value={form.hct} onChange={(e) => set({ hct: e.target.value })} placeholder="เช่น 34" className={input} /></Field>
              <Field label="น้ำหนักก่อนตั้งครรภ์ (กก.)"><input type="number" step="0.1" value={form.pre_weight_kg} onChange={(e) => set({ pre_weight_kg: e.target.value })} className={input} /></Field>
              <Field label="น้ำหนักปัจจุบัน (กก.)"><input type="number" step="0.1" value={form.current_weight_kg} onChange={(e) => set({ current_weight_kg: e.target.value })} className={input} /></Field>
              <Field label="ส่วนสูง (ซม.)"><input type="number" step="0.1" value={form.height_cm} onChange={(e) => set({ height_cm: e.target.value })} className={input} /></Field>
              <Field label="น้ำหนักขึ้นตามอายุครรภ์">
                <select value={form.weight_gain} onChange={(e) => set({ weight_gain: e.target.value })} className={input}>
                  <option value="">ไม่ระบุ</option>
                  {WEIGHT_GAIN_OPTIONS.map((w) => <option key={w}>{w}</option>)}
                </select>
              </Field>
              <div className="col-span-2 md:col-span-3 flex items-end text-sm text-slate-600">BMI ก่อนตั้งครรภ์: <b className="ml-1">{score.bmi ?? "-"}</b>{score.bmi !== null && score.bmi < 18.5 && <span className="text-red-600 ml-1">(ผอม)</span>}</div>
            </div>
          </Card>

          <Card title="การประเมินมิติที่ 3-6" className="p-0">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="มิติที่ 3: การกิน Triferdine">{select("iron_status", PREG_IRON_OPTIONS)}</Field>
              <Field label="มิติที่ 4: อาหารธาตุเหล็กสูง">{select("food_behavior", PREG_FOOD_OPTIONS)}</Field>
              <Field label="มิติที่ 5: การดูแล / เศรษฐานะ">{select("social_status", PREG_SOCIAL_OPTIONS)}</Field>
              <div className="md:col-span-3">
                <p className="text-xs font-medium text-slate-600 mb-1.5">มิติที่ 6: ปัจจัยเสี่ยงทางสูติกรรม</p>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <label className={`flex items-center gap-2 ${teen ? "" : "text-slate-400"}`}><input type="checkbox" checked={teen} disabled /> {TEEN_FACTOR} (จากอายุ)</label>
                  {RISK_FACTOR_OPTIONS.map((f) => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.risk_factors.includes(f)} onChange={() => toggleFactor(f)} className="accent-teal-600" /> {f}</label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:sticky xl:top-0 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-sm text-slate-500">คะแนนความเสี่ยง (คำนวณอัตโนมัติ)</p>
          <p className="font-kanit"><span className="text-4xl font-bold">{score.total}</span> <span className="text-slate-500">/ {PREG_MAX_SCORE}</span></p>
          <RiskBadge level={score.risk} />
          <p className="text-xs text-slate-500">Hct {score.hctScore} · โภชนาการ {score.nutritionScore} · Triferdine {score.ironScore} · อาหาร {score.foodScore} · ครอบครัว {score.socialScore} · สูติกรรม {score.obstetricScore}</p>
          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={saving} className={btn.primary}><Save size={16} /> {saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            {!editId && <button type="button" onClick={() => setForm(EMPTY)} className={btn.secondary}><RotateCcw size={16} /> ล้างข้อมูล</button>}
            <Link href="/dashboard/pregnancy" className={btn.secondary}><ArrowLeft size={16} /> กลับ</Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function PregnancyAddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PregnancyFormContent />
    </Suspense>
  );
}
