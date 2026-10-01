"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, Users, AlertTriangle, UserCheck, 
  Apple, Pill, MapPin, UserPlus, ClipboardList, 
  Settings, LogOut, Search, Moon, RefreshCw, FileText
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";

import { Suspense } from "react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const SCRIPT_URL = "/api/data";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(SCRIPT_URL);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Stats
  const children = data?.children || [];
  const totalChildren = children.length;
  const highRisk = children.filter((c: any) => c.status === "เสี่ยงสูง").length;
  const medRisk = children.filter((c: any) => c.status === "เสี่ยงปานกลาง").length;
  const lowRisk = children.filter((c: any) => c.status === "เสี่ยงต่ำ").length;
  
  const validHct = children.filter((c: any) => parseFloat(c.hct) > 0);
  const avgHct = validHct.length > 0 
    ? (validHct.reduce((acc: number, curr: any) => acc + parseFloat(curr.hct), 0) / validHct.length).toFixed(1) 
    : "0";
    
  const ironSupplements = children.filter((c: any) => c.iron === "ได้" || c.iron === "สม่ำเสมอ").length;
  const ironPercent = totalChildren > 0 ? Math.round((ironSupplements / totalChildren) * 100) : 0;

  // Chart Data: Risk Level
  const riskData = [
    { name: 'เสี่ยงสูง', value: highRisk, color: '#ef4444' },
    { name: 'เสี่ยงปานกลาง', value: medRisk, color: '#f59e0b' },
    { name: 'เสี่ยงต่ำ', value: lowRisk, color: '#10b981' },
  ];

  // Chart Data: Nutrition
  const nutCounts = children.reduce((acc: any, curr: any) => {
    const status = curr.nutrition || 'ไม่ระบุ';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const nutritionData = Object.keys(nutCounts).map(key => ({
    name: key,
    value: nutCounts[key],
    color: key === 'สมส่วน' ? '#10b981' : key.includes('ผอม') ? '#f59e0b' : '#ef4444'
  }));

  return (
    <>
      {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="font-kanit text-xl font-semibold mb-1">Dashboard ภาพรวม</h2>
            <p className="text-sm text-slate-500">สรุปข้อมูลสุขภาพเด็กในชุมชน</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-teal-500" size={32} /></div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={<Users size={20} className="text-teal-500"/>} title="เด็กทั้งหมด" value={totalChildren} sub="ในระบบ" color="border-teal-500" />
                <StatCard icon={<AlertTriangle size={20} className="text-red-500"/>} title="เสี่ยงสูง" value={highRisk} sub="ต้องติดตามด่วน" color="border-red-500" />
                <StatCard icon={<AlertTriangle size={20} className="text-amber-500"/>} title="เสี่ยงปานกลาง" value={medRisk} sub="ต้องติดตาม" color="border-amber-500" />
                <StatCard icon={<UserCheck size={20} className="text-green-500"/>} title="เสี่ยงต่ำ" value={lowRisk} sub="ปลอดภัย" color="border-green-500" />
                <StatCard icon={<FileText size={20} className="text-blue-500"/>} title="Hct เฉลี่ย (%)" value={avgHct} sub="ค่าฮีมาโตคริต" color="border-blue-500" />
                <StatCard icon={<Pill size={20} className="text-purple-500"/>} title="ได้รับยาเหล็ก" value={ironSupplements} sub="-" color="border-purple-500" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Risk Level Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1">
                  <h3 className="font-kanit font-medium mb-4">ระดับความเสี่ยง</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={riskData} innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                          {riskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-3 text-xs mt-2">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> เสี่ยงสูง</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div> ปานกลาง</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> ต่ำ</span>
                  </div>
                </div>

                {/* Nutrition Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1">
                  <h3 className="font-kanit font-medium mb-4">สถานะโภชนาการ</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nutritionData} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                        <RechartsTooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {nutritionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Blank Chart Placeholder 1 */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1 flex flex-col">
                  <h3 className="font-kanit font-medium mb-4">เด็กแยกตามหมู่บ้าน</h3>
                  <div className="flex-1 flex items-center justify-center border-l border-b border-slate-100 relative">
                    <span className="text-slate-300 text-xs absolute bottom-1 left-2">0</span>
                    <span className="text-slate-300 text-xs absolute top-1 left-2">1</span>
                  </div>
                </div>

                {/* Blank Chart Placeholder 2 */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1 flex flex-col">
                  <h3 className="font-kanit font-medium mb-4">กลุ่มอายุ</h3>
                  <div className="flex-1 flex items-end justify-between border-l border-b border-slate-100 pb-1 px-2 relative text-[10px] text-slate-400">
                    <span className="text-slate-300 text-xs absolute bottom-1 -left-3">0</span>
                    <span className="text-slate-300 text-xs absolute top-1 -left-3">1</span>
                    <span>9 เดือน</span><span>1 ปี</span><span>2 ปี</span><span>3 ปี</span><span>4 ปี</span><span>5 ปี</span>
                  </div>
                </div>

              </div>

              {/* Progress Bar */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h3 className="font-kanit font-medium">ความครอบคลุมยาธาตุเหล็ก</h3>
                    <p className="text-xs text-slate-500 mt-1">ได้รับยาเหล็ก</p>
                  </div>
                  <span className="text-teal-500 font-bold">{ironPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${ironPercent}%` }}></div>
                </div>
              </div>

            </>
          )}
        </div>
    </>
  );
}

function StatCard({ icon, title, value, sub, color }: any) {
  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border-t-4 border-x border-b border-slate-200 ${color} flex flex-col justify-between h-28`}>
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mb-2">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{title}</p>
        <div className="flex items-end gap-2">
          <h3 className="text-2xl font-kanit font-bold leading-none">{value}</h3>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">กำลังโหลดข้อมูล...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
