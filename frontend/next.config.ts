import type { NextConfig } from "next";

// Express backend (server/) — handles MOPH login and every /api call.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5005";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/:path*', // รับ Login จาก MOPH
        destination: `${BACKEND_URL}/auth/:path*` // โยนไปให้ Backend จัดการ
      },
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
