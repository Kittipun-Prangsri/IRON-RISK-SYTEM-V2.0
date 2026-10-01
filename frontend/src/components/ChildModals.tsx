"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Edit, Pill, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { FOOD_OPTIONS, SOCIAL_OPTIONS, ironLabel, villageLabel } from "@/lib/constants";
import { fmtNum, formatDate, formatDateTime, nowTime, todayISO } from "@/lib/format";
import type { ChildDetail } from "@/lib/types";
import { isStaff, useMe, useToast } from "./AppContext";
import { Empty, ErrorBox, Field, Loading, Modal, RiskBadge, btn, input } from "./ui";

export function MedicineLogModal({ child, onClose, onSaved }: {
  child: { id: string; name: string }; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ taken_on: todayISO(), taken_time: nowTime(), status: "กินยาแล้ว", notes: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api(`/children/${encodeURIComponent(child.id)}/medicine-logs`, { method: "POST", body: form });
      toast(`บันทึกการกินยาของ ${child.name} แล้ว`);
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={<span className="flex items-center gap-2 text-teal-700"><Pill size={20} /> บันทึกการกินยาธาตุเหล็ก</span>}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btn.secondary}>ยกเลิก</button>
        <button onClick={submit} disabled={saving} className={btn.primary}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
      </>}
    >
      <div className="flex flex-col gap-4">
        <Field label="ชื่อเด็ก"><input readOnly value={child.name} className={`${input} bg-slate-100 text-slate-600`} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="วันที่กินยา" required>
            <input type="date" max={todayISO()} value={form.taken_on} onChange={(e) => setForm({ ...form, taken_on: e.target.value })} className={input} />
          </Field>
          <Field label="เวลา">
            <input type="time" value={form.taken_time} onChange={(e) => setForm({ ...form, taken_time: e.target.value })} className={input} />
          </Field>
        </div>
        <Field label="สถานะการกินยา" required>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={input}>
            <option value="กินยาแล้ว">กินยาแล้ว</option>
            <option value="ไม่ได้กิน">ไม่ได้กิน</option>
          </select>
        </Field>
        <Field label="หมายเหตุ">
          <input value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="เช่น ขนาดยา หรืออาการข้างเคียง" className={input} />
        </Field>
      </div>
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-100">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <div className="font-medium text-slate-800 text-sm">{children}</div>
    </div>
  );
}

