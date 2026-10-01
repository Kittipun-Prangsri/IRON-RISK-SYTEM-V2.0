DROP TABLE IF EXISTS children CASCADE;

CREATE TABLE children (
  row_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id TEXT,
  name TEXT,
  age TEXT,
  house_number TEXT,
  village_no TEXT,
  village_name TEXT,
  "ตำบล" TEXT,
  "อำเภอ" TEXT,
  "จังหวัด" TEXT,
  latitude TEXT,
  longitude TEXT,
  hct_percentage TEXT,
  weight_kg TEXT,
  height_cm TEXT,
  nutrition_status TEXT,
  iron_supplement_received TEXT,
  food_behavior TEXT,
  social_status TEXT,
  caregiver_name TEXT,
  hct_score TEXT,
  weight_score TEXT,
  iron_score TEXT,
  food_score TEXT,
  social_score TEXT,
  total_score TEXT,
  risk_level TEXT,
  last_medication_date TEXT,
  "หมายเหตุ" TEXT,
  is_active TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions on children" ON children FOR ALL USING (true);
