"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Child, Me } from "@/lib/types";

// ── Logged-in user ─────────────────────────────────────────────────────
const MeContext = createContext<Me | null>(null);
export const MeProvider = MeContext.Provider;

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside the dashboard layout");
  return me;
}

export const isStaff = (me: Me) => me.role === "admin" || me.role === "staff";

// ── Toasts ─────────────────────────────────────────────────────────────
type Toast = { id: number; text: string; type: "success" | "error" };
const ToastContext = createContext<(text: string, type?: Toast["type"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const show = useCallback((text: string, type: Toast["type"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm border ${t.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-teal-200 text-slate-700"}`}>
            {t.type === "error" ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-teal-600" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Children list ──────────────────────────────────────────────────────
export function useChildren() {
  const [children, setChildren] = useState<Child[]>([]);
  // `loading` is only true until the first response; later reloads refresh the
  // data in place so forms and open modals are not swapped for a spinner.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setChildren(await api<Child[]>("/children"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    reload();
  }, [reload]);

  return { children, loading, error, reload };
}
