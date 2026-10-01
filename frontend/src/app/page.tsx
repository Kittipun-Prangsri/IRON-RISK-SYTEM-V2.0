import Image from "next/image";

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-[radial-gradient(circle_at_10%_20%,_rgba(13,27,42,0.95)_0%,_rgba(10,22,40,0.98)_90%)] bg-slate-950 p-6 overflow-y-auto">
      {/* Login Card */}
      <div className="w-full max-w-[480px] bg-slate-900/75 backdrop-blur-[20px] border border-white/10 rounded-[20px] p-10 shadow-[0_16px_40px_rgba(0,0,0,0.4),_0_0_40px_rgba(0,201,167,0.05)] flex flex-col gap-6 animate-fade-in-up">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-2">
          {/* โลโก้หยดเลือด — ใช้รูปเดียวกับ favicon (src/app/icon.svg) */}
          <div className="w-[120px] h-[120px] mb-4 flex items-center justify-center bg-white/5 rounded-full border border-teal-500/20 shadow-[0_0_24px_rgba(0,201,167,0.15)]">
            <svg className="w-16 h-16" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="login-drop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2dd4bf" />
                  <stop offset="1" stopColor="#0f766e" />
                </linearGradient>
              </defs>
              <path d="M16 2.5C16 2.5 5.5 14.2 5.5 20.5a10.5 10.5 0 0 0 21 0C26.5 14.2 16 2.5 16 2.5Z" fill="url(#login-drop)" />
              <path d="M10.5 20.5a5.5 5.5 0 0 0 4 5.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".75" />
            </svg>
          </div>
          <h1 className="font-bold text-2xl text-teal-400 tracking-wide">
            IRON ZERO RISK
          </h1>
          <p className="text-sm text-slate-400">ระบบติดตามสุขภาพเด็ก</p>
        </div>

        {/* Tabs (optional based on your design) */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5">
          <button className="flex-1 py-2.5 text-sm font-semibold text-teal-400 bg-slate-900 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all">
            เข้าสู่ระบบ
          </button>
          <button className="flex-1 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-300 rounded-lg transition-all">
            ผู้ดูแลระบบ
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 mt-2">
          
          {/* MOPH Button */}
          <a 
            // Update this href to match your MOPH authorization URL
            href="https://moph.id.th/oauth/redirect?client_id=01939ac3-9394-7b9b-b3a4-0d53f13d3f32&response_type=code&redirect_uri=https://ironrisk.khostime.site/auth/healthid/callback"
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-br from-teal-600 to-teal-800 hover:from-teal-500 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-[0_4px_12px_rgba(0,143,122,0.3)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
            เข้าสู่ระบบด้วย Health ID
          </a>

          {/* LINE Button */}
          <button className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold rounded-xl transition-all shadow-[0_4px_16px_rgba(6,199,85,0.3)]">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.5 10.038c0-4.394-4.71-7.971-10.5-7.971C6.21 2.067 1.5 5.644 1.5 10.038c0 3.963 3.791 7.294 8.784 7.876.342.073.808.225.927.514.108.261.033.67.016.84-.025.26-.118.705-.145.864-.047.28-.216 1.05.945.56 1.161-.49 6.26-3.687 8.57-6.282 1.34-1.503 1.903-3.036 1.903-4.372zm-12.75 2.12h-2.58a.428.428 0 01-.43-.427v-3.79c0-.236.191-.427.43-.427.237 0 .428.191.428.427v3.363h2.152c.237 0 .429.192.429.428a.429.429 0 01-.429.426zm3.504-.426a.428.428 0 01-.428.427h-.002a.428.428 0 01-.428-.427v-3.79c0-.236.192-.427.428-.427.238 0 .43.191.43.427v3.79zm3.502 0a.428.428 0 01-.428.427h-2.15a.428.428 0 01-.43-.427v-3.79c0-.236.193-.427.43-.427h2.15c.237 0 .428.191.428.427a.428.428 0 01-.428.428h-1.722v.835h1.722c.237 0 .428.191.428.428a.428.428 0 01-.428.428h-1.722v.844h1.722c.237 0 .428.192.428.428z" />
            </svg>
            เข้าสู่ระบบด้วย LINE
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center text-slate-500 text-xs my-1">
          <div className="flex-1 border-b border-white/10"></div>
          <span className="px-3">หรือ</span>
          <div className="flex-1 border-b border-white/10"></div>
        </div>

        <button className="w-full flex items-center justify-center gap-3 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-medium rounded-xl transition-all">
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google SSO
        </button>
      </div>

    </div>
  );
}
