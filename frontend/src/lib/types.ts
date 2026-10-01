export type Role = "admin" | "staff" | "vhv";
export type UserStatus = "Pending" | "Active" | "Suspended";
export type RiskLevel = "เสี่ยงสูง" | "เสี่ยงปานกลาง" | "เสี่ยงต่ำ";

export interface Me {
  id: number;
  name: string;
  position: string | null;
  hospital: string | null;
  hcode: string | null;
  role: Role;
  assigned_village_no: number | null;
  phone: string | null;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
}

export type AppUser = Me;

export interface Child {
  id: string;
  name: string;
  age: string | null;
  house_number: string | null;
  village_no: number | null;
  village_name: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  hct: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  nutrition_status: string | null;
  iron_status: string | null;
  food_behavior: string | null;
  social_status: string | null;
  caregiver_name: string | null;
  hct_score: number;
  nutrition_score: number;
  iron_score: number;
  food_score: number;
  social_score: number;
  total_score: number;
  risk_level: RiskLevel;
  last_medication_at: string | null;
  notes: string | null;
  doses_30d: number;
  created_at: string;
  updated_at: string;
}

export interface MedicineLog {
  id: number;
  child_id: string;
  taken_on: string;
  taken_time: string | null;
  status: "กินยาแล้ว" | "ไม่ได้กิน";
  notes: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

export interface ChildDetail extends Child {
  medicine_logs: MedicineLog[];
}

export interface ActivityLog {
  id: number;
  user_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface Pregnancy {
  id: string;
  name: string;
  age_years: number | null;
  house_number: string | null;
  village_no: number | null;
  village_name: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  husband_name: string | null;
  phone: string | null;
  lmp_date: string | null;
  delivered_on: string | null;
  hct: number | null;
  pre_weight_kg: number | null;
  current_weight_kg: number | null;
  height_cm: number | null;
  weight_gain: string | null;
  iron_status: string | null;
  food_behavior: string | null;
  social_status: string | null;
  risk_factors: string[];
  hct_score: number;
  nutrition_score: number;
  iron_score: number;
  food_score: number;
  social_score: number;
  obstetric_score: number;
  total_score: number;
  risk_level: RiskLevel;
  last_medication_at: string | null;
  notes: string | null;
  doses_30d: number;
  created_at: string;
  updated_at: string;
}

export interface PregnancyDetail extends Pregnancy {
  medicine_logs: MedicineLog[];
}
