import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "result" | "info" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

/** Short-lived result notices (rolls, casts). They are announced politely and also stay in each panel's own status line. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((text: string, tone: Toast["tone"] = "result") => {
    if (!text.trim()) return;
    const id = next.current++;
    setToasts((current) => [...current.slice(-3), { id, text, tone }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 9000 : 6500);
  }, [dismiss]);
  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-region" role="status" aria-live="polite" aria-label="Roll results">
      {toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.tone}`}>
        <span className="toast-mark" aria-hidden="true">{toast.tone === "error" ? "!" : "✦"}</span>
        <p>{toast.text}</p>
        <button type="button" className="toast-close" aria-label="Dismiss notice" onClick={() => dismiss(toast.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() { return useContext(ToastContext); }
