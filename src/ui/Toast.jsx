/**
 * Toast — transient top-right notification primitive.
 *
 * Minimal by design: one toast slot at a time, 4s auto-dismiss, manual ×.
 * Callers queue via `useToast().show({ kind, title, detail })`. A queued
 * toast replaces the currently shown one immediately (no stacking for now —
 * we can layer later if P2 suggestion-trigger noise demands it).
 *
 * @typedef {"info"|"warn"|"error"} ToastKind
 *
 * @typedef {Object} ToastPayload
 * @property {ToastKind} [kind]   defaults to "info"
 * @property {string}   title
 * @property {string}   [detail]
 * @property {number}   [duration] ms; defaults to 4000
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastCtx = createContext(null);

/**
 * Wrap app children. Renders a viewport in the top-right.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(/** @type {null | (ToastPayload & {id: number})} */ (null));
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback((payload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = { id: Date.now(), kind: "info", duration: 4000, ...payload };
    setToast(next);
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, next.duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ show, dismiss }}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Viewport / single toast renderer ───

const KIND_STYLES = {
  info:  { accent: "#1A9EA2", bg: "rgba(0,123,127,0.18)", border: "rgba(0,123,127,0.4)" },
  warn:  { accent: "#F5A623", bg: "rgba(245,166,35,0.18)", border: "rgba(245,166,35,0.45)" },
  error: { accent: "#F47C6E", bg: "rgba(231,76,60,0.22)", border: "rgba(231,76,60,0.5)" },
};

function ToastViewport({ toast, onDismiss }) {
  if (!toast) return null;
  const k = KIND_STYLES[toast.kind] || KIND_STYLES.info;
  return (
    <div
      // Positioned fixed so it escapes any container stacking context and
      // sits visibly above the modal overlay (z=200) used by CaptureLeadModal.
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        minWidth: 240, maxWidth: 360,
        background: "rgba(20,26,32,0.96)", backdropFilter: "blur(12px)",
        border: `1px solid ${k.border}`, borderLeft: `3px solid ${k.accent}`,
        borderRadius: 10,
        boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        padding: "10px 12px",
        display: "flex", alignItems: "flex-start", gap: 10,
        fontFamily: "'Montserrat', sans-serif",
        animation: "toastIn 180ms ease-out",
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: k.bg, color: k.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
      }}>
        {toast.kind === "error" ? "!" : toast.kind === "warn" ? "⚠" : "i"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 11,
          color: "rgba(255,255,255,0.92)", letterSpacing: "0.02em", lineHeight: 1.35,
        }}>
          {toast.title}
        </div>
        {toast.detail && (
          <div style={{
            fontFamily: "'Lora', Georgia, serif", fontSize: 11,
            color: "rgba(255,255,255,0.6)", lineHeight: 1.45, marginTop: 3,
          }}>
            {toast.detail}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", fontSize: 14, padding: 2, lineHeight: 1,
        }}
      >
        ×
      </button>
      <style>{`@keyframes toastIn { from { transform: translateY(-8px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}
