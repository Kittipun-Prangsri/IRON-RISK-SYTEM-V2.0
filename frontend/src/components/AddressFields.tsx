"use client";
import { MapPin } from "lucide-react";
import { KHLONG_HAT_VILLAGES, SAKAEO_DISTRICTS } from "@/lib/constants";
import { useToast } from "./AppContext";
import { Field, btn, input } from "./ui";

export type Address = {
  amphoe: string; tambon: string; village_no: string; village_name: string;
  house_number: string; latitude: string; longitude: string;
};

const isKhlongHat = (a: Pick<Address, "amphoe" | "tambon">) => a.amphoe === "คลองหาด" && a.tambon === "คลองหาด";

// Address inputs shared by the children and pregnancy forms: จ.สระแก้ว อำเภอ → ตำบล
// cascade; inside ต.คลองหาด the หมู่บ้าน is picked from the official list.
// Renders grid cells for a 3-column form grid.
export function AddressFields({ value, onChange }: { value: Address; onChange: (patch: Partial<Address>) => void }) {
  const toast = useToast();
  const district = SAKAEO_DISTRICTS.find((d) => d.name === value.amphoe);

  function fillMyLocation() {
    if (!navigator.geolocation) return toast("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง", "error");
    navigator.geolocation.getCurrentPosition(
      (p) => onChange({ latitude: p.coords.latitude.toFixed(7), longitude: p.coords.longitude.toFixed(7) }),
      () => toast("ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <Field label="อำเภอ (จ.สระแก้ว)">
        <select value={value.amphoe} onChange={(e) => {
          const d = SAKAEO_DISTRICTS.find((x) => x.name === e.target.value);
          onChange({ amphoe: e.target.value, tambon: d?.sub_districts[0]?.name ?? "", village_name: "", village_no: "" });
        }} className={input}>
          {SAKAEO_DISTRICTS.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="ตำบล">
        <select value={value.tambon} onChange={(e) => {
          const tambon = e.target.value;
          onChange(isKhlongHat({ amphoe: value.amphoe, tambon })
            ? { tambon, village_no: "1", village_name: "บ้านคลองหาด" }
            : { tambon, village_no: "", village_name: "" });
        }} className={input}>
          {district?.sub_districts.map((s) => <option key={s.name}>{s.name}</option>)}
        </select>
      </Field>
      {isKhlongHat(value) ? (
        <Field label="หมู่บ้าน">
          <select value={value.village_no} onChange={(e) => {
            const v = KHLONG_HAT_VILLAGES.find((x) => String(x.moo) === e.target.value);
            onChange({ village_no: e.target.value, village_name: v?.name ?? "" });
          }} className={input}>
            <option value="">-- เลือกหมู่บ้าน --</option>
            {KHLONG_HAT_VILLAGES.map((v) => <option key={v.moo} value={v.moo}>หมู่ {v.moo} {v.name}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="หมู่ที่"><input type="number" min={1} value={value.village_no} onChange={(e) => onChange({ village_no: e.target.value })} className={input} /></Field>
          <Field label="ชื่อหมู่บ้าน"><input value={value.village_name} onChange={(e) => onChange({ village_name: e.target.value })} className={input} /></Field>
        </>
      )}
      <Field label="บ้านเลขที่"><input value={value.house_number} onChange={(e) => onChange({ house_number: e.target.value })} placeholder="เช่น 12/3" className={input} /></Field>
      <Field label="Latitude"><input type="number" step="any" value={value.latitude} onChange={(e) => onChange({ latitude: e.target.value })} placeholder="เช่น 13.453589" className={input} /></Field>
      <Field label="Longitude"><input type="number" step="any" value={value.longitude} onChange={(e) => onChange({ longitude: e.target.value })} placeholder="เช่น 102.299076" className={input} /></Field>
      <div className="flex items-end">
        <button type="button" onClick={fillMyLocation} className={btn.secondary}><MapPin size={16} /> ใช้ตำแหน่งปัจจุบัน</button>
      </div>
    </>
  );
}
