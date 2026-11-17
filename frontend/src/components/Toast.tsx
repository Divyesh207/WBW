import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type Kind = "success" | "error";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<{ success: (m: string) => void; error: (m: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(
    () => ({ success: (m: string) => push("success", m), error: (m: string) => push("error", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-start gap-3 rounded-md border border-brand-line bg-white px-4 py-3 text-sm shadow-lg shadow-brand-dark/5"
              role={t.kind === "error" ? "alert" : "status"}
            >
              {t.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
              )}
              <p className="flex-1 text-brand-ink">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-brand-muted hover:text-brand-ink" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
