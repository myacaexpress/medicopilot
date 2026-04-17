/**
 * LeadContext — React context + reducer for the active lead.
 *
 * Single source of truth for "who is on the call." Mirrors the canonical
 * LeadContext type from plans/PRD.md § Data models.
 *
 * @typedef {"manual"|"vision"|"webhook"|"five9"|"paste"|"agent-confirmed"} FieldSource
 * @typedef {"verified"|"high"|"medium"|"low"} Confidence
 *
 * @typedef {Object} FieldValue
 * @property {*} v              The field value
 * @property {Confidence} confidence
 * @property {FieldSource} source
 * @property {string} lastEditedAt  ISO timestamp
 *
 * @typedef {Object} LeadFields
 * @property {FieldValue<string>} [firstName]
 * @property {FieldValue<string>} [lastName]
 * @property {FieldValue<string>} [dob]
 * @property {FieldValue<string>} [phone]
 * @property {FieldValue<{street?: string, city?: string, state: string, zip: string}>} [address]
 * @property {FieldValue<string>} [coverage]
 * @property {FieldValue<string[]>} [medications]
 * @property {FieldValue<string[]>} [providers]
 *
 * @typedef {Object} LeadContext
 * @property {string} id
 * @property {"manual"|"vision"|"webhook"|"five9"|"paste"} source
 * @property {LeadFields} fields
 * @property {string} createdAt  ISO timestamp
 * @property {string} updatedAt  ISO timestamp
 */

import { createContext, useContext, useReducer, useEffect, useCallback, useState, useRef } from "react";

const STORAGE_KEY = "medicopilot_active_lead";

/** @param {FieldSource} source @param {Confidence} confidence @param {*} v */
export function makeField(v, confidence = "medium", source = "vision") {
  return { v, confidence, source, lastEditedAt: new Date().toISOString() };
}

/**
 * Build a full LeadContext from extracted fields (vision or paste).
 * @param {Record<string, {v: *, confidence?: Confidence}>} raw
 * @param {"vision"|"paste"|"manual"} source
 * @returns {LeadContext}
 */
export function buildLeadFromExtraction(raw, source = "vision") {
  const now = new Date().toISOString();
  const id = `captured_${Date.now()}`;
  const fields = {};

  const mapping = {
    firstName: "firstName",
    first_name: "firstName",
    lastName: "lastName",
    last_name: "lastName",
    name: "_fullName",
    dob: "dob",
    date_of_birth: "dob",
    phone: "phone",
    address: "address",
    zip: "_zip",
    coverage: "coverage",
    medications: "medications",
    providers: "providers",
  };

  for (const [key, val] of Object.entries(raw)) {
    const normalized = mapping[key] || mapping[key.toLowerCase()] || key;
    if (normalized === "_fullName" && val.v) {
      const parts = String(val.v).trim().split(/\s+/);
      fields.firstName = makeField(parts[0] || "", val.confidence || "medium", source);
      fields.lastName = makeField(parts.slice(1).join(" ") || "", val.confidence || "medium", source);
    } else if (normalized === "_zip" && val.v) {
      fields.address = makeField(
        { state: "", zip: String(val.v), city: "", street: "" },
        val.confidence || "medium",
        source
      );
    } else if (normalized !== "_fullName" && normalized !== "_zip") {
      fields[normalized] = makeField(val.v, val.confidence || "medium", source);
    }
  }

  return { id, source, fields, createdAt: now, updatedAt: now };
}

/**
 * Commit an inline edit from the LeadContextPanel back into the reducer.
 * Handles compound fields by splitting/parsing the draft string into the
 * canonical underlying fields before calling `updateField`.
 *
 *   editKind === "name"     → splits into firstName + lastName
 *   editKind === "address"  → parses "[Street,] City, ST 12345" into
 *                             { street?, city, state, zip }; falls back to
 *                             the raw string if the pattern doesn't match
 *   editKind === anything else → updates that single field by name
 *
 * @param {LeadContext} ctxLead
 * @param {string} editKind
 * @param {string} nextValue
 * @param {(fieldName: string, value: *, confidence?: Confidence) => void} updateField
 */
