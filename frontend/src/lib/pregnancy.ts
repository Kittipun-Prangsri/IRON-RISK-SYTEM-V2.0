import type { RiskLevel } from "./types";

// Mirrors server/src/pregnancyScoring.js — used for live previews only; the server
// recomputes and stores the authoritative score.

export const PREG_MAX_SCORE = 12;

export const PREG_IRON_OPTIONS = [
  { value: "ทุกวัน", label: "กิน Triferdine ทุกวัน", hint: "ได้รับยาและกินทุกวันตามแพทย์สั่ง", score: 0 },
  { value: "ไม่สม่ำเสมอ", label: "กินไม่สม่ำเสมอ", hint: "กินน้อยกว่า 5 วัน/สัปดาห์", score: 1 },
  { value: "ไม่ได้กิน", label: "ไม่ได้กิน / ไม่ได้รับยา", hint: "ได้รับแต่ไม่กิน หรือยังไม่ได้รับยา", score: 2 },
];
export const PREG_FOOD_OPTIONS = [
  { value: "เป็นประจำ", label: "บริโภคเป็นประจำ", hint: "ตับ เลือด เนื้อสัตว์ ผักใบเขียว มากกว่า 5 วัน/สัปดาห์", score: 0 },
  { value: "บางครั้ง", label: "บริโภคบางครั้ง", hint: "1-2 วัน/สัปดาห์", score: 1 },
  { value: "ไม่ได้บริโภค", label: "แทบไม่ได้บริโภคเลย", hint: "น้อยกว่า 1 วัน/สัปดาห์", score: 2 },
];
export const PREG_SOCIAL_OPTIONS = [
  { value: "เพียงพอ", label: "รายได้และการดูแลเพียงพอ", hint: "ครอบครัวสนับสนุน รายได้พอ", score: 0 },
  { value: "ขัดสน", label: "ค่อนข้างขัดสน / ภาระงานมาก", hint: "รายได้ฝืดเคือง หรือทำงานหนัก", score: 1 },
  { value: "ไม่เพียงพอ", label: "ไม่เพียงพอ / ขาดผู้ดูแล", hint: "รายได้ไม่พอ อยู่ลำพัง หรือขาดความเข้าใจ", score: 2 },
];
export const WEIGHT_GAIN_OPTIONS = ["ตามเกณฑ์", "น้อยกว่าเกณฑ์", "มากกว่าเกณฑ์"];
export const RISK_FACTOR_OPTIONS = [
  "พาหะหรือเป็นโรคธาลัสซีเมีย",
  "ตั้งครรภ์ห่างจากครั้งก่อนน้อยกว่า 2 ปี",
  "ครรภ์แฝด",
  "เคยตกเลือดหรือมีเลือดออกผิดปกติ",
];
export const TEEN_FACTOR = "อายุน้อยกว่า 20 ปี";

export const pregIronLabel = (v: string | null) => PREG_IRON_OPTIONS.find((o) => o.value === v)?.label ?? "ยังไม่ประเมิน";

export function bmi(weightKg: number | string | null | undefined, heightCm: number | string | null | undefined): number | null {
  const w = Number(weightKg), h = Number(heightCm);
  return w > 0 && h > 0 ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null;
}

export function obstetricFactors(p: { age_years?: number | string | null; risk_factors?: string[] | null }): string[] {
  const age = Number(p.age_years);
  const chosen = (p.risk_factors ?? []).filter((f) => RISK_FACTOR_OPTIONS.includes(f));
  return age > 0 && age < 20 ? [TEEN_FACTOR, ...chosen] : chosen;
}

export function computePregnancyScore(p: {
  hct?: number | string | null; pre_weight_kg?: number | string | null; height_cm?: number | string | null;
  weight_gain?: string | null; iron_status?: string | null; food_behavior?: string | null;
  social_status?: string | null; age_years?: number | string | null; risk_factors?: string[] | null;
}) {
  const hct = Number(p.hct);
  const b = bmi(p.pre_weight_kg, p.height_cm);
  const hctScore = !(hct > 0) ? 0 : hct < 30 ? 2 : hct < 33 ? 1 : 0;
  const nutritionScore = b !== null && b < 18.5 ? 2 : p.weight_gain === "น้อยกว่าเกณฑ์" ? 1 : 0;
  const ironScore = p.iron_status === "ไม่ได้กิน" ? 2 : p.iron_status === "ไม่สม่ำเสมอ" ? 1 : 0;
  const foodScore = p.food_behavior === "ไม่ได้บริโภค" ? 2 : p.food_behavior === "บางครั้ง" ? 1 : 0;
  const socialScore = p.social_status === "ไม่เพียงพอ" ? 2 : p.social_status === "ขัดสน" ? 1 : 0;
  const obstetricScore = Math.min(obstetricFactors(p).length, 2);
  const total = hctScore + nutritionScore + ironScore + foodScore + socialScore + obstetricScore;
  const risk: RiskLevel = total >= 5 || (hct > 0 && hct < 30) ? "เสี่ยงสูง" : total >= 3 ? "เสี่ยงปานกลาง" : "เสี่ยงต่ำ";
  return { hctScore, nutritionScore, ironScore, foodScore, socialScore, obstetricScore, total, risk, bmi: b };
}

export const PREG_RECOMMENDATION: Record<RiskLevel, { title: string; text: string }> = {
  เสี่ยงสูง: {
    title: "พบแพทย์และติดตามใกล้ชิด",
    text: "ส่งพบแพทย์/พยาบาลฝากครรภ์โดยเร็ว ประเมินภาวะโลหิตจางและธาลัสซีเมีย ติดตามการกิน Triferdine ทุกสัปดาห์ และเยี่ยมบ้านโดย อสม.",
  },
  เสี่ยงปานกลาง: {
    title: "ติดตามและให้คำแนะนำ",
    text: "เน้นกิน Triferdine ทุกวันและอาหารธาตุเหล็กสูง ตรวจ Hct ซ้ำในการฝากครรภ์ครั้งถัดไป",
  },
  เสี่ยงต่ำ: {
    title: "ดูแลตามมาตรฐานการฝากครรภ์",
    text: "กิน Triferdine ทุกวันตลอดการตั้งครรภ์ และฝากครรภ์ตามนัด",
  },
};

const DAY = 24 * 3600 * 1000;

// Gestational age from the first day of the last menstrual period (Naegele: EDC = LMP + 280 days).
export function gestation(lmp: string | null, deliveredOn?: string | null) {
  if (!lmp) return null;
  const start = new Date(`${lmp}T00:00:00+07:00`).getTime();
  if (Number.isNaN(start)) return null;
  const end = deliveredOn ? new Date(`${deliveredOn}T00:00:00+07:00`).getTime() : Date.now();
  const days = Math.max(0, Math.floor((end - start) / DAY));
  const weeks = Math.floor(days / 7);
  const edc = new Date(start + 280 * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const trimester = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  return { weeks, days: days % 7, edc, trimester, label: `${weeks} สัปดาห์ ${days % 7} วัน` };
}
