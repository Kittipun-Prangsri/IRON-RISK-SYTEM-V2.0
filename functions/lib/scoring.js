// Risk scoring — ported 1:1 from src/Code.gs saveChild()/saveChildrenBatch()
// (5-dimension score, 0-2 each, 0-10 total; >=4 high risk, >=2 medium risk).

const IRON_NOT_TAKEN = ["ไม่เคยได้รับ", "ไม่ได้", "ได้รับยาแต่ไม่ได้กินยา", "ได้แต่ไม่ได้กิน"];

function computeHctScore(hct) {
  const v = Number(hct);
  if (!(v > 0)) return 0;
  if (v < 30) return 2;
  if (v < 33) return 1;
  return 0;
}

function computeNutritionScore(nutrition) {
  if (nutrition === "ผอม") return 2;
  if (nutrition === "ค่อนข้างผอม") return 1;
  return 0;
}

function computeIronScore(iron) {
  if (IRON_NOT_TAKEN.indexOf(iron) !== -1) return 2;
  if (iron === "ไม่สม่ำเสมอ") return 1;
  return 0;
}

function computeFoodScore(food) {
  if (food === "ไม่ได้บริโภค") return 2;
  if (food === "บางครั้ง") return 1;
  return 0;
}

function computeSocialScore(social) {
  if (social === "ไม่เพียงพอ") return 2;
  if (social === "ขัดสน") return 1;
  return 0;
}

function computeRiskStatus(totalScore) {
  if (totalScore >= 4) return "เสี่ยงสูง";
  if (totalScore >= 2) return "เสี่ยงปานกลาง";
  return "เสี่ยงต่ำ";
}

function scoreChild(child) {
  const scores = {
    hct: computeHctScore(child.hct),
    nutrition: computeNutritionScore(child.nutrition),
    iron: computeIronScore(child.iron),
    food: computeFoodScore(child.food),
    social: computeSocialScore(child.social)
  };
  const totalScore = scores.hct + scores.nutrition + scores.iron + scores.food + scores.social;
  const status = computeRiskStatus(totalScore);
  return { scores, totalScore, status };
}

module.exports = {
  computeHctScore,
  computeNutritionScore,
  computeIronScore,
  computeFoodScore,
  computeSocialScore,
  computeRiskStatus,
  scoreChild
};
