// Shared helpers. Every test gets an `app` object that drives the map the way a
// player would: taps on hexes, holds, sheet buttons.
const { test: base, expect } = require("@playwright/test");
const path = require("path");

const MOCK = path.join(__dirname, "mock-claude.js");
const FIREBASE = path.join(__dirname, "fake-firebase.js");

const test = base.extend({
  app: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    // fonts are cosmetic and slow offline; the app has fallbacks
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

    const app = {
      page, errors,
      /** open the map. mock: options for the fake claude.ai store, or false.
       *  firebase: true to use the fake Firebase database instead (the GitHub Pages setup). */
      async open({ mock = {}, firebase = false } = {}) {
        if (firebase) { mock = false; await page.addInitScript({ path: FIREBASE }); }
        if (mock) {
          await page.addInitScript(o => { window.__mockOptions = o; }, mock);
          await page.addInitScript({ path: MOCK });
        }
        await page.goto("/");
        await page.waitForFunction(() => window.__soc && window.__hexScreen);
        if (mock) await page.waitForFunction(() => window.__mockStore);
        await page.waitForTimeout(100);
      },
      state: () => page.evaluate(() => window.__soc.state()),
      view: id => page.evaluate(i => window.__soc.view(i), id),
      async zoomIn() {
        const b = await page.locator("#map").boundingBox();
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(80);
      },
      // the map shifts when the bottom sheet opens or closes; let that settle before aiming
      settle: () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))),
      async at(c, r) { await app.settle(); return page.evaluate(([c, r]) => window.__hexScreen(c, r), [c, r]); },
      async tapHex(c, r) { const [x, y] = await app.at(c, r); await page.touchscreen.tap(x, y); await page.waitForTimeout(60); },
      async holdHex(c, r) {
        const [x, y] = await app.at(c, r);
        await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
        await page.waitForTimeout(60);
      },
      sheet: () => page.locator("#sheet"),
      heading: () => page.locator("#sheet .shead h2"),
      button: name => page.locator("#sheet").getByRole("button", { name, exact: true }),
      footer: name => page.locator("#sheet .sfoot").getByRole("button", { name, exact: true }),
      row: label => page.locator("#sheet button.rowbtn", { has: page.locator(".rl", { hasText: new RegExp(`^${label}$`) }) }),
      async setLand(c, r, name) {
        await app.tapHex(c, r);
        if (await app.heading().textContent() !== "Land") await app.row("Land").click();
        await app.button(name).click();
      },
      async done() { await app.footer("Clear selection").click(); await app.settle(); }
    };
    await use(app);
    expect(errors, "the page threw errors").toEqual([]);
  }
});

module.exports = { test, expect };
