/**
 * Simulated live-call transcript for the v1 demo.
 *
 * At P2 this is replaced by a live Deepgram-driven transcript stream;
 * these lines stay as a seeded fixture for demos and tests.
 *
 * @typedef {Object} TranscriptLine
 * @property {"agent"|"client"} speaker
 * @property {string}            text
 * @property {string}            time       mm:ss timestamp in UI
 * @property {boolean}           [isQuestion] triggers AI suggestion card
 */

/** @type {TranscriptLine[]} */
export const transcriptLines = [
  { speaker: "agent", text: "Good afternoon Mrs. Garcia, this is James with Trifecta Benefits. I'm required to let you know that I'm a licensed agent with a third-party marketing organization.", time: "2:01" },
  { speaker: "client", text: "Okay, that's fine.", time: "2:01" },
  { speaker: "agent", text: "Perfect. I see you're currently on Original Medicare with a standalone prescription drug plan. How has that been working for you?", time: "2:02" },
  { speaker: "client", text: "It's okay but my drug costs keep going up. I'm paying a lot for my Eliquis.", time: "2:03" },
  { speaker: "agent", text: "I understand. Let me look into that for you.", time: "2:03" },
  { speaker: "client", text: "Can you tell me what plans would cover my Eliquis? I'm in Pembroke Pines.", time: "2:03", isQuestion: true },
  { speaker: "agent", text: "Absolutely. Let me pull up plans in your area that cover Eliquis...", time: "2:04" },
  { speaker: "client", text: "Also, I really need to make sure Dr. Patel at Baptist Health is in the network. He's been my doctor for years.", time: "2:05", isQuestion: true },
  { speaker: "client", text: "And what about dental? My teeth have been bothering me and Original Medicare doesn't cover dental at all.", time: "2:06", isQuestion: true },
];
