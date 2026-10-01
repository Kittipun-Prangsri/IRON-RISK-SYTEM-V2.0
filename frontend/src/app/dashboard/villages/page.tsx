"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { KHLONG_HAT_VILLAGES, RISK_LEVELS, RISK_STYLE } from "@/lib/constants";
import { useChildren } from "@/components/AppContext";
import { ChildDetailModal } from "@/components/ChildModals";
import { Card, ErrorBox, Loading, PageHeader } from "@/components/ui";

const ChildrenMap = dynamic(() => import("@/components/ChildrenMap"), { ssr: false, loading: () => <Loading label="กำลังโหลดแผนที่..." /> });

export default function VillagesPage() {
  const { children, loading, error, reload } = useChildren();
  const [selected, setSelected] = useState<string | null>(null);

  const villages = KHLONG_HAT_VILLAGES.map((v) => {
    const list = children.filter((c) => c.village_no === v.moo);
    return { ...v, total: list.length, byRisk: RISK_LEVELS.map((r) => list.filter((c) => c.risk_level === r).length) };
  });
  const others = children.filter((c) => !KHLONG_HAT_VILLAGES.some((v) => v.moo === c.village_no));
  const withCoords = children.filter((c) => c.latitude != null && c.longitude != null);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="หมู่บ้าน" subtitle="ข้อมูลเด็กแยกตามหมู่บ้านในตำบลคลองหาด" />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {villages.map((v) => (
              <Link key={v.moo} href={`/dashboard/children?village=${v.moo}`} className={`bg-white rounded-xl border shadow-sm p-4 hover:border-teal-300 hover:shadow ${v.total ? "border-slate-200" : "border-dashed border-slate-200 opacity-70"}`}>
                <p className="text-xs text-slate-500">หมู่ {v.moo}</p>
                <p className="font-kanit font-medium text-slate-800 truncate">{v.name}</p>
                <p className="text-2xl font-kanit font-bold text-teal-600 mt-1">{v.total} <span className="text-sm font-normal text-slate-500">คน</span></p>
                <div className="flex gap-2 mt-2 text-[11px]">
                  {RISK_LEVELS.map((r, i) => v.byRisk[i] > 0 && (
                    <span key={r} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${RISK_STYLE[r].dot}`} />{v.byRisk[i]}</span>
                  ))}
                </div>
              </Link>
            ))}
            {others.length > 0 && (
              <Link href="/dashboard/children" className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-teal-300">
                <p className="text-xs text-slate-500">นอกตำบลคลองหาด / ไม่ระบุหมู่</p>
                <p className="text-2xl font-kanit font-bold text-slate-600 mt-1">{others.length} <span className="text-sm font-normal text-slate-500">คน</span></p>
              </Link>
            )}
          </div>

          <Card title="แผนที่ตำแหน่งเด็กในชุมชน" actions={
            <span className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
              {RISK_LEVELS.map((r) => <span key={r} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${RISK_STYLE[r].dot}`} />{r}</span>)}
              <span>· มีพิกัด {withCoords.length}/{children.length} คน</span>
            </span>
          }>
            <ChildrenMap items={withCoords} onSelect={setSelected} />
          </Card>
        </>
      )}

      {selected && <ChildDetailModal childId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}
