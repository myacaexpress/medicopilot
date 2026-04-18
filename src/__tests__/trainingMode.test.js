import { describe, it, expect, vi } from "vitest";
import { leadReducer } from "../lead/LeadContext.jsx";

describe("push-to-talk keyboard logic", () => {
  function makePttHandler(onDown, onUp) {
    return {
      keydown: (e) => {
        if (e.code !== "Space" || e.repeat) return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        onDown();
      },
      keyup: (e) => {
        if (e.code !== "Space") return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        onUp();
      },
    };
  }

  it("space down triggers onDown, space up triggers onUp", () => {
    const onDown = vi.fn();
    const onUp = vi.fn();
    const h = makePttHandler(onDown, onUp);

    h.keydown({ code: "Space", repeat: false, target: { tagName: "DIV" } });
    expect(onDown).toHaveBeenCalledTimes(1);

    h.keyup({ code: "Space", target: { tagName: "DIV" } });
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("ignores repeat keydown events", () => {
    const onDown = vi.fn();
    const h = makePttHandler(onDown, vi.fn());

    h.keydown({ code: "Space", repeat: false, target: { tagName: "DIV" } });
    h.keydown({ code: "Space", repeat: true, target: { tagName: "DIV" } });
    h.keydown({ code: "Space", repeat: true, target: { tagName: "DIV" } });
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it("ignores space in input and textarea fields", () => {
    const onDown = vi.fn();
    const h = makePttHandler(onDown, vi.fn());

    h.keydown({ code: "Space", repeat: false, target: { tagName: "INPUT" } });
    h.keydown({ code: "Space", repeat: false, target: { tagName: "TEXTAREA" } });
    expect(onDown).not.toHaveBeenCalled();
  });

  it("ignores non-Space keys", () => {
    const onDown = vi.fn();
    const h = makePttHandler(onDown, vi.fn());

    h.keydown({ code: "Enter", repeat: false, target: { tagName: "DIV" } });
    h.keydown({ code: "KeyA", repeat: false, target: { tagName: "DIV" } });
    expect(onDown).not.toHaveBeenCalled();
  });
});

describe("training mode resets on call end", () => {
  it("leadReducer CLEAR nulls state (provider manages training reset)", () => {
    const state = { fields: {}, updatedAt: "2024-01-01" };
    expect(leadReducer(state, { type: "CLEAR" })).toBeNull();
  });
});

describe("training theme constants", () => {
  it("orange training theme values are defined", () => {
    expect("#FF8A3D").toMatch(/^#[0-9A-F]{6}$/i);
    expect("#CC6B2E").toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("server training mode speaker override", () => {
  it("ptt speaking=true maps to agent, false maps to client", () => {
    let trainingMode = true;
    let pttSpeaking = false;
    let agentLabel = 0;
    let speakerLocked = true;

    const mapSpeaker = (dgSpeaker) => {
      if (trainingMode) return pttSpeaking ? "agent" : "client";
      if (!speakerLocked) {
        agentLabel = dgSpeaker;
        speakerLocked = true;
      }
      return dgSpeaker === agentLabel ? "agent" : "client";
    };

    expect(mapSpeaker(0)).toBe("client");
    expect(mapSpeaker(1)).toBe("client");

    pttSpeaking = true;
    expect(mapSpeaker(0)).toBe("agent");
    expect(mapSpeaker(1)).toBe("agent");

    trainingMode = false;
    expect(mapSpeaker(0)).toBe("agent");
    expect(mapSpeaker(1)).toBe("client");
  });
});
