"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Download, X } from "lucide-react";
import { KHLONG_HAT_VILLAGES, NUTRITION_OPTIONS, RISK_LEVELS, ironLabel } from "@/lib/constants";
import { childrenToCSV, downloadCSV } from "@/lib/csv";
import { fmtNum, todayISO } from "@/lib/format";
import { isStaff, useChildren, useMe } from "@/components/AppContext";
import { ChildDetailModal } from "@/components/ChildModals";
import { Empty, ErrorBox, Loading, PageHeader, RiskBadge, btn, input } from "@/components/ui";

function ChildrenContent() {
  const me = useMe();
  const params = useSearchParams();
  const { children, loading, error, reload } = useChildren();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [risk, setRisk] = useState(params.get("risk") ?? "");
  const [village, setVillage] = useState(params.get("village") ?? "");
  const [nutrition, setNutrition] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children.filter((c) =>
      (!risk || c.risk_level === risk) &&
      (!village || String(c.village_no) === village) &&
      (!nutrition || (c.nutrition_status || "") === nutrition) &&
      (!q || [c.name, c.caregiver_name, c.village_name, c.house_number].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [children, search, risk, village, nutrition]);

  const hasFilter = search || risk || village || nutrition;
  const clear = () => { setSearch(""); setRisk(""); setVillage(""); setNutrition(""); };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="ข้อมูลเด็ก / ทะเบียนเด็ก"
        subtitle="รายชื่อและข้อมูลสุขภาพของเด็กทั้งหมดในพื้นที่"
        actions={<>
          <button onClick={() => downloadCSV(`iron-risk-children-${todayISO()}.csv`, childrenToCSV(filtered))} disabled={filtered.length === 0} className={btn.secondary}>
            <Download size={16} /> ส่งออก CSV
          </button>
          {isStaff(me) && <Link href="/dashboard/add" className={btn.primary}><Plus size={16} /> เพิ่มข้อมูลเด็ก</Link>}
        </>}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="search" placeholder="ค้นหาชื่อเด็ก, ผู้ดูแล, หมู่บ้าน, บ้านเลขที่..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${input} pl-9`} />
          </div>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกระดับความเสี่ยง</option>
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={village} onChange={(e) => setVillage(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกหมู่บ้าน</option>
            {KHLONG_HAT_VILLAGES.map((v) => <option key={v.moo} value={v.moo}>หมู่ {v.moo} {v.name}</option>)}
          </select>
          <select value={nutrition} onChange={(e) => setNutrition(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกภาวะโภชนาการ</option>
            {NUTRITION_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {hasFilter && <button onClick={clear} className={btn.ghost}><X size={14} /> ล้างตัวกรอง</button>}
          <span className="text-sm text-slate-500 ml-auto">พบ <b className="text-teal-600">{filtered.length}</b> จาก {children.length} คน</span>
        </div>

        {error ? <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div> : loading ? <Loading /> : (<>
          {/* Phones: cards instead of a wide table */}
          <ul className="md:hidden divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)} className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.age || "-"} · {c.village_name || "-"}{c.village_no ? ` ม.${c.village_no}` : ""}</p>
                    <p className="text-xs text-slate-500">Hct {fmtNum(c.hct, "%")} · {c.nutrition_status || "-"} · {ironLabel(c.iron_status)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <RiskBadge level={c.risk_level} />
                    <p className="text-xs text-slate-400 mt-1">{c.total_score}/10</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="px-4 py-3 font-semibold">อายุ</th>
                  <th className="px-4 py-3 font-semibold">หมู่บ้าน</th>
                  <th className="px-4 py-3 font-semibold">ความเสี่ยง</th>
                  <th className="px-4 py-3 font-semibold">Hct</th>
                  <th className="px-4 py-3 font-semibold">น้ำหนัก/ส่วนสูง</th>
                  <th className="px-4 py-3 font-semibold">โภชนาการ</th>
                  <th className="px-4 py-3 font-semibold">ยาเหล็ก</th>
                  <th className="px-4 py-3 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">ผู้ดูแล: {c.caregiver_name || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.age || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.village_name || "-"}{c.village_no ? <span className="text-xs text-slate-400"> ม.{c.village_no}</span> : null}</td>
                    <td className="px-4 py-3"><RiskBadge level={c.risk_level} /> <span className="text-xs text-slate-400">{c.total_score}/10</span></td>
                    <td className="px-4 py-3 font-medium text-slate-700">{fmtNum(c.hct, "%")}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtNum(c.weight_kg)} / {fmtNum(c.height_cm)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.nutrition_status || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{ironLabel(c.iron_status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(c.id)} className={btn.ghost}>ดูประวัติ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty text={children.length === 0 ? "ยังไม่มีข้อมูลเด็กในระบบ" : "ไม่พบข้อมูลที่ค้นหา"} />}
        </>)}
      </div>

      {selected && <ChildDetailModal childId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}

export default function ChildrenPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ChildrenContent />
    </Suspense>
  );
}
