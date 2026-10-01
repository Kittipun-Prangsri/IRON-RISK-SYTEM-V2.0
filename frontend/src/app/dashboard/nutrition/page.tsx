"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import { NUTRITION_OPTIONS } from "@/lib/constants";
import { fmtNum } from "@/lib/format";
import { useChildren } from "@/components/AppContext";
import { ChildDetailModal } from "@/components/ChildModals";
import { ColoredBar, ColoredSector } from "@/components/charts";
import { Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";

const COLOR: Record<string, string> = {
  สมส่วน: "#059669", ค่อนข้างผอม: "#d97706", ผอม: "#dc2626", เริ่มอ้วน: "#7c3aed", อ้วน: "#be185d", ไม่ระบุ: "#94a3b8",
};
const TEXT_COLOR: Record<string, string> = { ผอม: "text-red-600", ค่อนข้างผอม: "text-amber-600", สมส่วน: "text-emerald-600", เริ่มอ้วน: "text-violet-600", อ้วน: "text-pink-700" };

function bmi(weight: number | null, height: number | null) {
  if (!weight || !height) return null;
  return Math.round((weight / (height / 100) ** 2) * 10) / 10;
}

export default function NutritionPage() {
  const { children, loading, error, reload } = useChildren();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const dist = [...NUTRITION_OPTIONS, "ไม่ระบุ"]
    .map((n) => ({ name: n, color: COLOR[n], value: children.filter((c) => (c.nutrition_status || "ไม่ระบุ") === n).length }))
    .filter((d) => d.value > 0);
  const weightData = children
    .filter((c) => c.weight_kg)
    .map((c) => ({ name: c.name.replace(/^ด\.?[ชญ]\.?\s*/, ""), weight: c.weight_kg, color: COLOR[c.nutrition_status || "ไม่ระบุ"] }));
  const rows = children.filter((c) => !filter || (c.nutrition_status || "ไม่ระบุ") === filter);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="สถานะโภชนาการ" subtitle="ข้อมูลน้ำหนัก ส่วนสูง และ BMI ของเด็ก" />

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="การกระจายสถานะโภชนาการ">
              <div className="h-72 p-4">
                {dist.length === 0 ? <Empty text="ไม่มีข้อมูล" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dist} dataKey="value" nameKey="name" outerRadius={95} label={({ name, value }) => `${name} ${value}`} shape={ColoredSector} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card title="น้ำหนัก (กก.) รายบุคคล">
              <div className="h-72 p-4">
                {weightData.length === 0 ? <Empty text="ไม่มีข้อมูลน้ำหนัก" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weightData} margin={{ left: -16, right: 8, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-40} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} กก.`, "น้ำหนัก"]} />
                      <Bar dataKey="weight" radius={[4, 4, 0, 0]} shape={ColoredBar} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card title="ตารางน้ำหนัก-ส่วนสูง" actions={
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1">
              <option value="">ทุกภาวะโภชนาการ</option>
              {dist.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.value})</option>)}
            </select>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">ชื่อเด็ก</th>
                    <th className="px-4 py-3 text-left">อายุ</th>
                    <th className="px-4 py-3 text-right">น้ำหนัก (กก.)</th>
                    <th className="px-4 py-3 text-right">ส่วนสูง (ซม.)</th>
                    <th className="px-4 py-3 text-right">BMI</th>
                    <th className="px-4 py-3 text-left">โภชนาการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => setSelected(c.id)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.age || "-"}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(c.weight_kg)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(c.height_cm)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmtNum(bmi(c.weight_kg, c.height_cm))}</td>
                      <td className={`px-4 py-3 font-semibold ${TEXT_COLOR[c.nutrition_status ?? ""] ?? "text-slate-400"}`}>{c.nutrition_status || "ไม่ระบุ"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty text="ไม่พบข้อมูลโภชนาการ" />}
            </div>
          </Card>
        </>
      )}

      {selected && <ChildDetailModal childId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}
