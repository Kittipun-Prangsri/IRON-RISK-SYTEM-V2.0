"use client";
import Link from "next/link";
import { Users, AlertTriangle, UserCheck, Pill, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie
} from "recharts";
import { ColoredBar, ColoredSector } from "@/components/charts";
import { AGE_OPTIONS, NUTRITION_OPTIONS, RISK_LEVELS, RISK_STYLE, ironReceived } from "@/lib/constants";
import { useChildren } from "@/components/AppContext";
import { Card, Empty, ErrorBox, Loading, RiskBadge } from "@/components/ui";

const NUTRITION_COLOR: Record<string, string> = {
  สมส่วน: "#059669", ค่อนข้างผอม: "#d97706", ผอม: "#dc2626", เริ่มอ้วน: "#7c3aed", อ้วน: "#be185d", ไม่ระบุ: "#94a3b8",
};

export default function Dashboard() {
  const { children, loading, error, reload } = useChildren();

  const total = children.length;
  const countRisk = (r: string) => children.filter((c) => c.risk_level === r).length;
  const withHct = children.filter((c) => c.hct && c.hct > 0);
  const avgHct = withHct.length ? (withHct.reduce((s, c) => s + (c.hct ?? 0), 0) / withHct.length).toFixed(1) : "-";
  const ironGot = children.filter((c) => ironReceived(c.iron_status)).length;
  const ironPercent = total ? Math.round((ironGot / total) * 100) : 0;

  const riskData = RISK_LEVELS.map((r) => ({ name: r, value: countRisk(r), color: RISK_STYLE[r].color }));
  const nutritionData = [...NUTRITION_OPTIONS, "ไม่ระบุ"]
    .map((n) => ({ name: n, color: NUTRITION_COLOR[n], value: children.filter((c) => (c.nutrition_status || "ไม่ระบุ") === n).length }))
    .filter((d) => d.value > 0);

  const villageMap = new Map<string, Record<string, number>>();
  for (const c of children) {
    const key = c.village_no ? `ม.${c.village_no}` : "ไม่ระบุ";
    const row = villageMap.get(key) ?? { เสี่ยงสูง: 0, เสี่ยงปานกลาง: 0, เสี่ยงต่ำ: 0 };
    row[c.risk_level]++;
    villageMap.set(key, row);
  }
  const villageData = [...villageMap.entries()]
    .sort(([a], [b]) => (parseInt(a.slice(2)) || 999) - (parseInt(b.slice(2)) || 999))
    .map(([name, v]) => ({ name, ...v }));
  const ageData = AGE_OPTIONS.map((a) => ({ name: a, value: children.filter((c) => c.age === a).length }));

  const urgent = children.filter((c) => c.risk_level === "เสี่ยงสูง").slice(0, 6);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="font-kanit text-xl font-semibold mb-1">Dashboard ภาพรวม</h2>
        <p className="text-sm text-slate-500">สรุปข้อมูลสุขภาพเด็กในชุมชน</p>
      </div>

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard icon={<Users size={20} className="text-teal-500" />} title="เด็กทั้งหมด" value={total} sub="ในระบบ" color="border-teal-500" />
            <StatCard icon={<AlertTriangle size={20} className="text-red-500" />} title="เสี่ยงสูง" value={countRisk("เสี่ยงสูง")} sub="ต้องติดตามด่วน" color="border-red-500" />
            <StatCard icon={<AlertTriangle size={20} className="text-amber-500" />} title="เสี่ยงปานกลาง" value={countRisk("เสี่ยงปานกลาง")} sub="ต้องติดตาม" color="border-amber-500" />
            <StatCard icon={<UserCheck size={20} className="text-green-500" />} title="เสี่ยงต่ำ" value={countRisk("เสี่ยงต่ำ")} sub="เฝ้าระวังปกติ" color="border-green-500" />
            <StatCard icon={<FileText size={20} className="text-blue-500" />} title="Hct เฉลี่ย (%)" value={avgHct} sub={`จาก ${withHct.length} คนที่มีผลเลือด`} color="border-blue-500" />
            <StatCard icon={<Pill size={20} className="text-purple-500" />} title="ได้รับยาเหล็ก" value={ironGot} sub={`${ironPercent}% ของเด็กทั้งหมด`} color="border-purple-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card title="ระดับความเสี่ยง" className="p-0">
              <div className="h-48 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskData} innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" shape={ColoredSector} />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 text-xs pb-4">
                {riskData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: d.color }} /> {d.name} ({d.value})</span>
                ))}
              </div>
            </Card>

            <Card title="สถานะโภชนาการ">
              <div className="h-56 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nutritionData} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="value" name="จำนวน" radius={[0, 4, 4, 0]} shape={ColoredBar} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="เด็กแยกตามหมู่บ้าน">
              <div className="h-56 p-3">
                {villageData.length === 0 ? <Empty text="ไม่มีข้อมูล" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={villageData} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      {RISK_LEVELS.map((r) => <Bar key={r} dataKey={r} stackId="v" fill={RISK_STYLE[r].color} />)}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="กลุ่มอายุ">
              <div className="h-56 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="value" name="จำนวน" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="ความครอบคลุมยาธาตุเหล็ก" className="p-0">
              <div className="p-5">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-sm text-slate-500">ได้รับยาเหล็ก {ironGot} จาก {total} คน</p>
                  <span className="text-teal-600 font-bold text-lg">{ironPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${ironPercent}%` }} />
                </div>
                <Link href="/dashboard/iron" className="inline-block mt-4 text-sm text-teal-700 hover:underline">ดูรายละเอียดยาธาตุเหล็ก →</Link>
              </div>
            </Card>

            <Card title="เด็กกลุ่มเสี่ยงสูงที่ต้องติดตาม" actions={<Link href="/dashboard/risk" className="text-xs text-teal-700 hover:underline">ดูทั้งหมด</Link>}>
              {urgent.length === 0 ? <Empty text="ไม่มีเด็กกลุ่มเสี่ยงสูง" /> : (
                <ul className="divide-y divide-slate-100">
                  {urgent.map((c) => (
                    <li key={c.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.village_name || "-"} · Hct {c.hct ?? "-"}% · คะแนน {c.total_score}/10</p>
                      </div>
                      <RiskBadge level={c.risk_level} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, sub, color }: { icon: React.ReactNode; title: string; value: React.ReactNode; sub: string; color: string }) {
  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border-t-4 border-x border-b border-slate-200 ${color} flex flex-col justify-between min-h-28`}>
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mb-2">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{title}</p>
        <h3 className="text-2xl font-kanit font-bold leading-none">{value}</h3>
        <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}
