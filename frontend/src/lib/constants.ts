import type { RiskLevel, Role, UserStatus } from "./types";
import sakaeo from "./sakaeo_address.json";

export const KHLONG_HAT_VILLAGES = [
  { name: "บ้านคลองหาด", moo: 1 },
  { name: "บ้านเขาผาผึ้ง", moo: 2 },
  { name: "บ้านป่าช้ากวาง", moo: 3 },
  { name: "บ้านเขาเลื่อม", moo: 4 },
  { name: "บ้านคลองหาด", moo: 5 },
  { name: "บ้านทับวังวน", moo: 6 },
  { name: "บ้านซับมะกรูด", moo: 7 },
  { name: "บ้านเขาดิน", moo: 8 },
  { name: "บ้านเขาเลื่อมใต้", moo: 9 },
  { name: "บ้านไทยพัฒนา", moo: 10 },
  { name: "บ้านป่าตะแบก", moo: 11 },
  { name: "บ้านเขาช่องแคบ", moo: 12 },
  { name: "บ้านคลองหาดพัฒนา", moo: 13 },
];

export const villageLabel = (moo: number | null | undefined, name?: string | null) =>
  moo ? `${name || KHLONG_HAT_VILLAGES.find((v) => v.moo === moo)?.name || "หมู่บ้าน"} (หมู่ ${moo})` : name || "-";

export const SAKAEO_DISTRICTS: { name: string; sub_districts: { name: string }[] }[] = sakaeo.districts;

export const AGE_OPTIONS = ["9 เดือน", "1 ปี", "2 ปี", "3 ปี", "4 ปี", "5 ปี"];
export const NUTRITION_OPTIONS = ["สมส่วน", "ค่อนข้างผอม", "ผอม", "เริ่มอ้วน", "อ้วน"];

export const IRON_OPTIONS = [
  { value: "สม่ำเสมอ", label: "ได้รับและกินสม่ำเสมอ", hint: "กินยาเหล็กอย่างสม่ำเสมอ", score: 0 },
  { value: "ไม่สม่ำเสมอ", label: "ได้รับแต่กินไม่สม่ำเสมอ", hint: "กินยาน้อยกว่า 5 วัน/สัปดาห์", score: 1 },
  { value: "ได้รับยาแต่ไม่ได้กินยา", label: "ไม่ได้กินยา / ไม่เคยได้รับ", hint: "ได้รับแต่ไม่ได้กิน หรือยังเข้าไม่ถึงยาเสริม", score: 2 },
];
export const FOOD_OPTIONS = [
  { value: "เป็นประจำ", label: "บริโภคเป็นประจำ", hint: "ตับ เลือด เนื้อสัตว์ มากกว่า 5 วัน/สัปดาห์", score: 0 },
  { value: "บางครั้ง", label: "บริโภคบางครั้ง", hint: "อาหารธาตุเหล็กสูง 1-2 วัน/สัปดาห์", score: 1 },
  { value: "ไม่ได้บริโภค", label: "แทบไม่ได้บริโภคเลย", hint: "น้อยกว่า 1 วัน/สัปดาห์", score: 2 },
];
export const SOCIAL_OPTIONS = [
  { value: "เพียงพอ", label: "ความเข้าใจดี / เพียงพอ", hint: "ผู้ปกครองเข้าใจดี และรายได้ครอบครัวเพียงพอ", score: 0 },
  { value: "ขัดสน", label: "ภาระงานมาก / ค่อนข้างขัดสน", hint: "มีภาระงานมาก หรือรายได้ค่อนข้างฝืดเคือง", score: 1 },
  { value: "ไม่เพียงพอ", label: "อยู่กับผู้สูงอายุ / ไม่เพียงพอ", hint: "อยู่กับปู่ย่าตายาย ขาดความเข้าใจ รายได้ไม่พอ", score: 2 },
];

