"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { RISK_LEVELS, RISK_RECOMMENDATION, RISK_STYLE } from "@/lib/constants";
import { useChildren } from "@/components/AppContext";
import { ChildDetailModal } from "@/components/ChildModals";
import { ColoredBar } from "@/components/charts";
import { Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";

const HEADER: Record<string, string> = { เสี่ยงสูง: "🔴", เสี่ยงปานกลาง: "🟡", เสี่ยงต่ำ: "🟢" };

export default function RiskPage() {
  const { children, loading, error, reload } = useChildren();
  const [selected, setSelected] = useState<string | null>(null);

  const hctData = children
    .filter((c) => c.hct && c.hct > 0)
    .sort((a, b) => (a.hct ?? 0) - (b.hct ?? 0))
    .map((c) => ({ name: c.name.replace(/^ด\.?[ชญ]\.?\s*/, ""), hct: c.hct, color: RISK_STYLE[c.risk_level].color }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="การประเมินความเสี่ยง" subtitle="เด็กจำแนกตามระดับความเสี่ยงภาวะโลหิตจางจากการขาดธาตุเหล็ก (คะแนน 0-10: ≥4 เสี่ยงสูง, 2-3 ปานกลาง, 0-1 ต่ำ)" />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {RISK_LEVELS.map((level) => {
              const list = children.filter((c) => c.risk_level === level).sort((a, b) => b.total_score - a.total_score);
              return (
                <Card key={level} title={`${HEADER[level]} ${level} (${list.length})`} className="flex flex-col">
                  <p className="px-5 pt-3 text-xs text-slate-500"><b>{RISK_RECOMMENDATION[level].title}:</b> {RISK_RECOMMENDATION[level].text}</p>
                  <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                    {list.length === 0 ? <Empty text={`ไม่มีเด็กกลุ่ม${level}`} /> : list.map((c) => (
                      <button key={c.id} onClick={() => setSelected(c.id)} className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/40">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          <p className="text-xs text-slate-500 truncate">{c.village_name || "-"} · Hct {c.hct ?? "-"}% · {c.nutrition_status || "-"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold" style={{ color: RISK_STYLE[level].color }}>{c.total_score}/10</span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card title="ค่า Hct รายบุคคล (เส้นประ = เกณฑ์ 33% และ 30%)">
            <div className="p-4" style={{ height: Math.max(260, hctData.length * 26) }}>
              {hctData.length === 0 ? <Empty text="ยังไม่มีผลตรวจ Hct" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hctData} layout="vertical" margin={{ left: 20, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" domain={[20, 45]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} interval={0} />
                    <Tooltip formatter={(v) => [`${v}%`, "Hct"]} />
                    <ReferenceLine x={33} stroke="#d97706" strokeDasharray="4 4" />
                    <ReferenceLine x={30} stroke="#dc2626" strokeDasharray="4 4" />
                    <Bar dataKey="hct" radius={[0, 4, 4, 0]} shape={ColoredBar} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </>
      )}

      {selected && <ChildDetailModal childId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}
