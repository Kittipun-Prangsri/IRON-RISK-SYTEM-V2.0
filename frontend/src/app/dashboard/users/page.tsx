"use client";
import { useCallback, useEffect, useState } from "react";
import { Edit, RefreshCw, Search, UserCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { KHLONG_HAT_VILLAGES, ROLE_LABEL, STATUS_LABEL, villageLabel } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AppUser, Role, UserStatus } from "@/lib/types";
import { useMe, useToast } from "@/components/AppContext";
import { Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, btn, input } from "@/components/ui";

const STATUS_STYLE: Record<UserStatus, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Suspended: "bg-red-50 text-red-700 border-red-200",
};

export default function UsersPage() {
  const me = useMe();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AppUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api<AppUser[]>("/users"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    if (me.role === "admin") load();
  }, [load, me.role]);

  if (me.role !== "admin") return <div className="p-6"><ErrorBox message="เมนูนี้สำหรับผู้ดูแลระบบเท่านั้น" /></div>;

  const q = search.toLowerCase();
  const filtered = users.filter((u) => !q || [u.name, u.position, u.hospital, u.phone].some((v) => v?.toLowerCase().includes(q)));
  const pending = users.filter((u) => u.status === "Pending").length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="จัดการผู้ใช้งาน"
        subtitle="ผู้ใช้เข้าสู่ระบบด้วย MOPH ID ครั้งแรกแล้วจะปรากฏที่นี่ในสถานะ “รออนุมัติ” — กำหนดบทบาทและอนุมัติก่อนจึงจะใช้งานได้"
        actions={<button onClick={load} className={btn.secondary}><RefreshCw size={16} /> รีเฟรชรายชื่อ</button>}
      />

      {pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm flex items-center gap-2">
          <UserCheck size={18} /> มีผู้ใช้รออนุมัติ {pending} คน
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ ตำแหน่ง หน่วยงาน หรือเบอร์โทร..." className={`${input} pl-9`} />
          </div>
          <span className="text-sm text-slate-500">{users.length} คน</span>
        </div>
        {error ? <div className="p-4"><ErrorBox message={error} onRetry={load} /></div> : loading ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 text-left">ตำแหน่ง / หน่วยงาน</th>
                  <th className="px-4 py-3 text-left">บทบาท</th>
                  <th className="px-4 py-3 text-left">หมู่บ้านรับผิดชอบ</th>
                  <th className="px-4 py-3 text-left">สถานะ</th>
                  <th className="px-4 py-3 text-left">เข้าใช้ล่าสุด</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-teal-600"> (คุณ)</span>}</p>
                      {u.phone && <p className="text-xs text-slate-500">{u.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{u.position || "-"}</p>
                      <p className="text-xs text-slate-400">{u.hospital || "-"}{u.hcode ? ` (${u.hcode})` : ""}</p>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3 text-slate-600">{u.role === "vhv" ? villageLabel(u.assigned_village_no) : "ทั้งหมด"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[u.status]}`}>{STATUS_LABEL[u.status]}</span></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(u)} className={btn.ghost}>
                        {u.status === "Pending" ? <><UserCheck size={14} /> อนุมัติ</> : <><Edit size={14} /> แก้ไข</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty text="ไม่พบผู้ใช้งาน" />}
          </div>
        )}
      </Card>

      {editing && <UserModal user={editing} isSelf={editing.id === me.id} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function UserModal({ user, isSelf, onClose, onSaved }: { user: AppUser; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    role: user.role as Role,
    status: (user.status === "Pending" ? "Active" : user.status) as UserStatus,
    assigned_village_no: user.assigned_village_no ? String(user.assigned_village_no) : "",
    phone: user.phone ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/users/${user.id}`, { method: "PUT", body: form });
      toast(`บันทึกข้อมูล ${user.name} แล้ว`);
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
      setSaving(false);
    }
  }

  return (
    <Modal title={user.status === "Pending" ? "อนุมัติผู้ใช้งาน" : "แก้ไขผู้ใช้งาน"} onClose={onClose} footer={<>
      <button onClick={onClose} className={btn.secondary}>ยกเลิก</button>
      <button onClick={save} disabled={saving} className={btn.primary}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
    </>}>
      <div className="space-y-4">
        <div className="bg-white border border-slate-100 rounded-lg p-3 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-slate-500">{user.position || "-"} · {user.hospital || "-"}</p>
          <p className="text-xs text-slate-400 mt-1">ข้อมูลจาก MOPH Provider ID</p>
        </div>
        {isSelf && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">ไม่สามารถเปลี่ยนบทบาทหรือระงับบัญชีของตนเองได้</p>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="บทบาท">
            <select disabled={isSelf} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={input}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <Field label="สถานะ">
            <select disabled={isSelf} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })} className={input}>
              {(Object.keys(STATUS_LABEL) as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
        </div>
        {form.role === "vhv" && (
          <Field label="หมู่บ้านที่ อสม. รับผิดชอบ" required>
            <select value={form.assigned_village_no} onChange={(e) => setForm({ ...form, assigned_village_no: e.target.value })} className={input}>
              <option value="">-- เลือกหมู่บ้าน --</option>
              {KHLONG_HAT_VILLAGES.map((v) => <option key={v.moo} value={v.moo}>หมู่ {v.moo} {v.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="เบอร์โทรศัพท์">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08x-xxx-xxxx" className={input} />
        </Field>
        <div className="text-xs text-slate-500 space-y-0.5">
          <p><b>ผู้ดูแลระบบ:</b> ใช้งานได้ทุกเมนู รวมถึงจัดการผู้ใช้</p>
          <p><b>เจ้าหน้าที่ รพ.:</b> เพิ่ม/แก้ไข/ประเมินข้อมูลเด็กได้ทุกหมู่บ้าน</p>
          <p><b>อสม.:</b> ดูข้อมูลและบันทึกการกินยาเฉพาะหมู่บ้านที่รับผิดชอบ</p>
        </div>
      </div>
    </Modal>
  );
}
