import Image from "next/image";

const MOPH_LOGIN_URL =
  "https://moph.id.th/oauth/redirect?client_id=01939ac3-9394-7b9b-b3a4-0d53f13d3f32&response_type=code&redirect_uri=https://ironrisk.khostime.site/auth/healthid/callback";

const ERRORS: Record<string, { tone: "amber" | "red"; text: string }> = {
  pending: { tone: "amber", text: "ส่งคำขอเข้าใช้งานแล้ว กรุณารอผู้ดูแลระบบอนุมัติ แล้วเข้าสู่ระบบอีกครั้ง" },
  suspended: { tone: "red", text: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" },
  login_failed: { tone: "red", text: "เข้าสู่ระบบด้วย MOPH ID ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
  session: { tone: "amber", text: "หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่" },
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-[radial-gradient(circle_at_10%_20%,_rgba(13,27,42,0.95)_0%,_rgba(10,22,40,0.98)_90%)] bg-slate-950 p-6 overflow-y-auto">
      {/* Login Card */}
      <div className="w-full max-w-[480px] bg-slate-900/75 backdrop-blur-[20px] border border-white/10 rounded-[20px] p-10 shadow-[0_16px_40px_rgba(0,0,0,0.4),_0_0_40px_rgba(0,201,167,0.05)] flex flex-col gap-6 animate-fade-in-up">

        {/* Header */}
        <div className="text-center flex flex-col items-center gap-2">
          {/* โลโก้หยดเลือด — ใช้รูปเดียวกับ favicon (src/app/icon.svg) */}
          <div className="w-[120px] h-[120px] mb-4 flex items-center justify-center bg-white/5 rounded-full border border-teal-500/20 shadow-[0_0_24px_rgba(0,201,167,0.15)]">
            <Image src="/icon.svg" alt="Iron Zero Risk" width={64} height={64} priority />
          </div>
          <h1 className="font-bold text-2xl text-teal-400 tracking-wide">
            IRON ZERO RISK
          </h1>
          <p className="text-sm text-slate-400">ระบบติดตามสุขภาพเด็ก</p>
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${message.tone === "red" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-amber-500/10 border-amber-500/30 text-amber-200"}`}>
            {message.text}
          </div>
        )}

        <a
          href={MOPH_LOGIN_URL}
          className="w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-br from-teal-600 to-teal-800 hover:from-teal-500 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-[0_4px_12px_rgba(0,143,122,0.3)]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          เข้าสู่ระบบด้วย MOPH ID
        </a>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          สำหรับเจ้าหน้าที่สาธารณสุขที่มีบัญชี Provider ID<br />
          ผู้ใช้ใหม่ต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนใช้งาน
        </p>
      </div>
    </div>
  );
}
