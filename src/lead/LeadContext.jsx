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

import { createContext, useContext, useReducer, useEffect, useCallback } from "react";

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
    <LeadCtx.Provider value={{ lead, dispatch }}>
      {children}
    </LeadCtx.Provider>
  );
}

/**
 * Hook to consume the active lead context.
 * @returns {{
 *   lead: LeadContext|null,
 *   actions: {
 *     capture: (lead: LeadContext) => void,
 *     updateField: (fieldName: string, value: *, confidence?: Confidence) => void,
 *     clear: () => void,
 *     switchLead: (lead: LeadContext) => void,
 *   }
 * }}
 */
export function useLead() {
  const ctx = useContext(LeadCtx);
  if (!ctx) throw new Error("useLead must be used within <LeadProvider>");

  const { lead, dispatch } = ctx;

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
    actions: { capture, updateField, clear, switchLead },
  };
}
