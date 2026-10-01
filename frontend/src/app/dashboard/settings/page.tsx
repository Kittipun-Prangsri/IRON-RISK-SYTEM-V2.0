"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, ClipboardList, LogOut, Info, User, Database } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { ROLE_LABEL, villageLabel } from "@/lib/constants";
import { CHILD_CSV_COLUMNS, downloadCSV, toCSV } from "@/lib/csv";
import { formatDateTime, todayISO } from "@/lib/format";
import type { Child } from "@/lib/types";
import { isStaff, useMe, useToast } from "@/components/AppContext";
import { Card, PageHeader, btn } from "@/components/ui";

const TABS = [
  { id: "profile", label: "ข้อมูลผู้ใช้งาน", icon: <User size={16} /> },
  { id: "data", label: "การจัดการข้อมูล", icon: <Database size={16} /> },
  { id: "about", label: "เกี่ยวกับระบบ", icon: <Info size={16} /> },
] as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value || "-"}</span>
    </div>
  );
}

export default function SettingsPage() {
  const me = useMe();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("profile");
  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const children = await api<Child[]>("/children");
      downloadCSV(`iron-risk-children-${todayISO()}.csv`, toCSV(children, CHILD_CSV_COLUMNS));
      toast(`ส่งออกข้อมูลเด็ก ${children.length} คนแล้ว`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="ตั้งค่าระบบ" subtitle="ข้อมูลผู้ใช้งาน เครื่องมือจัดการข้อมูล และข้อมูลระบบ" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <nav className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex md:flex-col gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap text-left ${tab === t.id ? "bg-teal-50 text-teal-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <div className="md:col-span-3">
          {tab === "profile" && (
            <Card title="ข้อมูลผู้ใช้งาน (จาก MOPH Provider ID)" className="p-0">
              <div className="px-5 py-2">
                <Row label="ชื่อ-นามสกุล" value={me.name} />
                <Row label="ตำแหน่ง" value={me.position} />
                <Row label="หน่วยบริการ" value={me.hospital && `${me.hospital}${me.hcode ? ` (${me.hcode})` : ""}`} />
                <Row label="บทบาทในระบบ" value={ROLE_LABEL[me.role]} />
                {me.role === "vhv" && <Row label="หมู่บ้านที่รับผิดชอบ" value={villageLabel(me.assigned_village_no)} />}
                <Row label="เบอร์โทรศัพท์" value={me.phone} />
                <Row label="เข้าสู่ระบบล่าสุด" value={formatDateTime(me.last_login_at)} />
              </div>
              <div className="px-5 pb-5">
                <p className="text-xs text-slate-500 mb-3">ชื่อและตำแหน่งดึงจาก MOPH ID ทุกครั้งที่เข้าสู่ระบบ หากไม่ถูกต้องให้แก้ไขที่ระบบ Provider ID ของกระทรวง</p>
                <a href="/auth/logout" className={btn.dangerSoft}><LogOut size={16} /> ออกจากระบบ</a>
              </div>
            </Card>
          )}

          {tab === "data" && (
            <Card title="เครื่องมือจัดการข้อมูล" className="p-0">
              <div className="divide-y divide-slate-100">
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">ส่งออกข้อมูลเด็กทั้งหมด</p>
                    <p className="text-xs text-slate-500">ไฟล์ CSV เปิดด้วย Excel ได้ และนำกลับเข้าระบบได้ที่เมนูเพิ่มข้อมูลเด็ก</p>
                  </div>
                  <button onClick={exportAll} disabled={exporting} className={btn.secondary}><Download size={16} /> {exporting ? "กำลังส่งออก..." : "Export CSV"}</button>
                </div>
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">รีเฟรชข้อมูล</p>
                    <p className="text-xs text-slate-500">โหลดข้อมูลล่าสุดจากฐานข้อมูลใหม่</p>
                  </div>
                  <button onClick={() => window.location.reload()} className={btn.secondary}><RefreshCw size={16} /> Refresh</button>
                </div>
                {isStaff(me) && (
                  <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">ประวัติการใช้งาน</p>
                      <p className="text-xs text-slate-500">ดูว่าใครเพิ่ม แก้ไข หรือลบข้อมูลเมื่อไร</p>
                    </div>
                    <Link href="/dashboard/log" className={btn.secondary}><ClipboardList size={16} /> ดูบันทึกกิจกรรม</Link>
                  </div>
                )}
              </div>
            </Card>
          )}

          {tab === "about" && (
            <Card title="เกี่ยวกับระบบ" className="p-0">
              <div className="px-5 py-2">
                <Row label="ชื่อแอปพลิเคชัน" value="Iron Zero Risk System" />
                <Row label="เวอร์ชัน" value="2.0" />
                <Row label="สถาปัตยกรรม" value="Next.js + Express + PostgreSQL (Supabase)" />
                <Row label="การยืนยันตัวตน" value="MOPH ID (Health ID + Provider ID)" />
                <Row label="หน่วยงาน" value="โรงพยาบาลคลองหาด จ.สระแก้ว" />
                <Row label="ผู้พัฒนา" value="Kittipun Prangsri" />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
