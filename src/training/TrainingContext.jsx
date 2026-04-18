/**
 * TrainingContext — manages the training session lifecycle, tester
 * identity, scenario selection, role toggle, flags, and auto-save.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const TESTER_KEY = "trainingTesterName";
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || (import.meta.env.VITE_BACKEND_WSS_URL?.replace("wss://", "https://").replace("/stream", "") || "");

const TrainingCtx = createContext(null);

export function TrainingProvider({ children }) {
  const [testerName, setTesterNameRaw] = useState(() => {
    try { return localStorage.getItem(TESTER_KEY) || ""; } catch { return ""; }
  });
  const [activeSession, setActiveSession] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [speakerRole, setSpeakerRole] = useState("agent");
  const [flags, setFlags] = useState([]);
  const sessionStartedAt = useRef(null);

  const setTesterName = useCallback((name) => {
    const trimmed = (name || "").trim();
    setTesterNameRaw(trimmed);
    try { localStorage.setItem(TESTER_KEY, trimmed); } catch {}
    if (trimmed && API_BASE) {
      fetch(`${API_BASE}/api/training/tester`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      }).catch(() => {});
    }
  }, []);

  const startSession = useCallback(async (scenario) => {
    setActiveScenario(scenario || null);
    setSpeakerRole("agent");
    setFlags([]);
    sessionStartedAt.current = Date.now();
    if (!API_BASE || !testerName) {
      const local = { id: `local_${Date.now()}`, tester_name: testerName, scenario_id: scenario?.id };
      setActiveSession(local);
      return local;
    }
    try {
      const res = await fetch(`${API_BASE}/api/training/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testerName, scenarioId: scenario?.id || null }),
      });
      const session = await res.json();
      setActiveSession(session);
      return session;
    } catch {
      const local = { id: `local_${Date.now()}`, tester_name: testerName, scenario_id: scenario?.id };
      setActiveSession(local);
      return local;
    }
  }, [testerName]);

  const endSession = useCallback(async (summary) => {
    if (!activeSession) return;
    if (API_BASE && !activeSession.id.startsWith("local_")) {
      fetch(`${API_BASE}/api/training/session/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, summary }),
      }).catch(() => {});
    }
    setActiveSession(null);
    setActiveScenario(null);
    setFlags([]);
    sessionStartedAt.current = null;
  }, [activeSession]);

  const appendTranscript = useCallback((utterance) => {
    if (!activeSession || !API_BASE || activeSession.id.startsWith("local_")) return;
    fetch(`${API_BASE}/api/training/transcript-append`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: activeSession.id, utterance }),
    }).catch(() => {});
  }, [activeSession]);

  const appendSuggestion = useCallback((suggestion) => {
    if (!activeSession || !API_BASE || activeSession.id.startsWith("local_")) return;
    fetch(`${API_BASE}/api/training/suggestion-append`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: activeSession.id, suggestion }),
    }).catch(() => {});
  }, [activeSession]);

  const addFlag = useCallback(async (flag) => {
    const elapsed = sessionStartedAt.current ? Math.floor((Date.now() - sessionStartedAt.current) / 1000) : null;
    const newFlag = { ...flag, testerName, tsInCallSeconds: elapsed, createdAt: new Date().toISOString() };
    setFlags((prev) => [...prev, newFlag]);
    if (activeSession && API_BASE && !activeSession.id.startsWith("local_")) {
      try {
        const res = await fetch(`${API_BASE}/api/training/flag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSession.id,
            testerName,
            tsInCallSeconds: elapsed,
            transcriptContext: flag.transcriptContext || null,
            aiSuggestionShown: flag.aiSuggestionShown || null,
            feedbackType: flag.feedbackType || null,
            feedbackText: flag.feedbackText || null,
            suggestedFix: flag.suggestedFix || null,
          }),
        });
        const saved = await res.json();
        return saved;
      } catch {
        return newFlag;
      }
    }
    return newFlag;
  }, [activeSession, testerName]);

  const toggleSpeakerRole = useCallback(() => {
    setSpeakerRole((prev) => prev === "agent" ? "client" : "agent");
  }, []);

  // End session on page unload
  useEffect(() => {
    const onUnload = () => {
      if (activeSession && API_BASE && !activeSession.id.startsWith("local_")) {
        navigator.sendBeacon(
          `${API_BASE}/api/training/session/end`,
          JSON.stringify({ sessionId: activeSession.id })
        );
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [activeSession]);

  return (
    <TrainingCtx.Provider value={{
      testerName, setTesterName,
      activeSession, activeScenario,
      startSession, endSession,
      speakerRole, setSpeakerRole, toggleSpeakerRole,
      flags, addFlag,
      appendTranscript, appendSuggestion,
      sessionStartedAt,
    }}>
      {children}
    </TrainingCtx.Provider>
  );
}

export function useTraining() {
  const ctx = useContext(TrainingCtx);
  if (!ctx) throw new Error("useTraining must be used within <TrainingProvider>");
  return ctx;
}
