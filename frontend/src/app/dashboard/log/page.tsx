"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ActivityLog } from "@/lib/types";
import { isStaff, useMe } from "@/components/AppContext";
import { Card, Empty, ErrorBox, Loading, PageHeader, btn, input } from "@/components/ui";

export default function LogPage() {
  const me = useMe();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await api<ActivityLog[]>("/activity-logs?limit=500"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    if (isStaff(me)) load();
  }, [load, me]);

  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs]);
  const filtered = logs.filter((l) =>
    (!action || l.action === action) &&
    (!search || [l.user_name, l.details].some((v) => v?.toLowerCase().includes(search.toLowerCase())))
  );

  if (!isStaff(me)) return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับเจ้าหน้าที่ รพ. เท่านั้น" /></div>;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="บันทึกกิจกรรม" subtitle="ประวัติการใช้งานระบบ 500 รายการล่าสุด" actions={
        <button onClick={load} className={btn.secondary}><RefreshCw size={16} /> รีเฟรช</button>
      } />
      <Card>
        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาผู้ใช้หรือรายละเอียด..." className={`${input} pl-9`} />
          </div>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={`${input} w-auto`}>
            <option value="">ทุกการกระทำ</option>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        {error ? <div className="p-4"><ErrorBox message={error} onRetry={load} /></div> : loading ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">วันเวลา</th>
                  <th className="px-4 py-3 text-left">ผู้ใช้</th>
                  <th className="px-4 py-3 text-left">การกระทำ</th>
                  <th className="px-4 py-3 text-left">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 text-teal-700">{l.user_name || "-"}</td>
                    <td className="px-4 py-3 font-medium">{l.action}</td>
                    <td className="px-4 py-3 text-slate-600">{l.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty text="ไม่พบประวัติกิจกรรม" />}
          </div>
        )}
      </Card>
    </div>
  );
}
