"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <div className="flex h-screen bg-slate-50 font-sarabun text-slate-800">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="font-kanit font-bold text-teal-600 leading-tight">Iron Zero Risk</h2>
            <p className="text-[11px] text-slate-500">ระบบติดตามสุขภาพเด็ก</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2 px-3">หลัก</p>
            <nav className="space-y-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg font-medium">
                <LayoutDashboard size={18} /> Dashboard
              </a>
              <a href="#" className="flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3"><Users size={18} /> ข้อมูลเด็ก</div>
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{totalChildren}</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <AlertTriangle size={18} /> การประเมินความเสี่ยง
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <UserCheck size={18} /> แบบประเมินรายบุคคล
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <Apple size={18} /> สถานะโภชนาการ
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <Pill size={18} /> ยาธาตุเหล็ก
              </a>
            </nav>
          </div>
          
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2 px-3">จัดการ</p>
            <nav className="space-y-1">
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <MapPin size={18} /> หมู่บ้าน
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <UserPlus size={18} /> เพิ่มข้อมูลเด็ก
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <ClipboardList size={18} /> บันทึกกิจกรรม
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <Users size={18} /> จัดการผู้ใช้งาน
              </a>
              <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                <Settings size={18} /> ตั้งค่า
              </a>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg font-medium">
            <LogOut size={18} /> ออกจากระบบ
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="font-kanit font-semibold text-lg">Dashboard ภาพรวม</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="ค้นหาเด็ก..." className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><Moon size={18} /></button>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><RefreshCw size={18} /></button>
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">นพ. สมชาย รักดี</p>
                <p className="text-[11px] text-slate-500">เจ้าหน้าที่ รพ.</p>
              </div>
              <div className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-semibold">
                น
              </div>
            </div>
          </div>
        </header>

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
      </main>
    </div>
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
