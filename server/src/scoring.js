// Iron-deficiency risk score — same rules as the original Apps Script saveChild():
// 5 dimensions, 0-2 points each, total 0-10; >=4 high risk, >=2 medium risk.

const NUTRITION_OPTIONS = ['สมส่วน', 'ค่อนข้างผอม', 'ผอม', 'เริ่มอ้วน', 'อ้วน'];
const IRON_OPTIONS = ['สม่ำเสมอ', 'ไม่สม่ำเสมอ', 'ได้รับยาแต่ไม่ได้กินยา', 'ไม่เคยได้รับ', 'ได้'];
const FOOD_OPTIONS = ['เป็นประจำ', 'บางครั้ง', 'ไม่ได้บริโภค'];
const SOCIAL_OPTIONS = ['เพียงพอ', 'ขัดสน', 'ไม่เพียงพอ'];
const IRON_NOT_TAKEN = ['ไม่เคยได้รับ', 'ไม่ได้', 'ได้รับยาแต่ไม่ได้กินยา', 'ได้แต่ไม่ได้กิน'];

function hctScore(hct) {
  const v = Number(hct);
  if (!(v > 0)) return 0;
  if (v < 30) return 2;
  if (v < 33) return 1;
  return 0;
}

function nutritionScore(nutrition) {
  if (nutrition === 'ผอม') return 2;
  if (nutrition === 'ค่อนข้างผอม') return 1;
  return 0;
}

function ironScore(iron) {
  if (IRON_NOT_TAKEN.includes(iron)) return 2;
  if (iron === 'ไม่สม่ำเสมอ') return 1;
  return 0;
}

function foodScore(food) {
  if (food === 'ไม่ได้บริโภค') return 2;
  if (food === 'บางครั้ง') return 1;
  return 0;
}

function socialScore(social) {
  if (social === 'ไม่เพียงพอ') return 2;
  if (social === 'ขัดสน') return 1;
  return 0;
}

function riskLevel(total) {
  if (total >= 4) return 'เสี่ยงสูง';
  if (total >= 2) return 'เสี่ยงปานกลาง';
  return 'เสี่ยงต่ำ';
}

function scoreChild(child) {
  const scores = {
    hct_score: hctScore(child.hct),
    nutrition_score: nutritionScore(child.nutrition_status),
    iron_score: ironScore(child.iron_status),
    food_score: foodScore(child.food_behavior),
    social_score: socialScore(child.social_status)
  };
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return { ...scores, total_score: total, risk_level: riskLevel(total) };
}

module.exports = {
  NUTRITION_OPTIONS,
  IRON_OPTIONS,
  FOOD_OPTIONS,
  SOCIAL_OPTIONS,
  scoreChild
};
