import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(process.cwd());

/** Dedicated port so we never reuse an unrelated app on :3000. */
const port = process.env.PLAYWRIGHT_PORT ?? "3010";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const runQa = process.env.PLAYWRIGHT_QA === "1";

/**
 * Production standalone server (not `next dev`). `output: "standalone"`
 * cannot be served with `next start`. CI builds before webServer runs;
 * locally you need a `.next` output first (`npm run build`).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Leave headroom under the GitHub Actions 10-minute job cap.
  globalTimeout: process.env.CI ? 8 * 60 * 1000 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // GitHub Actions / Docker give Chromium ~64MB /dev/shm. A second live
    // console (or Stage) then sad-tabs with "This page couldn't load".
    launchOptions: {
      args: ["--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "tests/e2e/.auth/operator.json"),
      },
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /qa-engagement-pov\.spec\.ts/],
    },
    ...(runQa
      ? [
          {
            name: "qa",
            use: {
              ...devices["Desktop Chrome"],
              storageState: path.join(__dirname, "tests/e2e/.auth/operator.json"),
              video: "on" as const,
              screenshot: "on" as const,
              trace: "on" as const,
              viewport: { width: 1440, height: 900 },
            },
            dependencies: ["setup"],
            testMatch: /qa-engagement-pov\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    command: "bash scripts/start-web-e2e.sh",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      AUTH_URL: baseURL,
      PORT: port,
      HOSTNAME: "127.0.0.1",
      ALLOW_DEV_DEFAULTS: process.env.ALLOW_DEV_DEFAULTS ?? "true",
      MEDIA_ROOT: path.join(__dirname, "data", "media"),
    },
  },
});