export function commitLeadEdit(ctxLead, editKind, nextValue, updateField) {
  const current = ctxLead?.fields || {};
  if (editKind === "name") {
    const parts = (nextValue || "").trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ");
    if (first !== (current.firstName?.v || "")) {
      updateField("firstName", first, "verified");
    }
    if (last !== (current.lastName?.v || "")) {
      updateField("lastName", last, "verified");
    }
    return;
  }
  if (editKind === "address") {
    // Split on commas and parse the trailing "ST ZIP" chunk. Two common
    // shapes are supported cleanly: "City, ST 12345" and
    // "Street, City, ST 12345". Everything else falls back to a raw string.
    const pieces = nextValue.split(",").map((p) => p.trim()).filter(Boolean);
    const last = pieces[pieces.length - 1] || "";
    const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5})$/);
    let parsed;
    if (stateZip && pieces.length === 2) {
      parsed = {
        street: current.address?.v?.street || "",
        city: pieces[0],
        state: stateZip[1].toUpperCase(),
        zip: stateZip[2],
      };
    } else if (stateZip && pieces.length === 3) {
      parsed = {
        street: pieces[0],
        city: pieces[1],
        state: stateZip[1].toUpperCase(),
        zip: stateZip[2],
      };
    } else {
      // Couldn't parse — store the raw string; downstream renderers
      // already handle either shape.
      parsed = nextValue;
    }
    updateField("address", parsed, "verified");
    return;
  }
  updateField(editKind, nextValue, "verified");
}

// ─── Call lifecycle ───

/**
 * Call state machine. Lives alongside the lead but is not persisted —
 * a refresh starts the agent in "idle" so transcription doesn't kick
 * off until they explicitly click Start Call. Transitions:
 *
 *   idle    → active   (Start Call clicked, or P4: CallKit auto-detect)
 *   active  → ended    (End Call clicked, or remote hangup)
 *   ended   → active   (Start Call clicked again — new call segment)
 *
 * @typedef {"idle"|"active"|"ended"} CallState
 */

/**
 * @typedef {Object} CallLifecycle
 * @property {CallState} state
 * @property {number|null} startedAt   ms epoch of the most recent transition into "active"
 * @property {number|null} endedAt     ms epoch of the most recent transition into "ended"
 * @property {() => void} startCall
 * @property {() => void} endCall
 * @property {() => number} elapsedMs  Live elapsed ms; 0 when idle, frozen when ended
 */

// ─── Reducer ───

/** @typedef {"CAPTURE"|"UPDATE_FIELD"|"CLEAR"|"SWITCH"|"HYDRATE"} ActionType */

/**
 * @param {LeadContext|null} state
 * @param {{type: ActionType, payload?: *}} action
 * @returns {LeadContext|null}
 */
export function leadReducer(state, action) {
  const now = new Date().toISOString();
  switch (action.type) {
    case "CAPTURE":
      return { ...action.payload, updatedAt: now };

    case "UPDATE_FIELD": {
      if (!state) return state;
      const { fieldName, value, confidence } = action.payload;
      return {
        ...state,
        updatedAt: now,
        fields: {
          ...state.fields,
          [fieldName]: {
            ...state.fields[fieldName],
            v: value,
            confidence: confidence || state.fields[fieldName]?.confidence || "medium",
            source: "manual",
            lastEditedAt: now,
          },
        },
      };
    }

    case "CLEAR":
      return null;

    case "SWITCH":
      return { ...action.payload, updatedAt: now };

    case "HYDRATE":
      return action.payload;

    default:
      return state;
  }
}

// ─── React Context ───

const LeadCtx = createContext(/** @type {{lead: LeadContext|null, dispatch: Function}} */ (null));

