"use client";
import { useState } from "react";
import { CheckCircle2, XCircle, Percent, Pill, CalendarClock } from "lucide-react";
import { ironLabel, ironReceived } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { Child } from "@/lib/types";
import { useChildren } from "@/components/AppContext";
import { ChildDetailModal, MedicineLogModal } from "@/components/ChildModals";
import { Card, Empty, ErrorBox, Loading, PageHeader, btn } from "@/components/ui";

function ironBadge(v: string | null) {
  const tone = v === "สม่ำเสมอ" || v === "ได้" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : v === "ไม่สม่ำเสมอ" ? "bg-amber-50 text-amber-700 border-amber-200"
    : v ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-500 border-slate-200";
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${tone}`}>{ironLabel(v)}</span>;
}

export default function IronPage() {
  const { children, loading, error, reload } = useChildren();
  const [logFor, setLogFor] = useState<Child | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const got = children.filter((c) => ironReceived(c.iron_status)).length;
  const notGot = children.length - got;
  const coverage = children.length ? Math.round((got / children.length) * 100) : 0;
  const noDose30 = children.filter((c) => c.doses_30d === 0).length;
  const rows = onlyMissing ? children.filter((c) => c.doses_30d === 0) : children;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="ยาธาตุเหล็ก" subtitle="ติดตามการได้รับยาธาตุเหล็กของเด็กในชุมชน และบันทึกการกินยารายวัน" />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={<CheckCircle2 className="text-emerald-500" />} value={got} label="ได้รับยาเหล็ก" />
            <Stat icon={<XCircle className="text-red-500" />} value={notGot} label="ยังไม่ได้รับ / ไม่ได้กิน" />
            <Stat icon={<Percent className="text-teal-500" />} value={`${coverage}%`} label="ความครอบคลุม" />
            <Stat icon={<CalendarClock className="text-amber-500" />} value={noDose30} label="ไม่มีบันทึกกินยาใน 30 วัน" />
          </div>

          <Card title="รายชื่อเด็กและสถานะยาธาตุเหล็ก" actions={
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="accent-teal-600" />
              เฉพาะที่ไม่มีบันทึกใน 30 วัน
            </label>
          }>
            {/* Phones (อสม. in the field): one card per child, action button in reach */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((c) => (
                <li key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setSelected(c.id)} className="text-left min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.age || "-"} · {c.village_name || "-"} · ผู้ดูแล {c.caregiver_name || "-"}</p>
                    </button>
                    <button onClick={() => setLogFor(c)} className={`${btn.primary} px-3 py-1.5 text-xs shrink-0`}><Pill size={14} /> บันทึกกินยา</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {ironBadge(c.iron_status)}
                    <span>Hct {c.hct ? `${c.hct}%` : "-"}</span>
                    <span className={c.doses_30d === 0 ? "text-red-500" : ""}>30 วัน: {c.doses_30d} ครั้ง</span>
                    <span>ล่าสุด {formatDateTime(c.last_medication_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">ชื่อเด็ก</th>
                    <th className="px-4 py-3 text-left">อายุ</th>
                    <th className="px-4 py-3 text-left">หมู่บ้าน</th>
                    <th className="px-4 py-3 text-left">ผู้ดูแล</th>
                    <th className="px-4 py-3 text-left">สถานะยาเหล็ก</th>
                    <th className="px-4 py-3 text-right">Hct</th>
                    <th className="px-4 py-3 text-left">กินยาล่าสุด</th>
                    <th className="px-4 py-3 text-right">30 วัน</th>
                    <th className="px-4 py-3 text-right">บันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3"><button onClick={() => setSelected(c.id)} className="font-medium text-left hover:text-teal-700 hover:underline">{c.name}</button></td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.age || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.village_name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.caregiver_name || "-"}</td>
                      <td className="px-4 py-3">{ironBadge(c.iron_status)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">{c.hct ? `${c.hct}%` : "-"}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(c.last_medication_at)}</td>
                      <td className={`px-4 py-3 text-right ${c.doses_30d === 0 ? "text-red-500" : "text-slate-700"}`}>{c.doses_30d} ครั้ง</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setLogFor(c)} className={`${btn.primary} px-2.5 py-1 text-xs whitespace-nowrap`}><Pill size={14} /> บันทึกกินยา</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <Empty text={onlyMissing ? "เด็กทุกคนมีบันทึกการกินยาใน 30 วัน" : "ไม่พบข้อมูล"} />}
          </Card>
        </>
      )}

      {logFor && <MedicineLogModal child={logFor} onClose={() => setLogFor(null)} onSaved={reload} />}
      {selected && <ChildDetailModal childId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-slate-50 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-2xl font-kanit font-bold leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}
