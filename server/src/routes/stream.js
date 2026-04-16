/**
 * WSS /stream — long-lived WebSocket for the live-call pipeline.
 *
 * Tier 1 scope (current): accept a connection, emit a `hello` frame
 * with a session id, round-trip `ping`→`pong` JSON messages, log
 * disconnects cleanly. No audio, no Deepgram, no AI triggers yet —
 * this is the minimum infrastructure proof for Fly.io deployment.
 *
 * Tier 2 will add:
 *   - Binary audio frame ingest (AudioWorklet → WSS)
 *   - Deepgram proxy (Nova-3 streaming + diarization)
 *   - Utterance broadcast back to the client as `utterance` events
 *
 * Wire format (JSON only for now, UTF-8):
 *   server→client:
 *     { type: "hello", sessionId: string, serverTime: ISO }
 *     { type: "pong", t: number }
 *     { type: "error", code: string, message: string }
 *   client→server:
 *     { type: "ping", t: number }
 *     { type: "bye" }  — graceful close signal
 */

import { randomUUID } from "node:crypto";

/** @param {import("fastify").FastifyInstance} app */
export default async function streamRoutes(app) {
  app.get("/stream", { websocket: true }, (socket, req) => {
    const sessionId = randomUUID();
    const log = app.log.child({ sessionId, remoteAddr: req.ip });
    log.info("stream: client connected");

    // Greet the client so they can confirm the upgrade worked end-to-end.
    socket.send(
      JSON.stringify({
        type: "hello",
        sessionId,
        serverTime: new Date().toISOString(),
      })
    );

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            code: "bad_json",
            message: "Expected JSON payload",
          })
        );
        return;
      }

      switch (msg.type) {
        case "ping":
          socket.send(JSON.stringify({ type: "pong", t: msg.t ?? Date.now() }));
          return;
        case "bye":
          log.info("stream: client sent bye");
          socket.close(1000, "client-bye");
          return;
        default:
          socket.send(
            JSON.stringify({
              type: "error",
              code: "unknown_type",
              message: `Unknown message type: ${msg.type}`,
            })
          );
      }
    });

    socket.on("close", (code, reason) => {
      log.info({ code, reason: reason?.toString() }, "stream: client disconnected");
    });

    socket.on("error", (err) => {
      log.error({ err }, "stream: socket error");
    });
  });
}
