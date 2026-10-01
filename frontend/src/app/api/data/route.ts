import { NextResponse } from 'next/server';

function parseCSV(csvString: string) {
  const lines = csvString.split('\n');
  if (lines.length < 2) return [];
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    let values = line.split(regex).map(val => val.replace(/^"|"$/g, '').trim());
    
    results.push({
      cid: values[0] || '',
      name: values[1] || '',
      age: values[2] || '',
      status: values[3] || '', 
      address: values[4] || '', 
      village: values[6] || '', 
      hct: values[9] || '',
      nutrition: values[12] || '', 
      iron: values[13] || '',
    });
  }
  return results;
}

export async function GET() {
  try {
    const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1lpQ502MZlt8sUyOlgirGozD05Gs1N8B6QEJdVxHNoDs/gviz/tq?tqx=out:csv&sheet=Data";
    
    const response = await fetch(SHEET_CSV_URL, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Google Sheets responded with ${response.status}`);
    }

    const csvText = await response.text();
    const childrenData = parseCSV(csvText);
    
    return NextResponse.json({ children: childrenData });
  } catch (error: any) {
    console.error('Error fetching from Google Sheets:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch data' }, { status: 500 });
  }
}
