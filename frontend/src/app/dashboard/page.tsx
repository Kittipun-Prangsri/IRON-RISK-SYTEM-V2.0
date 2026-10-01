"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function Dashboard() {
  const searchParams = useSearchParams();
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setIsSuccess(true);
    }
  }, [searchParams]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sarabun text-slate-800 dark:text-slate-100">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500/10 text-teal-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
          </div>
          <div>
            <h2 className="font-kanit font-bold text-teal-500 tracking-wide leading-tight">IRON ZERO</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Risk System</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold tracking-[1.2px] text-slate-400 uppercase px-4 py-2">เมนูหลัก</p>
          <a href="#" className="flex items-center gap-3 px-4 py-2.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-l-4 border-teal-500 rounded-r-lg font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            ภาพรวมระบบ
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8">
          <h1 className="font-kanit font-semibold text-lg">ภาพรวมระบบ (Dashboard)</h1>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-kanit font-bold shadow-md cursor-pointer">
              U
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {isSuccess && (
            <div className="mb-6 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in-up">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              <p className="font-medium">เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับเข้าสู่ IRON ZERO RISK</p>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 animate-fade-in-up" style={{animationDelay: '0.1s', animationFillMode: 'both'}}>
            {[
              { label: 'จำนวนเด็กทั้งหมด', value: '1,248', color: 'from-blue-400 to-blue-600' },
              { label: 'ความเสี่ยงสูง', value: '42', color: 'from-red-400 to-red-600' },
              { label: 'รอการติดตาม', value: '156', color: 'from-amber-400 to-amber-600' },
              { label: 'ติดตามสำเร็จ', value: '89', color: 'from-teal-400 to-teal-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${stat.color}`}></div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{stat.label}</p>
                <h3 className="text-3xl font-kanit font-bold text-slate-800 dark:text-white">{stat.value}</h3>
              </div>
            ))}
          </div>

          {/* Empty State / Welcome Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm animate-fade-in-up" style={{animationDelay: '0.2s', animationFillMode: 'both'}}>
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h3 className="font-kanit text-xl font-semibold mb-2">ยังไม่มีข้อมูลที่จะแสดงผล</h3>
            <p className="text-slate-500 max-w-md">ขณะนี้เรากำลังพัฒนาการเชื่อมต่อ API เพื่อดึงข้อมูลมาแสดงผลในรูปแบบตารางและกราฟ โปรดรอการอัปเดตในเร็วๆ นี้</p>
          </div>
        </div>
      </main>
    </div>
  );
}
