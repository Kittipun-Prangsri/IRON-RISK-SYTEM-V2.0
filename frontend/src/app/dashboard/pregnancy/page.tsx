"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Download, X, Pill, Baby, AlertTriangle, Users, CalendarClock } from "lucide-react";
import { KHLONG_HAT_VILLAGES, RISK_LEVELS } from "@/lib/constants";
import { PREG_CSV_COLUMNS, downloadCSV, toCSV } from "@/lib/csv";
import { fmtNum, todayISO } from "@/lib/format";
import { PREG_MAX_SCORE, gestation, pregIronLabel } from "@/lib/pregnancy";
import type { Pregnancy } from "@/lib/types";
import { isStaff, useMe, usePregnancies } from "@/components/AppContext";
import { MedicineLogModal } from "@/components/ChildModals";
import { PregnancyDetailModal, PregnancyStatus } from "@/components/PregnancyModals";
import { Empty, ErrorBox, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

function PregnancyListContent() {
  const me = useMe();
  const params = useSearchParams();
  const { pregnancies, loading, error, reload } = usePregnancies();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [risk, setRisk] = useState(params.get("risk") ?? "");
  const [village, setVillage] = useState("");
  const [stage, setStage] = useState("pregnant");
  const [selected, setSelected] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<Pregnancy | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pregnancies.filter((p) => {
      const g = gestation(p.lmp_date);
      return (!risk || p.risk_level === risk) &&
        (!village || String(p.village_no) === village) &&
        (stage === "" ? true : stage === "delivered" ? !!p.delivered_on
          : !p.delivered_on && (stage === "pregnant" || (g && String(g.trimester) === stage))) &&
        (!q || [p.name, p.husband_name, p.village_name, p.house_number, p.phone].some((v) => v?.toLowerCase().includes(q)));
    });
  }, [pregnancies, search, risk, village, stage]);

  const current = pregnancies.filter((p) => !p.delivered_on);
  const high = current.filter((p) => p.risk_level === "เสี่ยงสูง").length;
  const anemic = current.filter((p) => p.hct && p.hct < 33).length;
  const noDose = current.filter((p) => p.doses_30d === 0).length;
  const hasFilter = search || risk || village || stage !== "pregnant";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="ทะเบียนหญิงตั้งครรภ์"
        subtitle="หญิงตั้งครรภ์กลุ่มเสี่ยงขาดธาตุเหล็ก — ติดตามอายุครรภ์ ผลเลือด และการกิน Triferdine"
        actions={<>
          <button onClick={() => downloadCSV(`iron-risk-pregnancies-${todayISO()}.csv`, toCSV(filtered, PREG_CSV_COLUMNS))} disabled={filtered.length === 0} className={btn.secondary}>
            <Download size={16} /> ส่งออก CSV
          </button>
          {isStaff(me) && <Link href="/dashboard/pregnancy/add" className={btn.primary}><Plus size={16} /> เพิ่มหญิงตั้งครรภ์</Link>}
        </>}
      />

      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={<Users className="text-pink-500" />} value={current.length} label="กำลังตั้งครรภ์" />
          <Stat icon={<AlertTriangle className="text-red-500" />} value={high} label="เสี่ยงสูง" />
          <Stat icon={<Baby className="text-amber-500" />} value={anemic} label="Hct ต่ำกว่า 33% (ภาวะซีด)" />
          <Stat icon={<CalendarClock className="text-slate-500" />} value={noDose} label="ไม่มีบันทึกกินยาใน 30 วัน" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="search" placeholder="ค้นหาชื่อ, สามี, หมู่บ้าน, เบอร์โทร..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${input} pl-9`} />
          </div>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={`${input} w-auto`}>
            <option value="pregnant">กำลังตั้งครรภ์</option>
            <option value="1">ไตรมาส 1</option>
            <option value="2">ไตรมาส 2</option>
            <option value="3">ไตรมาส 3</option>
            <option value="delivered">คลอดแล้ว</option>
            <option value="">ทั้งหมด</option>
          </select>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกระดับความเสี่ยง</option>
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={village} onChange={(e) => setVillage(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกหมู่บ้าน</option>
            {KHLONG_HAT_VILLAGES.map((v) => <option key={v.moo} value={v.moo}>หมู่ {v.moo} {v.name}</option>)}
          </select>
          {hasFilter && <button onClick={() => { setSearch(""); setRisk(""); setVillage(""); setStage("pregnant"); }} className={btn.ghost}><X size={14} /> ล้างตัวกรอง</button>}
          <span className="text-sm text-slate-500 ml-auto">พบ <b className="text-teal-600">{filtered.length}</b> จาก {pregnancies.length} คน</span>
        </div>

        {error ? <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div> : loading ? <Loading /> : (<>
          <ul className="md:hidden divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setSelected(p.id)} className="text-left min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">อายุ {p.age_years ?? "-"} ปี · {p.village_name || "-"}{p.village_no ? ` ม.${p.village_no}` : ""}</p>
                    <PregnancyStatus lmp={p.lmp_date} deliveredOn={p.delivered_on} />
                  </button>
                  <div className="text-right shrink-0"><RiskBadge level={p.risk_level} /><p className="text-xs text-slate-400 mt-1">{p.total_score}/{PREG_MAX_SCORE}</p></div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>Hct {fmtNum(p.hct, "%")} · {pregIronLabel(p.iron_status)} · 30 วัน: {p.doses_30d} ครั้ง</span>
                  {!p.delivered_on && <button onClick={() => setLogFor(p)} className={`${btn.primary} px-3 py-1.5 text-xs shrink-0`}><Pill size={14} /> บันทึกกินยา</button>}
                </div>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="px-4 py-3 font-semibold">อายุครรภ์</th>
                  <th className="px-4 py-3 font-semibold">หมู่บ้าน</th>
                  <th className="px-4 py-3 font-semibold">ความเสี่ยง</th>
                  <th className="px-4 py-3 font-semibold">Hct</th>
                  <th className="px-4 py-3 font-semibold">Triferdine</th>
                  <th className="px-4 py-3 font-semibold text-right">30 วัน</th>
                  <th className="px-4 py-3 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">อายุ {p.age_years ?? "-"} ปี · สามี {p.husband_name || "-"}</div>
                    </td>
                    <td className="px-4 py-3"><PregnancyStatus lmp={p.lmp_date} deliveredOn={p.delivered_on} /></td>
                    <td className="px-4 py-3 text-slate-600">{p.village_name || "-"}{p.village_no ? <span className="text-xs text-slate-400"> ม.{p.village_no}</span> : null}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><RiskBadge level={p.risk_level} /> <span className="text-xs text-slate-400">{p.total_score}/{PREG_MAX_SCORE}</span></td>
                    <td className={`px-4 py-3 font-medium ${p.hct && p.hct < 33 ? "text-red-600" : "text-slate-700"}`}>{fmtNum(p.hct, "%")}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{pregIronLabel(p.iron_status)}</td>
                    <td className={`px-4 py-3 text-right ${p.doses_30d === 0 ? "text-red-500" : ""}`}>{p.doses_30d}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!p.delivered_on && <button onClick={() => setLogFor(p)} className={btn.ghost}><Pill size={14} /> กินยา</button>}
                      <button onClick={() => setSelected(p.id)} className={btn.ghost}>ดูประวัติ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty text={pregnancies.length === 0 ? "ยังไม่มีข้อมูลหญิงตั้งครรภ์ในระบบ" : "ไม่พบข้อมูลที่ค้นหา"} />}
        </>)}
      </div>

      {selected && <PregnancyDetailModal id={selected} onClose={() => setSelected(null)} onChanged={reload} />}
      {logFor && <MedicineLogModal child={logFor} basePath="/pregnancies" drugName="ยา Triferdine" onClose={() => setLogFor(null)} onSaved={reload} />}
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

export default function PregnancyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PregnancyListContent />
    </Suspense>
  );
}
