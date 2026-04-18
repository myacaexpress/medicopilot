import { createContext, useContext, useState, useCallback, useRef } from "react";
import { createSession, endSession, createFlag } from "./api.js";

const TrainingCtx = createContext(null);

const NAME_KEY = "medicopilot_tester_name";

export function TrainingProvider({ children }) {
  const [testerName, setTesterNameRaw] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  });
  const [scenario, setScenario] = useState(null);
  const [session, setSession] = useState(null);
  const [flags, setFlags] = useState([]);
  const sessionRef = useRef(null);

  const setTesterName = useCallback((name) => {
    setTesterNameRaw(name);
    try { localStorage.setItem(NAME_KEY, name); } catch {}
  }, []);

  const startSession = useCallback(async (scenarioObj) => {
    setScenario(scenarioObj);
    setFlags([]);
    try {
      const s = await createSession(scenarioObj.id, testerName);
      setSession(s);
      sessionRef.current = s;
      return s;
    } catch (err) {
      const local = { id: `local_${Date.now()}`, scenario_id: scenarioObj.id, tester_name: testerName };
      setSession(local);
      sessionRef.current = local;
      return local;
    }
  }, [testerName]);

  const addFlag = useCallback(async (timestampMs, note, flagType = "general") => {
    const flag = { timestamp_ms: timestampMs, note, flag_type: flagType, created_at: new Date().toISOString() };
    setFlags((prev) => [...prev, flag]);
    const sid = sessionRef.current?.id;
    if (sid && typeof sid === "number") {
      createFlag(sid, timestampMs, note, flagType).catch(() => {});
    }
  }, []);

  const finishSession = useCallback(async ({ rating, feedbackText, durationMs }) => {
    const sid = sessionRef.current?.id;
    if (sid && typeof sid === "number") {
      try {
        await endSession(sid, { rating, feedback_text: feedbackText, duration_ms: durationMs });
      } catch {}
    }
    setSession(null);
    setScenario(null);
    setFlags([]);
    sessionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setSession(null);
    setScenario(null);
    setFlags([]);
    sessionRef.current = null;
  }, []);

  return (
    <TrainingCtx.Provider value={{
      testerName, setTesterName,
      scenario, session, flags,
      startSession, addFlag, finishSession, reset,
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
