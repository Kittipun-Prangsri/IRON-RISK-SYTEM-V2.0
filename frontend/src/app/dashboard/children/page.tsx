"use client";
import { useEffect, useState, Suspense } from "react";
import { RefreshCw, Search, Plus, Download } from "lucide-react";

function ChildrenContent() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/data");
        const result = await response.json();
        if (result && result.children) {
          setData(result.children);
        }
      } catch (error) {
        console.error("Failed to fetch:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = data.filter((row: any) => 
    Object.values(row).some((val: any) => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="font-kanit text-2xl font-bold text-slate-800">ข้อมูลเด็ก / ทะเบียนเด็ก</h2>
          <p className="text-sm text-slate-500 mt-1">รายชื่อและข้อมูลสุขภาพของเด็กทั้งหมดในพื้นที่</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
            <Download size={16} /> ส่งออกข้อมูล
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
            <Plus size={16} /> เพิ่มข้อมูลเด็ก
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="ค้นหารายชื่อ, CID, หมู่บ้าน..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-80 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            />
          </div>
          <div className="text-sm text-slate-500">
            พบข้อมูลทั้งหมด <span className="font-bold text-teal-600">{filteredData.length}</span> รายการ
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCw className="animate-spin text-teal-500" size={32} />
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="px-6 py-4 font-semibold">อายุ</th>
                  <th className="px-6 py-4 font-semibold">หมู่บ้าน</th>
                  <th className="px-6 py-4 font-semibold">ความเสี่ยง</th>
                  <th className="px-6 py-4 font-semibold">Hct</th>
                  <th className="px-6 py-4 font-semibold">โภชนาการ</th>
                  <th className="px-6 py-4 font-semibold">ยาเหล็ก</th>
                  <th className="px-6 py-4 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, index) => {
                  const riskLevel = row.status || 'ไม่ระบุ';
                  const riskColor = riskLevel.includes('สูง') ? 'bg-red-50 text-red-600 border-red-200' :
                                    riskLevel.includes('ปานกลาง') ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                    'bg-green-50 text-green-600 border-green-200';
                  
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{row.name || row.fullname || 'ไม่ระบุชื่อ'}</div>
                        <div className="text-xs text-slate-500">CID: {row.cid || row.id_card || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{row.age || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{row.village || row.address || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${riskColor}`}>
                          {riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{row.hct || '-'}%</td>
                      <td className="px-6 py-4 text-slate-600">{row.nutrition || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{row.iron || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-teal-600 hover:text-teal-800 font-medium text-xs px-3 py-1.5 hover:bg-teal-50 rounded-lg transition-colors">
                          ดูประวัติ
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      ไม่พบข้อมูลที่ค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChildrenPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">กำลังโหลดข้อมูล...</div>}>
      <ChildrenContent />
    </Suspense>
  );
}
