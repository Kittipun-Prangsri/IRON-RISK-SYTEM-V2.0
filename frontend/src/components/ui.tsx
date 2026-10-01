"use client";
import { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { RISK_STYLE } from "@/lib/constants";
import type { RiskLevel } from "@/lib/types";

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <span className="text-slate-400">-</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${RISK_STYLE[level].badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${RISK_STYLE[level].dot}`} />
      {level}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
      <div>
        <h2 className="font-kanit text-2xl font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="font-kanit font-medium text-slate-800">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Loading({ label = "กำลังโหลดข้อมูล..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500 text-sm">
      <RefreshCw className="animate-spin text-teal-500" size={28} />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-100">ลองใหม่</button>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-400">{text}</div>;
}

export function Modal({ title, onClose, children, footer, size = "md" }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className={`bg-white rounded-2xl shadow-xl w-full ${width} max-h-[90vh] flex flex-col overflow-hidden border border-slate-100`}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center gap-3">
          <h3 className="font-kanit font-semibold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-slate-50/40">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end bg-white">{footer}</div>}
      </div>
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  secondary: "inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm disabled:opacity-50",
  dangerSoft: "inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 text-sm font-medium",
  ghost: "inline-flex items-center gap-1.5 px-3 py-1.5 text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-medium",
};

export const input = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";
export const label = "block text-xs font-medium text-slate-600 mb-1.5";

export function Field({ label: text, children, required, className = "" }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={label}>{text}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}
