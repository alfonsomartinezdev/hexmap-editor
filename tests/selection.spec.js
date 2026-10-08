// Selecting hexes: one-handed, no precision gestures.
const { test, expect } = require("./support/fixtures");

test.beforeEach(async ({ app }) => { await app.open(); });

test("the first tap on the fitted map zooms in instead of selecting", async ({ app }) => {
  await expect(app.page.locator("#hint")).toHaveText("Tap the map to zoom in");
  await app.zoomIn();
  expect((await app.state()).selection).toEqual([]);
  await expect(app.sheet()).toBeHidden();
  await expect(app.page.locator("#hint")).toHaveText("Tap a hex to change it");
});

test("the hint disappears after the first selection and never returns", async ({ app }) => {
  await app.zoomIn();
  await app.tapHex(16, 26);
  await expect(app.page.locator("#hint")).toBeHidden();
  await app.done();
  await expect(app.page.locator("#hint")).toBeHidden();
  await app.page.reload(); await app.page.waitForFunction(() => window.__soc);
  await expect(app.page.locator("#hint")).toBeHidden();
});

test("one finger drags the map and never selects", async ({ app }) => {
  await app.zoomIn();
  const [x, y] = await app.at(16, 26);
  await app.page.mouse.move(x, y); await app.page.mouse.down();
  await app.page.mouse.move(x + 80, y + 40, { steps: 6 }); await app.page.mouse.up();
  expect((await app.state()).selection).toEqual([]);
  const [x2] = await app.at(16, 26);
  expect(x2).toBeGreaterThan(x + 40);
});

test("tapping another hex switches to it; tapping the selected hex closes it", async ({ app }) => {
  await app.zoomIn();
  await app.tapHex(16, 26);
  expect((await app.state()).selection).toEqual(["h16_26"]);
  await app.tapHex(20, 26);
  expect((await app.state()).selection).toEqual(["h20_26"]);
  await app.tapHex(20, 26);
  expect((await app.state()).selection).toEqual([]);
  await expect(app.sheet()).toBeHidden();
});

test("holding a hex adds it, and taps then add or remove until the selection is cleared", async ({ app }) => {
  await app.zoomIn();
  await app.tapHex(16, 26);
  await expect(app.sheet().locator(".sfoot .what")).toHaveText("Hold another hex to add it");
  await app.holdHex(18, 26);
  expect((await app.state()).selection.sort()).toEqual(["h16_26", "h18_26"]);
  await app.tapHex(20, 26);
  expect((await app.state()).selection).toHaveLength(3);
  await app.tapHex(20, 26);
  expect((await app.state()).selection).toHaveLength(2);
  await app.done();
  await app.tapHex(16, 26);
  expect((await app.state()).selection).toEqual(["h16_26"]);
});

test("the size stepper grows 1 → 7 → 19 and shrinks back the same way", async ({ app }) => {
  await app.zoomIn();
  await app.tapHex(16, 26);
  const grow = app.page.getByRole("button", { name: /^Grow the selection/ });
  const shrink = app.page.getByRole("button", { name: "Shrink the selection" });
  await expect(shrink).toBeDisabled();
  await grow.click(); expect((await app.state()).selection).toHaveLength(7);
  await grow.click(); expect((await app.state()).selection).toHaveLength(19);
  await expect(app.sheet().locator(".count")).toHaveText("19 hexes");
  await shrink.click(); expect((await app.state()).selection).toHaveLength(7);
  await shrink.click(); expect((await app.state()).selection).toEqual(["h16_26"]);
  await expect(shrink).toBeDisabled();
});

test("arrow keys, Enter and Space select from the keyboard", async ({ app }) => {
  await app.page.locator("#map").focus();
  await app.page.keyboard.press("Enter");
  const first = (await app.state()).selection;
  expect(first).toHaveLength(1);
  await app.page.keyboard.press("ArrowRight");
  await app.page.keyboard.press(" ");
  expect((await app.state()).selection).toHaveLength(2);
  await app.page.keyboard.press("Escape");
  expect((await app.state()).selection).toEqual([]);
});

test("Clear selection lets go of every selected hex at once", async ({ app }) => {
  await app.zoomIn();
  await app.tapHex(16, 26);
  await app.page.getByRole("button", { name: /^Grow the selection/ }).click();
  expect((await app.state()).selection).toHaveLength(7);
  await app.footer("Clear selection").click();
  expect((await app.state()).selection).toEqual([]);
  await expect(app.sheet()).toBeHidden();
});
