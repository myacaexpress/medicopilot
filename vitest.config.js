import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest only runs the frontend test suite. The server package under
 * `server/` uses the built-in `node:test` runner (see `server/README.md`)
 * and is explicitly excluded here — vitest would otherwise discover
 * those files and fail on `import { test } from "node:test"`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    exclude: ["node_modules", "server", "dist", ".git"],
  },
});