export function LeadProvider({ children }) {
  const [lead, dispatch] = useReducer(leadReducer, null, () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Transient call lifecycle. Intentionally not persisted — a page
  // refresh resets to "idle" so transcription doesn't auto-resume on
  // reload. PECL timer + MSP amber escalation key off `callStartedAt`
  // (not app-mount time) so escalations don't fire before the agent
  // has actually picked up.
  const [callState, setCallState] = useState(/** @type {CallState} */ ("idle"));
  const [callStartedAt, setCallStartedAt] = useState(/** @type {number|null} */ (null));
  const [callEndedAt, setCallEndedAt] = useState(/** @type {number|null} */ (null));
  const [trainingMode, setTrainingMode] = useState(false);
  const [pttActive, setPttActive] = useState(false);

  const startCall = useCallback(() => {
    setCallStartedAt(Date.now());
    setCallEndedAt(null);
    setCallState("active");
  }, []);

  const endCall = useCallback(() => {
    setCallEndedAt(Date.now());
    setCallState("ended");
    setTrainingMode(false);
    setPttActive(false);
  }, []);

  // Transient UI state: which field is currently highlighted by a hover
  // from an AI source pill. Not persisted. Auto-clears after 800ms per
  // spec §A3.
  const [highlightedField, setHighlightedField] = useState(null);
  const highlightTimerRef = useRef(null);

  const highlightField = useCallback((fieldName) => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    setHighlightedField(fieldName || null);
    if (fieldName) {
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedField(null);
        highlightTimerRef.current = null;
      }, 800);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      if (lead) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage full or unavailable — silent
    }
  }, [lead]);

  return (
    <LeadCtx.Provider value={{
      lead, dispatch,
      highlightedField, highlightField,
      callState, callStartedAt, callEndedAt,
      startCall, endCall,
      trainingMode, setTrainingMode,
      pttActive, setPttActive,
    }}>
      {children}
    </LeadCtx.Provider>
  );
}

/**
 * Hook to consume the active lead context.
 * @returns {{
 *   lead: LeadContext|null,
 *   highlightedField: string|null,
 *   call: {
 *     state: CallState,
 *     startedAt: number|null,
 *     endedAt: number|null,
 *     start: () => void,
 *     end: () => void,
 *   },
 *   actions: {
 *     capture: (lead: LeadContext) => void,
 *     updateField: (fieldName: string, value: *, confidence?: Confidence) => void,
 *     clear: () => void,
 *     switchLead: (lead: LeadContext) => void,
 *     highlightField: (fieldName: string|null) => void,
 *   }
 * }}
 */
export function useLead() {
  const ctx = useContext(LeadCtx);
  if (!ctx) throw new Error("useLead must be used within <LeadProvider>");

  const {
    lead, dispatch, highlightedField, highlightField,
    callState, callStartedAt, callEndedAt, startCall, endCall,
    trainingMode, setTrainingMode, pttActive, setPttActive,
  } = ctx;

  const capture = useCallback((newLead) => {
    dispatch({ type: "CAPTURE", payload: newLead });
  }, [dispatch]);

  const updateField = useCallback((fieldName, value, confidence) => {
    dispatch({ type: "UPDATE_FIELD", payload: { fieldName, value, confidence } });
  }, [dispatch]);

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, [dispatch]);

  const switchLead = useCallback((newLead) => {
    dispatch({ type: "SWITCH", payload: newLead });
  }, [dispatch]);

  return {
    lead,
    highlightedField,
    call: {
      state: callState,
      startedAt: callStartedAt,
      endedAt: callEndedAt,
      start: startCall,
      end: endCall,
    },
    training: {
      active: trainingMode,
      setActive: setTrainingMode,
      pttHeld: pttActive,
      setPttHeld: setPttActive,
    },
    actions: { capture, updateField, clear, switchLead, highlightField },
  };
}
