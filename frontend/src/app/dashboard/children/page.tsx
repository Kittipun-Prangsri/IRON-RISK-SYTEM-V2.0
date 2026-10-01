"use client";
import { useEffect, useState, Suspense } from "react";
import { RefreshCw, Search, Plus, Download, X, Pill, Edit, Trash2 } from "lucide-react";

function ChildrenContent() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLogMedModal, setShowLogMedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
                        <button 
                          onClick={() => { setSelectedChild(row); setShowDetailModal(true); }}
                          className="text-teal-600 hover:text-teal-800 font-medium text-xs px-3 py-1.5 hover:bg-teal-50 rounded-lg transition-colors"
                        >
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

      {/* MODAL: Child Detail */}
      {showDetailModal && selectedChild && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-kanit font-semibold text-xl text-slate-800">ข้อมูลเด็กรายบุคคล</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">ชื่อ-นามสกุล</p>
                  <p className="font-medium text-slate-800 text-base">{selectedChild.name || selectedChild.fullname || '-'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">อายุ</p>
                  <p className="font-medium text-slate-800 text-base">{selectedChild.age || '-'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">หมู่บ้าน</p>
                  <p className="font-medium text-slate-800 text-base">{selectedChild.village || selectedChild.address || '-'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">ความเสี่ยง</p>
                  <p className="font-medium text-slate-800 text-base">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${selectedChild.status?.includes('สูง') ? 'bg-red-50 text-red-600 border-red-200' : selectedChild.status?.includes('ปานกลาง') ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                      {selectedChild.status || '-'}
                    </span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">Hct (%)</p>
                  <p className="font-medium text-slate-800 text-base">{selectedChild.hct || '-'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 mb-1 text-xs font-semibold uppercase tracking-wider">สถานะยาธาตุเหล็ก</p>
                  <p className="font-medium text-slate-800 text-base">{selectedChild.iron || '-'}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-slate-100 flex flex-wrap gap-3 bg-white justify-end">
              <button onClick={() => setShowLogMedModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
                <Pill size={16} /> บันทึกกินยา
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm">
                <Edit size={16} /> แก้ไข
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-sm font-medium transition-colors shadow-sm border border-red-100">
                <Trash2 size={16} /> ลบ
              </button>
              <button onClick={() => setShowDetailModal(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Log Medicine */}
      {showLogMedModal && selectedChild && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-kanit font-semibold text-lg text-teal-600 flex items-center gap-2">
                <Pill size={20} /> บันทึกการกินยาธาตุเหล็ก
              </h3>
              <button onClick={() => setShowLogMedModal(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 text-sm bg-slate-50/30">
              <div>
                <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">ชื่อเด็ก</label>
                <input type="text" readOnly value={selectedChild.name || selectedChild.fullname || ''} className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 outline-none cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">วันที่กินยา</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">เวลากินยา</label>
                  <input type="time" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm" />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">สถานะการกินยา</label>
                <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm">
                  <option value="taken">กินยาแล้ว (Taken)</option>
                  <option value="not_taken">ไม่ได้กิน (Not taken)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">รหัส อสม.</label>
                <input type="text" defaultValue="AOR001" placeholder="เช่น AOR001" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1.5 font-medium text-xs uppercase tracking-wider">หมายเหตุเพิ่มเติม</label>
                <input type="text" placeholder="เช่น อาการข้างเคียง หรือขนาดยา" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm" />
              </div>
            </div>
            <div className="px-6 py-5 border-t border-slate-100 flex gap-3 bg-white justify-end">
              <button onClick={() => setShowLogMedModal(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors">
                ยกเลิก
              </button>
              <button onClick={() => setShowLogMedModal(false)} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium transition-colors shadow-sm">
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete */}
      {showDeleteModal && selectedChild && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-kanit font-semibold text-lg text-slate-800">ยืนยันการลบข้อมูล</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 bg-slate-50/30 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                คุณต้องการลบข้อมูลเด็กคนนี้ใช่หรือไม่?<br/>การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <p className="font-semibold text-red-600 text-base">
                {selectedChild.name || selectedChild.fullname || '-'}
              </p>
            </div>
            <div className="px-6 py-5 border-t border-slate-100 flex gap-3 bg-white justify-center">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors">
                ยกเลิก
              </button>
              <button onClick={() => {
                setShowDeleteModal(false);
                setShowDetailModal(false);
                // Call delete API here
              }} className="flex-1 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors shadow-sm">
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}
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
