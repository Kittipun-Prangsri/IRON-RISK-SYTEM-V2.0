const { ValidationError, createRegistry } = require('./registry');
const { NUTRITION_OPTIONS, IRON_OPTIONS, FOOD_OPTIONS, SOCIAL_OPTIONS, scoreChild } = require('./scoring');
const pregnancyScoring = require('./pregnancyScoring');

const ADDRESS_TEXT = ['house_number', 'village_name', 'tambon', 'amphoe', 'province'];
const ADDRESS_NUMBERS = {
  village_no: { min: 1, max: 99, int: true },
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
};

const children = createRegistry({
  table: 'children',
  idPrefix: 'CHILD',
  text: ['name', 'age', ...ADDRESS_TEXT, 'caregiver_name', 'notes'],
  enums: {
    nutrition_status: NUTRITION_OPTIONS,
    iron_status: IRON_OPTIONS,
    food_behavior: FOOD_OPTIONS,
    social_status: SOCIAL_OPTIONS,
  },
  numbers: {
    ...ADDRESS_NUMBERS,
    hct: { min: 1, max: 80 },
    weight_kg: { min: 0.5, max: 100 },
    height_cm: { min: 20, max: 200 },
  },
  required: ['name'],
  score: scoreChild,
  scoreFields: ['hct_score', 'nutrition_score', 'iron_score', 'food_score', 'social_score', 'total_score', 'risk_level'],
});

const pregnancies = createRegistry({
  table: 'pregnancies',
  idPrefix: 'PREG',
  text: ['name', ...ADDRESS_TEXT, 'husband_name', 'phone', 'notes'],
  enums: {
    weight_gain: pregnancyScoring.WEIGHT_GAIN_OPTIONS,
    iron_status: pregnancyScoring.IRON_OPTIONS,
    food_behavior: pregnancyScoring.FOOD_OPTIONS,
    social_status: pregnancyScoring.SOCIAL_OPTIONS,
  },
  numbers: {
    ...ADDRESS_NUMBERS,
    age_years: { min: 10, max: 60, int: true },
    hct: { min: 1, max: 80 },
    pre_weight_kg: { min: 25, max: 200 },
    current_weight_kg: { min: 25, max: 200 },
    height_cm: { min: 100, max: 220 },
  },
  dates: { lmp_date: { past: true }, delivered_on: { past: true } },
  arrays: { risk_factors: pregnancyScoring.RISK_FACTOR_OPTIONS },
  required: ['name'],
  score: pregnancyScoring.scorePregnancy,
  scoreFields: ['hct_score', 'nutrition_score', 'iron_score', 'food_score', 'social_score', 'obstetric_score', 'total_score', 'risk_level'],
});

module.exports = { ValidationError, children, pregnancies };
