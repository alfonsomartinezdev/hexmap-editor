// Phone-sized, touch-enabled, one browser engine per project.
const { defineConfig } = require("@playwright/test");

const phone = { viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

module.exports = defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.js/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:4173", ...phone },
  webServer: { command: "node tests/support/serve.js", url: "http://localhost:4173", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "chromium-phone", use: { browserName: "chromium" } },
    // iPhone is the main target; WebKit is Safari's engine. Runs in CI, where it can be installed.
    ...(process.env.SKIP_WEBKIT ? [] : [{ name: "webkit-phone", use: { browserName: "webkit" } }])
  ]
});
