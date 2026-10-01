import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: childrenData, error } = await supabase
      .from('children')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Map DB columns to the keys expected by the UI
    const mappedChildren = (childrenData || []).map(c => ({
      ...c,
      status: c.risk_level,
      hct: c.hct_percentage,
      iron: c.iron_supplement_received,
      nutrition: c.nutrition_status
    }));
    
    return NextResponse.json({ children: mappedChildren });
  } catch (error: any) {
    console.error('Error fetching from Supabase:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch data' }, { status: 500 });
  }
}
