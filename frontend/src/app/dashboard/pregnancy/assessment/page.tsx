"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, Droplet, Scale, Pill, Utensils, Home, ShieldAlert, Save, RotateCcw } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { RISK_STYLE, villageLabel } from "@/lib/constants";
import {
  PREG_FOOD_OPTIONS, PREG_IRON_OPTIONS, PREG_MAX_SCORE, PREG_RECOMMENDATION, PREG_SOCIAL_OPTIONS,
  RISK_FACTOR_OPTIONS, TEEN_FACTOR, WEIGHT_GAIN_OPTIONS, computePregnancyScore, gestation
} from "@/lib/pregnancy";
import type { Pregnancy } from "@/lib/types";
import { isStaff, useMe, usePregnancies, useToast } from "@/components/AppContext";
import { PregnancyStatus } from "@/components/PregnancyModals";
import { Card, ErrorBox, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

type Answers = {
  hct: string; weight_gain: string; iron_status: string; food_behavior: string; social_status: string;
  risk_factors: string[]; notes: string;
};

const answersFor = (p: Pregnancy): Answers => ({
  hct: p.hct == null ? "" : String(p.hct),
  weight_gain: p.weight_gain || "ตามเกณฑ์",
  iron_status: p.iron_status || "ทุกวัน",
  food_behavior: p.food_behavior || "เป็นประจำ",
  social_status: p.social_status || "เพียงพอ",
  risk_factors: p.risk_factors ?? [],
  notes: p.notes || "",
});

function Choice({ name, options, value, onChange }: {
  name: string; options: { value: string; label: string; hint: string; score: number }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((o) => (
        <label key={o.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${value === o.value ? "border-teal-400 bg-teal-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 accent-teal-600" />
          <span className="text-sm">
            <b className="text-slate-800">{o.label}</b> <span className="text-xs text-slate-400">({o.score} คะแนน)</span>
            <span className="block text-xs text-slate-500">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AssessmentContent() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { pregnancies, loading, error, reload } = usePregnancies();
  const [id, setId] = useState(params.get("id") ?? "");
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [saving, setSaving] = useState(false);

  const p = pregnancies.find((x) => x.id === id) ?? null;
  const current = answers ?? (p ? answersFor(p) : null);

  if (!isStaff(me)) return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับเจ้าหน้าที่ รพ. เท่านั้น" /></div>;

  function select(next: string) {
    setId(next);
    setAnswers(null);
    router.replace(next ? `/dashboard/pregnancy/assessment?id=${encodeURIComponent(next)}` : "/dashboard/pregnancy/assessment");
  }

  async function save() {
    if (!p || !current) return;
    setSaving(true);
    try {
      const saved = await api<Pregnancy>(`/pregnancies/${encodeURIComponent(p.id)}?source=assessment`, { method: "PUT", body: current });
      toast(`บันทึกผลประเมิน ${saved.name}: ${saved.total_score}/${PREG_MAX_SCORE} (${saved.risk_level})`);
      setAnswers(null);
      await reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  const score = p && current ? computePregnancyScore({ ...p, ...current }) : null;
  const set = (patch: Partial<Answers>) => current && setAnswers({ ...current, ...patch });
  const toggleFactor = (f: string) => current && set({
    risk_factors: current.risk_factors.includes(f) ? current.risk_factors.filter((x) => x !== f) : [...current.risk_factors, f],
  });
  const teen = !!p?.age_years && p.age_years < 20;
  const active = pregnancies.filter((x) => !x.delivered_on || x.id === id);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="แบบประเมินหญิงตั้งครรภ์" subtitle={`ประเมินความเสี่ยงภาวะขาดธาตุเหล็ก 6 มิติ (0-${PREG_MAX_SCORE} คะแนน: ≥5 เสี่ยงสูง, 3-4 ปานกลาง, 0-2 ต่ำ · Hct < 30% = เสี่ยงสูงทันที)`} />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <Card title="เลือกหญิงตั้งครรภ์เพื่อเริ่มประเมิน" className="p-0">
            <div className="p-5 space-y-4">
              <select value={id} onChange={(e) => select(e.target.value)} className={input}>
                <option value="">-- กรุณาเลือกรายชื่อ --</option>
                {active.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.village_name || "-"} ({x.risk_level})</option>)}
              </select>
              {p && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm bg-slate-50 rounded-lg p-4">
                  <div><b>ชื่อ:</b> {p.name}</div>
                  <div><b>อายุ:</b> {p.age_years ?? "-"} ปี</div>
                  <div><b>หมู่บ้าน:</b> {villageLabel(p.village_no, p.village_name)}</div>
                  <div className="md:col-span-2"><b>อายุครรภ์:</b> <PregnancyStatus lmp={p.lmp_date} deliveredOn={p.delivered_on} /></div>
                  <div><b>ผลประเมินเดิม:</b> <RiskBadge level={p.risk_level} /> {p.total_score}/{PREG_MAX_SCORE}</div>
                </div>
              )}
            </div>
          </Card>

          {!p || !current || !score ? (
            <div className="text-center py-16 text-slate-400">
              <ClipboardCheck size={40} className="mx-auto mb-3" />
              <p className="font-kanit text-lg text-slate-500">กรุณาเลือกรายชื่อหญิงตั้งครรภ์</p>
              <p className="text-sm">ยังไม่มีรายชื่อ? เพิ่มได้ที่เมนู “เพิ่มหญิงตั้งครรภ์”</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="xl:col-span-2 space-y-6">
                <Card title="มิติที่ 1: ผลเลือด Hct" className="p-0">
                  <div className="p-5 flex flex-wrap items-end gap-4">
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">Hct ล่าสุด (%)</span>
                      <input type="number" step="0.1" min={1} max={80} value={current.hct} onChange={(e) => set({ hct: e.target.value })} className={`${input} w-32`} />
                    </label>
                    <p className="text-sm"><Droplet size={14} className="inline text-red-500" /> <b>{score.hctScore} คะแนน</b> <span className="text-xs text-slate-500">(≥33% = 0, 30-32.9% = 1, &lt;30% = 2 และจัดเป็นเสี่ยงสูงทันที)</span></p>
                  </div>
                </Card>
                <Card title="มิติที่ 2: ภาวะโภชนาการ" className="p-0">
                  <div className="p-5 space-y-3 text-sm">
                    <p>BMI ก่อนตั้งครรภ์: <b>{score.bmi ?? "ไม่มีข้อมูลน้ำหนัก/ส่วนสูง"}</b>{score.bmi !== null && score.bmi < 18.5 && <span className="text-red-600"> (ต่ำกว่า 18.5 = 2 คะแนน)</span>}</p>
                    <div className="flex flex-wrap gap-2">
                      {WEIGHT_GAIN_OPTIONS.map((w) => (
                        <label key={w} className={`px-3 py-2 rounded-lg border cursor-pointer ${current.weight_gain === w ? "border-teal-400 bg-teal-50/60" : "border-slate-200"}`}>
                          <input type="radio" name="weight_gain" className="mr-2 accent-teal-600" checked={current.weight_gain === w} onChange={() => set({ weight_gain: w })} />
                          น้ำหนักขึ้น{w}{w === "น้อยกว่าเกณฑ์" && <span className="text-xs text-slate-400"> (1 คะแนน)</span>}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500"><Scale size={12} className="inline" /> ได้ {score.nutritionScore} คะแนน · แก้น้ำหนัก/ส่วนสูงได้ที่หน้าแก้ไขข้อมูล</p>
                  </div>
                </Card>
                <Card title="มิติที่ 3: การกินยาเสริมธาตุเหล็ก (Triferdine)" className="p-0">
                  <div className="p-5"><Choice name="iron" options={PREG_IRON_OPTIONS} value={current.iron_status} onChange={(v) => set({ iron_status: v })} /></div>
                </Card>
                <Card title="มิติที่ 4: การบริโภคอาหารที่มีธาตุเหล็กสูง" className="p-0">
                  <div className="p-5"><Choice name="food" options={PREG_FOOD_OPTIONS} value={current.food_behavior} onChange={(v) => set({ food_behavior: v })} /></div>
                </Card>
                <Card title="มิติที่ 5: การดูแลและเศรษฐานะครอบครัว" className="p-0">
                  <div className="p-5"><Choice name="social" options={PREG_SOCIAL_OPTIONS} value={current.social_status} onChange={(v) => set({ social_status: v })} /></div>
                </Card>
                <Card title="มิติที่ 6: ปัจจัยเสี่ยงทางสูติกรรม (ไม่มี = 0, 1 ข้อ = 1, ≥2 ข้อ = 2)" className="p-0">
                  <div className="p-5 grid gap-2 text-sm">
                    <label className={`flex items-center gap-3 p-3 rounded-lg border ${teen ? "border-teal-400 bg-teal-50/60" : "border-slate-200 text-slate-400"}`}>
                      <input type="checkbox" checked={teen} disabled className="accent-teal-600" />
                      {TEEN_FACTOR} <span className="text-xs">(คำนวณจากอายุอัตโนมัติ)</span>
                    </label>
                    {RISK_FACTOR_OPTIONS.map((f) => (
                      <label key={f} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${current.risk_factors.includes(f) ? "border-teal-400 bg-teal-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={current.risk_factors.includes(f)} onChange={() => toggleFactor(f)} className="accent-teal-600" />
                        {f}
                      </label>
                    ))}
                  </div>
                </Card>
                <Card title="หมายเหตุเพิ่มเติม" className="p-0">
                  <div className="p-5">
                    <textarea rows={3} value={current.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="เช่น ผลตรวจธาลัสซีเมียของสามี อาการข้างเคียงจากยา นัดครั้งถัดไป..." className={input} />
                  </div>
                </Card>
              </div>

              <div className="xl:sticky xl:top-0 bg-white rounded-xl border border-slate-200 shadow-sm border-t-4 p-5 space-y-4" style={{ borderTopColor: RISK_STYLE[score.risk].color }}>
                <p className="text-sm text-slate-500">ผลคะแนนความเสี่ยงสะสม</p>
                <p className="font-kanit"><span className="text-5xl font-bold">{score.total}</span> <span className="text-slate-500">/ {PREG_MAX_SCORE} คะแนน</span></p>
                <RiskBadge level={score.risk} />
                <ul className="text-xs text-slate-600 grid grid-cols-2 gap-1">
                  <li className="flex items-center gap-1"><Droplet size={12} /> Hct: {score.hctScore}</li>
                  <li className="flex items-center gap-1"><Scale size={12} /> โภชนาการ: {score.nutritionScore}</li>
                  <li className="flex items-center gap-1"><Pill size={12} /> Triferdine: {score.ironScore}</li>
                  <li className="flex items-center gap-1"><Utensils size={12} /> อาหาร: {score.foodScore}</li>
                  <li className="flex items-center gap-1"><Home size={12} /> ครอบครัว: {score.socialScore}</li>
                  <li className="flex items-center gap-1"><ShieldAlert size={12} /> สูติกรรม: {score.obstetricScore}</li>
                </ul>
                {(() => { const g = gestation(p.lmp_date, p.delivered_on); return g && g.weeks >= 42 && !p.delivered_on ? <p className="text-xs text-red-600">อายุครรภ์เกิน 42 สัปดาห์ — ตรวจสอบว่าคลอดแล้วหรือไม่</p> : null; })()}
                <div className="text-sm bg-slate-50 rounded-lg p-3">
                  <b>{PREG_RECOMMENDATION[score.risk].title}:</b> {PREG_RECOMMENDATION[score.risk].text}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={save} disabled={saving} className={btn.primary}><Save size={16} /> {saving ? "กำลังบันทึก..." : "บันทึกผลการประเมิน"}</button>
                  <button onClick={() => setAnswers(null)} className={btn.secondary}><RotateCcw size={16} /> คืนค่าตามข้อมูลเดิม</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PregnancyAssessmentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssessmentContent />
    </Suspense>
  );
}
