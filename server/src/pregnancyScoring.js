// Iron-deficiency risk score for pregnant women: 6 dimensions, 0-2 points each,
// total 0-12; >=5 high, 3-4 medium, 0-2 low. Hct < 30% is always high risk.

const WEIGHT_GAIN_OPTIONS = ['ตามเกณฑ์', 'น้อยกว่าเกณฑ์', 'มากกว่าเกณฑ์'];
const IRON_OPTIONS = ['ทุกวัน', 'ไม่สม่ำเสมอ', 'ไม่ได้กิน'];
const FOOD_OPTIONS = ['เป็นประจำ', 'บางครั้ง', 'ไม่ได้บริโภค'];
const SOCIAL_OPTIONS = ['เพียงพอ', 'ขัดสน', 'ไม่เพียงพอ'];
// "อายุน้อยกว่า 20 ปี" is derived from age_years, not chosen.
const RISK_FACTOR_OPTIONS = [
  'พาหะหรือเป็นโรคธาลัสซีเมีย',
  'ตั้งครรภ์ห่างจากครั้งก่อนน้อยกว่า 2 ปี',
  'ครรภ์แฝด',
  'เคยตกเลือดหรือมีเลือดออกผิดปกติ',
];
const TEEN_FACTOR = 'อายุน้อยกว่า 20 ปี';

function bmi(weightKg, heightCm) {
  const w = Number(weightKg), h = Number(heightCm);
  return w > 0 && h > 0 ? w / (h / 100) ** 2 : null;
}

function obstetricFactors(p) {
  const factors = (p.risk_factors || []).filter((f) => RISK_FACTOR_OPTIONS.includes(f));
  return Number(p.age_years) > 0 && Number(p.age_years) < 20 ? [TEEN_FACTOR, ...factors] : factors;
}

function scorePregnancy(p) {
  const hct = Number(p.hct);
  const b = bmi(p.pre_weight_kg, p.height_cm);
  const factorCount = obstetricFactors(p).length;
  const scores = {
    hct_score: !(hct > 0) ? 0 : hct < 30 ? 2 : hct < 33 ? 1 : 0,
    nutrition_score: b !== null && b < 18.5 ? 2 : p.weight_gain === 'น้อยกว่าเกณฑ์' ? 1 : 0,
    iron_score: p.iron_status === 'ไม่ได้กิน' ? 2 : p.iron_status === 'ไม่สม่ำเสมอ' ? 1 : 0,
    food_score: p.food_behavior === 'ไม่ได้บริโภค' ? 2 : p.food_behavior === 'บางครั้ง' ? 1 : 0,
    social_score: p.social_status === 'ไม่เพียงพอ' ? 2 : p.social_status === 'ขัดสน' ? 1 : 0,
    obstetric_score: Math.min(factorCount, 2),
  };
  const total = Object.values(scores).reduce((a, v) => a + v, 0);
  const risk = total >= 5 || (hct > 0 && hct < 30) ? 'เสี่ยงสูง' : total >= 3 ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ';
  return { ...scores, total_score: total, risk_level: risk };
}

module.exports = {
  WEIGHT_GAIN_OPTIONS, IRON_OPTIONS, FOOD_OPTIONS, SOCIAL_OPTIONS, RISK_FACTOR_OPTIONS, scorePregnancy
};