export function ChildDetailModal({ childId, onClose, onChanged }: { childId: string; onClose: () => void; onChanged: () => void }) {
  const me = useMe();
  const toast = useToast();
  const [child, setChild] = useState<ChildDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setChild(await api<ChildDetail>(`/children/${encodeURIComponent(childId)}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [childId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    load();
  }, [load]);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/children/${encodeURIComponent(childId)}`, { method: "DELETE" });
      toast(`ลบข้อมูล ${child?.name} แล้ว`);
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
      setDeleting(false);
    }
  }

  const staff = isStaff(me);
  const label = (opts: { value: string; label: string }[], v: string | null) => opts.find((o) => o.value === v)?.label ?? "ยังไม่ประเมิน";

  if (confirmDelete && child) {
    return (
      <Modal title="ยืนยันการลบข้อมูล" size="sm" onClose={() => setConfirmDelete(false)} footer={<>
        <button onClick={() => setConfirmDelete(false)} className={btn.secondary}>ยกเลิก</button>
        <button onClick={remove} disabled={deleting} className={btn.danger}>{deleting ? "กำลังลบ..." : "ยืนยันลบ"}</button>
      </>}>
        <div className="text-center text-sm text-slate-600">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 size={22} /></div>
          ต้องการลบข้อมูลเด็กคนนี้ออกจากรายชื่อใช่หรือไม่?
          <p className="font-semibold text-red-600 text-base mt-2">{child.name}</p>
          <p className="text-xs text-slate-400 mt-2">ประวัติการกินยาและบันทึกกิจกรรมยังถูกเก็บไว้</p>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal title="ข้อมูลเด็กรายบุคคล" size="lg" onClose={onClose} footer={child && <>
        <button onClick={() => setShowLog(true)} className={btn.primary}><Pill size={16} /> บันทึกกินยา</button>
        {staff && <>
          <Link href={`/dashboard/assessment?id=${encodeURIComponent(child.id)}`} className={btn.secondary}><ClipboardCheck size={16} /> ประเมินความเสี่ยง</Link>
          <Link href={`/dashboard/add?id=${encodeURIComponent(child.id)}`} className={btn.secondary}><Edit size={16} /> แก้ไข</Link>
          <button onClick={() => setConfirmDelete(true)} className={btn.dangerSoft}><Trash2 size={16} /> ลบ</button>
        </>}
      </>}>
        {error ? <ErrorBox message={error} /> : !child ? <Loading /> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-kanit text-xl font-semibold text-slate-800">{child.name}</p>
                <p className="text-sm text-slate-500">{child.age || "-"} · {villageLabel(child.village_no, child.village_name)}</p>
              </div>
              <div className="text-right">
                <RiskBadge level={child.risk_level} />
                <p className="text-xs text-slate-500 mt-1">คะแนนรวม {child.total_score}/10</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Info label="Hct">{fmtNum(child.hct, "%")} <span className="text-xs text-slate-400">({child.hct_score} คะแนน)</span></Info>
              <Info label="น้ำหนัก / ส่วนสูง">{fmtNum(child.weight_kg)} กก. / {fmtNum(child.height_cm)} ซม.</Info>
              <Info label="โภชนาการ">{child.nutrition_status || "-"} <span className="text-xs text-slate-400">({child.nutrition_score})</span></Info>
              <Info label="ยาเสริมธาตุเหล็ก">{ironLabel(child.iron_status)} <span className="text-xs text-slate-400">({child.iron_score})</span></Info>
              <Info label="อาหารธาตุเหล็กสูง">{label(FOOD_OPTIONS, child.food_behavior)} <span className="text-xs text-slate-400">({child.food_score})</span></Info>
              <Info label="การดูแล / เศรษฐานะ">{label(SOCIAL_OPTIONS, child.social_status)} <span className="text-xs text-slate-400">({child.social_score})</span></Info>
              <Info label="ผู้ดูแล">{child.caregiver_name || "-"}</Info>
              <Info label="ที่อยู่">{[child.house_number && `บ้านเลขที่ ${child.house_number}`, child.tambon && `ต.${child.tambon}`, child.amphoe && `อ.${child.amphoe}`].filter(Boolean).join(" ") || "-"}</Info>
            </div>
            {child.notes && <Info label="หมายเหตุ"><p className="whitespace-pre-line font-normal">{child.notes}</p></Info>}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-kanit font-medium text-slate-800">ประวัติการกินยา</h4>
                <span className="text-xs text-slate-500">30 วันล่าสุด: กินยา {child.doses_30d} ครั้ง · ล่าสุด {formatDateTime(child.last_medication_at)}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {child.medicine_logs.length === 0 ? <Empty text="ยังไม่มีบันทึกการกินยา" /> : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr><th className="px-4 py-2 text-left">วันที่</th><th className="px-4 py-2 text-left">สถานะ</th><th className="px-4 py-2 text-left">หมายเหตุ</th><th className="px-4 py-2 text-left">ผู้บันทึก</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {child.medicine_logs.map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-2 whitespace-nowrap">{formatDate(l.taken_on)} {l.taken_time?.slice(0, 5)}</td>
                          <td className={`px-4 py-2 ${l.status === "กินยาแล้ว" ? "text-emerald-600" : "text-red-600"}`}>{l.status}</td>
                          <td className="px-4 py-2 text-slate-600">{l.notes || "-"}</td>
                          <td className="px-4 py-2 text-slate-500">{l.recorded_by_name || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      {showLog && child && (
        <MedicineLogModal child={child} onClose={() => setShowLog(false)} onSaved={() => { load(); onChanged(); }} />
      )}
    </>
  );
}
