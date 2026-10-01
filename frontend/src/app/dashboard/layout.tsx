"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Users, AlertTriangle, UserCheck, 
  Apple, Pill, MapPin, UserPlus, ClipboardList, 
  Settings, LogOut, Search, Moon, RefreshCw
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    return pathname === path 
      ? "flex items-center gap-3 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg font-medium"
      : "flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg";
  };

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
              <Link href="/dashboard" className={getLinkClass("/dashboard")}>
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/dashboard/children" className={getLinkClass("/dashboard/children")}>
                <Users size={18} /> ข้อมูลเด็ก
              </Link>
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
          <Link href="/" className="flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg font-medium">
            <LogOut size={18} /> ออกจากระบบ
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="font-kanit font-semibold text-lg">IRON ZERO RISK</h1>
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

        {/* Page Content */}
        {children}

      </main>
    </div>
  );
}