// Legacy value "ได้" (received) came from the old Google Sheet import.
export const ironLabel = (v: string | null) =>
  v === "ได้" ? "ได้รับยา (ยังไม่ประเมินความสม่ำเสมอ)" : IRON_OPTIONS.find((o) => o.value === v)?.label ?? (v || "ยังไม่ประเมิน");
export const ironReceived = (v: string | null) => v === "สม่ำเสมอ" || v === "ไม่สม่ำเสมอ" || v === "ได้";

export const RISK_LEVELS: RiskLevel[] = ["เสี่ยงสูง", "เสี่ยงปานกลาง", "เสี่ยงต่ำ"];
export const RISK_STYLE: Record<RiskLevel, { badge: string; color: string; dot: string }> = {
  เสี่ยงสูง: { badge: "bg-red-50 text-red-700 border-red-200", color: "#dc2626", dot: "bg-red-500" },
  เสี่ยงปานกลาง: { badge: "bg-amber-50 text-amber-700 border-amber-200", color: "#d97706", dot: "bg-amber-500" },
  เสี่ยงต่ำ: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", color: "#059669", dot: "bg-emerald-500" },
};

export const RISK_RECOMMENDATION: Record<RiskLevel, { title: string; text: string }> = {
  เสี่ยงสูง: {
    title: "ส่งต่อ รพ. และเยี่ยมบ้านด่วน",
    text: "ควรส่งต่อพบแพทย์ทันที และจัดทีมสาธารณสุขลงพื้นที่เยี่ยมบ้าน ติดตามการได้รับยาเหล็กและโภชนาการอย่างเร่งด่วน",
  },
  เสี่ยงปานกลาง: {
    title: "ติดตามใกล้ชิด",
    text: "ให้ยาเหล็กเสริมสม่ำเสมอและปรับพฤติกรรมการกินอาหาร นัดตรวจ Hct ซ้ำใน 1-2 เดือน",
  },
  เสี่ยงต่ำ: {
    title: "เฝ้าระวังปกติ",
    text: "ให้ยาเหล็กเสริมและอาหารครบ 5 หมู่ตามแนวทางมาตรฐาน ประเมินตามรอบปกติ",
  },
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่ รพ.",
  vhv: "อสม.",
};
export const STATUS_LABEL: Record<UserStatus, string> = {
  Pending: "รออนุมัติ",
  Active: "ใช้งานได้",
  Suspended: "ระงับการใช้งาน",
};

// Same rules as server/src/scoring.js — used for the live preview only; the server
// always recomputes and stores the authoritative score.
export function computeScore(c: {
  hct?: number | string | null; nutrition_status?: string | null; iron_status?: string | null;
  food_behavior?: string | null; social_status?: string | null;
}) {
  const hct = Number(c.hct);
  const hctScore = !(hct > 0) ? 0 : hct < 30 ? 2 : hct < 33 ? 1 : 0;
  const nutritionScore = c.nutrition_status === "ผอม" ? 2 : c.nutrition_status === "ค่อนข้างผอม" ? 1 : 0;
  const ironScore = ["ไม่เคยได้รับ", "ไม่ได้", "ได้รับยาแต่ไม่ได้กินยา", "ได้แต่ไม่ได้กิน"].includes(c.iron_status ?? "") ? 2
    : c.iron_status === "ไม่สม่ำเสมอ" ? 1 : 0;
  const foodScore = c.food_behavior === "ไม่ได้บริโภค" ? 2 : c.food_behavior === "บางครั้ง" ? 1 : 0;
  const socialScore = c.social_status === "ไม่เพียงพอ" ? 2 : c.social_status === "ขัดสน" ? 1 : 0;
  const total = hctScore + nutritionScore + ironScore + foodScore + socialScore;
  const risk: RiskLevel = total >= 4 ? "เสี่ยงสูง" : total >= 2 ? "เสี่ยงปานกลาง" : "เสี่ยงต่ำ";
  return { hctScore, nutritionScore, ironScore, foodScore, socialScore, total, risk };
}
