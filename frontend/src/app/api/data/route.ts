import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbwB5wqUpAxkOgrzyYE8D4eXNidVxE3lI2cyobUO5EeSV3IKyr2NQZqdGrLQrsbqbK0YDw/exec?action=get_data";
    
    // Server-side fetch (ข้ามปัญหา CORS ของเบราว์เซอร์)
    const response = await fetch(GAS_URL, {
      redirect: 'follow', // ต้องตาม redirect เพราะ Google Apps Script จะเด้งไปที่ googleusercontent
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Google Apps Script responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching from GAS:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch data' }, { status: 500 });
  }
}
