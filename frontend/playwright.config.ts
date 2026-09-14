import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3410", browserName: "chromium", trace: "retain-on-failure" },
  webServer: [
    { command: "../backend/.venv/bin/python ../backend/tests/serve_e2e.py", url: "http://127.0.0.1:8410/health", reuseExistingServer: false, timeout: 30000 },
    { command: "node tests/start-e2e.mjs", url: "http://127.0.0.1:3410", reuseExistingServer: false, env: { INTERNAL_API_URL: "http://127.0.0.1:8410", HOSTNAME: "127.0.0.1", PORT: "3410" }, timeout: 30000 },
  ],
});
