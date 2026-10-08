// Phone layout, the menu, and the map's own rules.
const { test, expect } = require("./support/fixtures");

const noSidewaysScroll = page => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);
const allInside = (page, scope) => page.locator(`${scope} button:visible`).evaluateAll(btns =>
  btns.filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > window.innerWidth + 1); }).map(b => b.textContent.trim()));

test("opens with the whole map fitted, in portrait, with no title bar", async ({ app }) => {
  await app.open({ mock: false });
  const st = await app.state();
  expect([st.cols, st.rows]).toEqual([32, 53]);
  const first = await app.at(0, 0), last = await app.at(31, 52);
  const box = await app.page.locator("#map").boundingBox();
  for (const [x, y] of [first, last]) { expect(x).toBeGreaterThanOrEqual(box.x); expect(x).toBeLessThanOrEqual(box.x + box.width); expect(y).toBeGreaterThanOrEqual(box.y); expect(y).toBeLessThanOrEqual(box.y + box.height); }
  await expect(app.page.locator("h1")).toHaveCount(0);
  await expect(app.page.locator("#ageLabel")).toHaveText("First Age · area 19");
});

test("nothing is cut off at phone width", async ({ app }) => {
  // regression: the top bar and sheet once ran wider than the phone and clipped buttons
  await app.open();
  await app.zoomIn();
  expect(await noSidewaysScroll(app.page)).toBe(true);
  await app.setLand(16, 26, "Forest");
  expect(await allInside(app.page, "#sheet")).toEqual([]);
  await app.row("Markers").click();
  expect(await allInside(app.page, "#sheet")).toEqual([]);
  await app.done();
  expect(await allInside(app.page, "#draftBar")).toEqual([]);
  expect(await noSidewaysScroll(app.page)).toBe(true);
});

test("the selected hex stays visible above the sheet", async ({ app }) => {
  await app.open();
  await app.zoomIn();
  // pick a hex low on the screen, where the sheet will open over it
  const box = await app.page.locator("#map").boundingBox();
  const r = await app.page.evaluate(bottom => { for (let r = 52; r >= 0; r--) { const [, y] = window.__hexScreen(16, r); if (y < bottom - 30) return r; } }, box.y + box.height);
  await app.tapHex(16, r);
  const [, y] = await app.at(16, r);
  const sheetTop = (await app.sheet().boundingBox()).y;
  expect(y).toBeLessThan(sheetTop);
});

test("controls are at least 44 pixels for thumbs", async ({ app }) => {
  await app.open();
  await app.zoomIn();
  await app.setLand(16, 26, "Forest");
  const small = await app.page.locator("#sheet button:visible, #menuBtn, .zbtn").evaluateAll(els =>
    els.map(e => [e.getAttribute("aria-label") || e.textContent.trim(), e.getBoundingClientRect().height]).filter(([, h]) => h < 43.5));
  expect(small).toEqual([]);
});

test("the menu holds History, Key, and Age and map size", async ({ app }) => {
  await app.open();
  await app.page.locator("#menuBtn").click();
  const items = await app.page.locator("#mBody button.link strong").allTextContents();
  expect(items).toEqual(["History", "Key", "Age and map size"]);
  await app.page.locator("#mBody button.link", { hasText: "Key" }).click();
  await expect(app.page.locator("#mBody")).toContainText("Markers have no set meaning");
  await app.page.getByRole("button", { name: "Close" }).click();
  await expect(app.page.locator("#modal")).toBeHidden();
});

test("land drawn with retired or renamed types still shows correctly", async ({ app }) => {
  await app.open();
  const info = await app.page.evaluate(() => ["grassland", "sea", "swamp", "tundra", "lake", "jungle", "volcano", "glacier", "shallows", "river"].map(t => window.__soc.landInfo(t).name));
  expect(info).toEqual(["Plains", "Water", "Wetland", "Tundra", "Lake", "Rainforest", "Volcano", "Glacier", "Shallows", "River"]);
});

test("posts fold in order, later fields win, empty values clear", async ({ app }) => {
  await app.open();
  const out = await app.page.evaluate(() => {
    const m = window.__soc.fold([
      { changes: { a: { t: "forest", n: ["Deep"] }, b: { t: "sea" } } },
      { changes: { a: { t: "hills" }, b: { t: null } } },
      { changes: { a: { n: [] } } }
    ]);
    return Object.fromEntries(m);
  });
  expect(out).toEqual({ a: { t: "hills" } });
});

test("hex picking matches the hex centers", async ({ app }) => {
  await app.open();
  const ok = await app.page.evaluate(() => {
    const { center, pick } = window.__soc; const bad = [];
    for (const [c, r] of [[0, 0], [5, 3], [31, 52], [16, 26], [7, 11]]) { const [x, y] = center(c, r); const p = pick(x, y); if (!p || p[0] !== c || p[1] !== r) bad.push([c, r, p]); }
    return bad;
  });
  expect(ok).toEqual([]);
});
