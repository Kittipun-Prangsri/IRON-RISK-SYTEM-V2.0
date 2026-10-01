"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, Droplet, Apple, Pill, Utensils, Home, Save, RotateCcw } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { FOOD_OPTIONS, IRON_OPTIONS, RISK_RECOMMENDATION, RISK_STYLE, SOCIAL_OPTIONS, computeScore, villageLabel } from "@/lib/constants";
import type { Child } from "@/lib/types";
import { isStaff, useChildren, useMe, useToast } from "@/components/AppContext";
import { Card, ErrorBox, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

type Answers = { iron_status: string; food_behavior: string; social_status: string; notes: string };

function answersFor(c: Child): Answers {
  // Legacy "ได้" (received, compliance unknown) has no matching choice; start from "สม่ำเสมอ".
  const iron = IRON_OPTIONS.some((o) => o.value === c.iron_status) ? c.iron_status! : "สม่ำเสมอ";
  return {
    iron_status: iron,
    food_behavior: c.food_behavior || "เป็นประจำ",
    social_status: c.social_status || "เพียงพอ",
    notes: c.notes || "",
  };
}

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
  const { children, loading, error, reload } = useChildren();
  const [childId, setChildId] = useState(params.get("id") ?? "");
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [saving, setSaving] = useState(false);

  const child = children.find((c) => c.id === childId) ?? null;
  // Initialise answers once the selected child's data is available.
  const current = answers ?? (child ? answersFor(child) : null);

  if (!isStaff(me)) return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับเจ้าหน้าที่ รพ. เท่านั้น" /></div>;

  function selectChild(id: string) {
    setChildId(id);
    setAnswers(null);
    router.replace(id ? `/dashboard/assessment?id=${encodeURIComponent(id)}` : "/dashboard/assessment");
  }

  async function save() {
    if (!child || !current) return;
    setSaving(true);
    try {
      const saved = await api<Child>(`/children/${encodeURIComponent(child.id)}?source=assessment`, { method: "PUT", body: current });
      toast(`บันทึกผลประเมิน ${saved.name}: ${saved.total_score}/10 (${saved.risk_level})`);
      setAnswers(null);
      await reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  const score = child && current ? computeScore({ ...child, ...current }) : null;
  const set = (patch: Partial<Answers>) => current && setAnswers({ ...current, ...patch });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="แบบประเมินความเสี่ยงรายบุคคล" subtitle="สำหรับเจ้าหน้าที่ประเมินความเสี่ยงโรคโลหิตจางจากการขาดธาตุเหล็กในเด็กปฐมวัย" />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <Card title="เลือกเด็กปฐมวัยเพื่อเริ่มประเมิน" className="p-0">
            <div className="p-5 space-y-4">
              <select value={childId} onChange={(e) => selectChild(e.target.value)} className={input}>
                <option value="">-- กรุณาเลือกรายชื่อเด็ก --</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.village_name || "-"} ({c.risk_level})</option>)}
              </select>
              {child && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm bg-slate-50 rounded-lg p-4">
                  <div><b>ชื่อเด็ก:</b> {child.name}</div>
                  <div><b>อายุ:</b> {child.age || "-"}</div>
                  <div><b>หมู่บ้าน:</b> {villageLabel(child.village_no, child.village_name)}</div>
                  <div><b>ผู้ดูแล:</b> {child.caregiver_name || "-"}</div>
                  <div><b>Hct ล่าสุด:</b> {child.hct ?? "-"}%</div>
                  <div><b>ผลประเมินเดิม:</b> <RiskBadge level={child.risk_level} /> {child.total_score}/10</div>
                </div>
              )}
            </div>
          </Card>

          {!child || !current || !score ? (
            <div className="text-center py-16 text-slate-400">
              <ClipboardCheck size={40} className="mx-auto mb-3" />
              <p className="font-kanit text-lg text-slate-500">กรุณาเลือกรายชื่อเด็ก</p>
              <p className="text-sm">เลือกชื่อเด็กด้านบนเพื่อเริ่มทำแบบประเมินความเสี่ยงรายบุคคล</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="xl:col-span-2 space-y-6">
                <Card title="มิติที่ 1-2: ผลตรวจร่างกาย (คำนวณอัตโนมัติ)" className="p-0">
                  <div className="p-5 grid md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-slate-100 p-4">
                      <p className="flex items-center gap-2 text-slate-500"><Droplet size={16} /> มิติที่ 1: ผลเลือด Hct</p>
                      <p className="text-2xl font-kanit font-semibold mt-1">{child.hct ?? "-"}%</p>
                      <p className="text-teal-700 font-medium">{score.hctScore} คะแนน</p>
                      <p className="text-xs text-slate-400 mt-1">&lt;30% = 2, 30-32.9% = 1, ≥33% = 0</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-4">
                      <p className="flex items-center gap-2 text-slate-500"><Apple size={16} /> มิติที่ 2: ภาวะโภชนาการ</p>
                      <p className="text-2xl font-kanit font-semibold mt-1">{child.nutrition_status || "-"}</p>
                      <p className="text-teal-700 font-medium">{score.nutritionScore} คะแนน</p>
                      <p className="text-xs text-slate-400 mt-1">ผอม = 2, ค่อนข้างผอม = 1, อื่นๆ = 0</p>
                    </div>
                    <p className="md:col-span-2 text-xs text-slate-500">แก้ไขค่า Hct หรือโภชนาการได้ที่เมนู “แก้ไขข้อมูลเด็ก”</p>
                  </div>
                </Card>
                <Card title="มิติที่ 3: พฤติกรรมการได้รับยาเสริมธาตุเหล็ก" className="p-0">
                  <div className="p-5"><Choice name="iron" options={IRON_OPTIONS} value={current.iron_status} onChange={(v) => set({ iron_status: v })} /></div>
                </Card>
                <Card title="มิติที่ 4: พฤติกรรมการบริโภคอาหารที่มีธาตุเหล็กสูง" className="p-0">
                  <div className="p-5"><Choice name="food" options={FOOD_OPTIONS} value={current.food_behavior} onChange={(v) => set({ food_behavior: v })} /></div>
                </Card>
                <Card title="มิติที่ 5: ปัจจัยด้านการดูแลและเศรษฐานะครอบครัว" className="p-0">
                  <div className="p-5"><Choice name="social" options={SOCIAL_OPTIONS} value={current.social_status} onChange={(v) => set({ social_status: v })} /></div>
                </Card>
                <Card title="หมายเหตุเพิ่มเติม" className="p-0">
                  <div className="p-5">
                    <textarea rows={3} value={current.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับสุขภาพหรือปัญหาการกินยาของเด็กคนนี้..." className={input} />
                  </div>
                </Card>
              </div>

              <div className="xl:sticky xl:top-0 bg-white rounded-xl border border-slate-200 shadow-sm border-t-4 p-5 space-y-4" style={{ borderTopColor: RISK_STYLE[score.risk].color }}>
                <p className="text-sm text-slate-500">ผลคะแนนความเสี่ยงสะสม</p>
                <p className="font-kanit"><span className="text-5xl font-bold">{score.total}</span> <span className="text-slate-500">/ 10 คะแนน</span></p>
                <RiskBadge level={score.risk} />
                <ul className="text-xs text-slate-600 grid grid-cols-2 gap-1">
                  <li className="flex items-center gap-1"><Droplet size={12} /> Hct: {score.hctScore}</li>
                  <li className="flex items-center gap-1"><Apple size={12} /> โภชนาการ: {score.nutritionScore}</li>
                  <li className="flex items-center gap-1"><Pill size={12} /> ยาเหล็ก: {score.ironScore}</li>
                  <li className="flex items-center gap-1"><Utensils size={12} /> อาหาร: {score.foodScore}</li>
                  <li className="flex items-center gap-1"><Home size={12} /> ครอบครัว: {score.socialScore}</li>
                </ul>
                <div className="text-sm bg-slate-50 rounded-lg p-3">
                  <b>{RISK_RECOMMENDATION[score.risk].title}:</b> {RISK_RECOMMENDATION[score.risk].text}
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

export default function AssessmentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssessmentContent />
    </Suspense>
  );
}
