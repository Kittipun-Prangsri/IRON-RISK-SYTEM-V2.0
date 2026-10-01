module.exports = {
  apps: [
    {
      name: "iron-risk-backend",
      script: "npm",
      args: "start",
      cwd: "./server",
      env: {
        NODE_ENV: "production",
        PORT: 5005 // ให้ Backend รันที่ 5005 หลบให้ Frontend
      },
      watch: false
    },
    {
      name: "iron-risk-frontend",
      script: "npm",
      args: "start",
      cwd: "./frontend",
      env: {
        NODE_ENV: "production",
        PORT: 5176 // ให้ Frontend (Next.js) ออกเน็ตที่ 5176 รับ Cloudflare
      },
      watch: false
    }
  ]
};
