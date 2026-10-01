import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/auth/:path*', // รับ Login จาก MOPH
        destination: 'http://localhost:5005/auth/:path*' // โยนไปให้ Backend จัดการ
      }
    ];
  }
};

export default nextConfig;
