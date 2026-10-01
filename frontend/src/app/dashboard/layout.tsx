"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, AlertTriangle, UserCheck, 
  Apple, Pill, MapPin, UserPlus, ClipboardList, 
  Settings, LogOut, Search, Moon, RefreshCw
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{name: string, position: string, hospital: string, initials: string} | null>(null);

  useEffect(() => {
    // Read healthid_profile cookie (set by backend from MOPH Provider ID profile)
    const healthidCookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('healthid_profile='));
    try {
      if (!healthidCookie) throw new Error('No healthid_profile cookie');
      // Decode URI component since Express encodes cookies by default
      const data = JSON.parse(decodeURIComponent(healthidCookie.slice('healthid_profile='.length)));
      if (!data.name) throw new Error('healthid_profile has no name');

      setProfile({
        name: data.name,
        position: data.position || '-',
        hospital: data.hospital || '-',
        initials: (data.first_name || data.name).charAt(0),
      });
    } catch (e) {
      // ไม่มีข้อมูลผู้ใช้จริงจาก MOPH ID → กลับไปหน้า login (ห้ามแสดงข้อมูล mock)
      console.error('Invalid HealthID session', e);
      window.location.replace('/');
    }
  }, []);

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
              <Link href="/dashboard/risk" className={getLinkClass("/dashboard/risk")}>
                <AlertTriangle size={18} /> การประเมินความเสี่ยง
              </Link>
              <Link href="/dashboard/assessment" className={getLinkClass("/dashboard/assessment")}>
                <UserCheck size={18} /> แบบประเมินรายบุคคล
              </Link>
              <Link href="/dashboard/nutrition" className={getLinkClass("/dashboard/nutrition")}>
                <Apple size={18} /> สถานะโภชนาการ
              </Link>
              <Link href="/dashboard/iron" className={getLinkClass("/dashboard/iron")}>
                <Pill size={18} /> ยาธาตุเหล็ก
              </Link>
            </nav>
          </div>
          
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2 px-3">จัดการ</p>
            <nav className="space-y-1">
              <Link href="/dashboard/villages" className={getLinkClass("/dashboard/villages")}>
                <MapPin size={18} /> หมู่บ้าน
              </Link>
              <Link href="/dashboard/add" className={getLinkClass("/dashboard/add")}>
                <UserPlus size={18} /> เพิ่มข้อมูลเด็ก
              </Link>
              <Link href="/dashboard/log" className={getLinkClass("/dashboard/log")}>
                <ClipboardList size={18} /> บันทึกกิจกรรม
              </Link>
              <Link href="/dashboard/users" className={getLinkClass("/dashboard/users")}>
                <Users size={18} /> จัดการผู้ใช้งาน
              </Link>
              <Link href="/dashboard/settings" className={getLinkClass("/dashboard/settings")}>
                <Settings size={18} /> ตั้งค่า
              </Link>
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <a href="/auth/logout" className="flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg font-medium">
            <LogOut size={18} /> ออกจากระบบ
          </a>
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
              <div className="text-right flex flex-col justify-center">
                <p className="text-sm font-semibold leading-tight text-slate-800">{profile?.name ?? '…'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">ตำแหน่ง: {profile?.position ?? '…'}</p>
                <p className="text-[11px] text-teal-600 font-medium">สถานที่: {profile?.hospital ?? '…'}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-full flex items-center justify-center font-semibold shadow-sm border-2 border-white">
                {profile?.initials ?? ''}
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
