"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Edit, Pill, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { villageLabel } from "@/lib/constants";
import { fmtNum, formatDate, formatDateTime } from "@/lib/format";
import {
  PREG_FOOD_OPTIONS, PREG_MAX_SCORE, PREG_SOCIAL_OPTIONS, bmi, gestation, obstetricFactors, pregIronLabel
} from "@/lib/pregnancy";
import type { PregnancyDetail } from "@/lib/types";
import { isStaff, useMe, useToast } from "./AppContext";
import { Info, MedicineHistory, MedicineLogModal } from "./ChildModals";
import { ErrorBox, Loading, Modal, RiskBadge, btn } from "./ui";

export function PregnancyStatus({ lmp, deliveredOn }: { lmp: string | null; deliveredOn: string | null }) {
  if (deliveredOn) return <span className="text-xs text-slate-500">คลอดแล้ว {formatDate(deliveredOn)}</span>;
  const g = gestation(lmp);
  if (!g) return <span className="text-xs text-slate-400">ยังไม่ระบุ LMP</span>;
  return (
    <span className={`text-xs ${g.weeks >= 42 ? "text-red-600" : "text-slate-600"}`}>
      GA {g.label} · ไตรมาส {g.trimester} · EDC {formatDate(g.edc)}
    </span>
  );
}

export function PregnancyDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const me = useMe();
  const toast = useToast();
  const [p, setP] = useState<PregnancyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api<PregnancyDetail>(`/pregnancies/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    load();
  }, [load]);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/pregnancies/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast(`ลบข้อมูล ${p?.name} แล้ว`);
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
      setDeleting(false);
    }
  }

  const staff = isStaff(me);
  const label = (opts: { value: string; label: string }[], v: string | null) => opts.find((o) => o.value === v)?.label ?? "ยังไม่ประเมิน";

  if (confirmDelete && p) {
    return (
      <Modal title="ยืนยันการลบข้อมูล" size="sm" onClose={() => setConfirmDelete(false)} footer={<>
        <button onClick={() => setConfirmDelete(false)} className={btn.secondary}>ยกเลิก</button>
        <button onClick={remove} disabled={deleting} className={btn.danger}>{deleting ? "กำลังลบ..." : "ยืนยันลบ"}</button>
      </>}>
        <div className="text-center text-sm text-slate-600">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 size={22} /></div>
          ต้องการลบข้อมูลหญิงตั้งครรภ์รายนี้ออกจากทะเบียนใช่หรือไม่?
          <p className="font-semibold text-red-600 text-base mt-2">{p.name}</p>
          <p className="text-xs text-slate-400 mt-2">ถ้าคลอดแล้ว ให้บันทึก “วันที่คลอด” ในหน้าแก้ไขแทนการลบ</p>
        </div>
      </Modal>
    );
  }

  const factors = p ? obstetricFactors(p) : [];

  return (
    <>
      <Modal title="ข้อมูลหญิงตั้งครรภ์" size="lg" onClose={onClose} footer={p && <>
        <button onClick={() => setShowLog(true)} className={btn.primary}><Pill size={16} /> บันทึกกินยา</button>
        {staff && <>
          <Link href={`/dashboard/pregnancy/assessment?id=${encodeURIComponent(p.id)}`} className={btn.secondary}><ClipboardCheck size={16} /> ประเมินความเสี่ยง</Link>
          <Link href={`/dashboard/pregnancy/add?id=${encodeURIComponent(p.id)}`} className={btn.secondary}><Edit size={16} /> แก้ไข</Link>
          <button onClick={() => setConfirmDelete(true)} className={btn.dangerSoft}><Trash2 size={16} /> ลบ</button>
        </>}
      </>}>
        {error ? <ErrorBox message={error} /> : !p ? <Loading /> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-kanit text-xl font-semibold text-slate-800">{p.name}</p>
                <p className="text-sm text-slate-500">อายุ {p.age_years ?? "-"} ปี · {villageLabel(p.village_no, p.village_name)}</p>
                <PregnancyStatus lmp={p.lmp_date} deliveredOn={p.delivered_on} />
              </div>
              <div className="text-right">
                <RiskBadge level={p.risk_level} />
                <p className="text-xs text-slate-500 mt-1">คะแนนรวม {p.total_score}/{PREG_MAX_SCORE}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Info label="1. Hct">{fmtNum(p.hct, "%")} <span className="text-xs text-slate-400">({p.hct_score})</span></Info>
              <Info label="2. BMI ก่อนตั้งครรภ์ / น้ำหนักขึ้น">
                {fmtNum(bmi(p.pre_weight_kg, p.height_cm))} · {p.weight_gain || "-"} <span className="text-xs text-slate-400">({p.nutrition_score})</span>
              </Info>
              <Info label="3. การกิน Triferdine">{pregIronLabel(p.iron_status)} <span className="text-xs text-slate-400">({p.iron_score})</span></Info>
              <Info label="4. อาหารธาตุเหล็กสูง">{label(PREG_FOOD_OPTIONS, p.food_behavior)} <span className="text-xs text-slate-400">({p.food_score})</span></Info>
              <Info label="5. การดูแล / เศรษฐานะ">{label(PREG_SOCIAL_OPTIONS, p.social_status)} <span className="text-xs text-slate-400">({p.social_score})</span></Info>
              <Info label="6. ปัจจัยเสี่ยงทางสูติกรรม">
                {factors.length ? factors.join(", ") : "ไม่มี"} <span className="text-xs text-slate-400">({p.obstetric_score})</span>
              </Info>
              <Info label="น้ำหนัก ก่อน / ปัจจุบัน / ส่วนสูง">{fmtNum(p.pre_weight_kg)} / {fmtNum(p.current_weight_kg)} กก. / {fmtNum(p.height_cm)} ซม.</Info>
              <Info label="สามี / ผู้ดูแล">{p.husband_name || "-"}{p.phone ? ` · ${p.phone}` : ""}</Info>
              <Info label="ที่อยู่">{[p.house_number && `บ้านเลขที่ ${p.house_number}`, p.tambon && `ต.${p.tambon}`, p.amphoe && `อ.${p.amphoe}`].filter(Boolean).join(" ") || "-"}</Info>
            </div>
            {p.notes && <Info label="หมายเหตุ"><p className="whitespace-pre-line font-normal">{p.notes}</p></Info>}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-kanit font-medium text-slate-800">ประวัติการกิน Triferdine</h4>
                <span className="text-xs text-slate-500">30 วันล่าสุด: กินยา {p.doses_30d} ครั้ง · ล่าสุด {formatDateTime(p.last_medication_at)}</span>
              </div>
              <MedicineHistory logs={p.medicine_logs} />
            </div>
          </div>
        )}
      </Modal>
      {showLog && p && (
        <MedicineLogModal child={p} basePath="/pregnancies" drugName="ยา Triferdine" onClose={() => setShowLog(false)} onSaved={() => { load(); onChanged(); }} />
      )}
    </>
  );
}
