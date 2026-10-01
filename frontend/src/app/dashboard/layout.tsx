"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, AlertTriangle, UserCheck,
  Apple, Pill, MapPin, UserPlus, ClipboardList,
  Settings, LogOut, Search, RefreshCw, Menu, UserCog, Baby, ClipboardCheck, HeartPulse
} from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_LABEL, villageLabel } from "@/lib/constants";
import type { Me, Role } from "@/lib/types";
import { MeProvider, ToastProvider } from "@/components/AppContext";
import { Loading } from "@/components/ui";

// `exact`: only highlight on this path, not on its sub-pages.
type NavItem = { href: string; label: string; icon: React.ReactNode; roles?: Role[]; exact?: boolean };

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/dashboard/children", label: "ข้อมูลเด็ก", icon: <Users size={18} /> },
  { href: "/dashboard/risk", label: "การประเมินความเสี่ยง", icon: <AlertTriangle size={18} /> },
  { href: "/dashboard/assessment", label: "แบบประเมินรายบุคคล", icon: <UserCheck size={18} />, roles: ["admin", "staff"] },
  { href: "/dashboard/nutrition", label: "สถานะโภชนาการ", icon: <Apple size={18} /> },
  { href: "/dashboard/iron", label: "ยาธาตุเหล็ก", icon: <Pill size={18} /> },
];
const PREGNANCY_NAV: NavItem[] = [
  { href: "/dashboard/pregnancy", label: "ทะเบียนหญิงตั้งครรภ์", icon: <HeartPulse size={18} />, exact: true },
  { href: "/dashboard/pregnancy/assessment", label: "แบบประเมินหญิงตั้งครรภ์", icon: <ClipboardCheck size={18} />, roles: ["admin", "staff"] },
  { href: "/dashboard/pregnancy/add", label: "เพิ่มหญิงตั้งครรภ์", icon: <Baby size={18} />, roles: ["admin", "staff"] },
];
const MANAGE_NAV: NavItem[] = [
  { href: "/dashboard/villages", label: "หมู่บ้าน", icon: <MapPin size={18} /> },
  { href: "/dashboard/add", label: "เพิ่มข้อมูลเด็ก", icon: <UserPlus size={18} />, roles: ["admin", "staff"] },
  { href: "/dashboard/log", label: "บันทึกกิจกรรม", icon: <ClipboardList size={18} />, roles: ["admin", "staff"] },
  { href: "/dashboard/users", label: "จัดการผู้ใช้งาน", icon: <UserCog size={18} />, roles: ["admin"] },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: <Settings size={18} /> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Not logged in → api() redirects to the login page (ห้ามแสดงข้อมูล mock)
    api<Me>("/me").then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer after navigating
    setSidebarOpen(false);
  }, [pathname]);

  if (!me) return <div className="flex-1 flex items-center justify-center h-screen bg-slate-50"><Loading /></div>;

  const visible = (items: NavItem[]) => items.filter((i) => !i.roles || i.roles.includes(me.role));
  const linkClass = (item: NavItem) =>
    (item.exact ? pathname === item.href : pathname.startsWith(item.href))
      ? "flex items-center gap-3 px-3 py-2 bg-teal-50 text-teal-600 rounded-lg font-medium"
      : "flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg";
  const navSection = (title: string, items: NavItem[]) => (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 mb-2 px-3">{title}</p>
      <nav className="space-y-1">
        {visible(items).map((i) => (
          <Link key={i.href} href={i.href} className={linkClass(i)}>{i.icon} {i.label}</Link>
        ))}
      </nav>
    </div>
  );

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/dashboard/children?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <MeProvider value={me}>
      <ToastProvider>
        <div className="flex h-screen bg-slate-50 font-sarabun text-slate-800">
          {sidebarOpen && <div className="fixed inset-0 bg-slate-900/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

          {/* Sidebar */}
          <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-30 transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                <Image src="/icon.svg" alt="Iron Zero Risk" width={26} height={26} />
              </div>
              <div>
                <h2 className="font-kanit font-bold text-teal-600 leading-tight">Iron Zero Risk</h2>
                <p className="text-[11px] text-slate-500">ระบบติดตามสุขภาพเด็ก</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
              {navSection("เด็กปฐมวัย", MAIN_NAV)}
              {navSection("หญิงตั้งครรภ์", PREGNANCY_NAV)}
              {navSection("จัดการ", MANAGE_NAV)}
            </div>

            <div className="p-4 border-t border-slate-100">
              <a href="/auth/logout" className="flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg font-medium">
                <LogOut size={18} /> ออกจากระบบ
              </a>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden" aria-label="เปิดเมนู"><Menu size={20} /></button>
                <h1 className="font-kanit font-semibold text-lg hidden sm:block">IRON ZERO RISK</h1>
              </div>
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <form onSubmit={submitSearch} className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเด็ก..." className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm w-56 lg:w-64 focus:ring-2 focus:ring-teal-500 outline-none" />
                </form>
                <button onClick={() => window.location.reload()} title="รีเฟรชข้อมูล" className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><RefreshCw size={18} /></button>
                <Link href="/dashboard/settings" className="flex items-center gap-3 md:ml-2 md:pl-4 md:border-l border-slate-200 min-w-0">
                  <div className="text-right flex-col justify-center min-w-0 hidden sm:flex">
                    <p className="text-sm font-semibold leading-tight text-slate-800 truncate">{me.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">ตำแหน่ง: {me.position || ROLE_LABEL[me.role]}</p>
                    <p className="text-[11px] text-teal-600 font-medium truncate">
                      {me.role === "vhv" ? `รับผิดชอบ: ${villageLabel(me.assigned_village_no)}` : `สถานที่: ${me.hospital || "-"}`}
                    </p>
                  </div>
                  <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-full flex items-center justify-center font-semibold shadow-sm border-2 border-white">
                    {me.name.replace(/^(นาย|นางสาว|นาง|นพ\.|พญ\.|ทพ\.|ทพญ\.|ภก\.|ภญ\.)/, "").trim().charAt(0)}
                  </div>
                </Link>
              </div>
            </header>

            {/* Page Content */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </MeProvider>
  );
}
