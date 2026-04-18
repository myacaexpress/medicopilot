/**
 * Shared fixture helpers. Each spec starts by calling
 * installAllMocks(page) before navigating so the app boots with mocked
 * mediaDevices, /api/* endpoints, and WebSocket.
 */

export { installMediaMocks } from "./mockMediaDevices.js";
export { installApiMocks } from "./mockApi.js";
export { installWssMock } from "./mockWss.js";

import { installMediaMocks } from "./mockMediaDevices.js";
import { installApiMocks } from "./mockApi.js";
import { installWssMock } from "./mockWss.js";

export async function installAllMocks(page, opts = {}) {
  await Promise.all([
    installMediaMocks(page),
    installApiMocks(page, opts.api),
    installWssMock(page),
  ]);
}
