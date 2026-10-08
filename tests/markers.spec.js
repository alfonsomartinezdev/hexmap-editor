// Markers: plain symbols, two taps to place, optional label afterwards.
const { test, expect } = require("./support/fixtures");

test.beforeEach(async ({ app }) => { await app.open(); await app.zoomIn(); await app.setLand(16, 26, "Forest"); });

const SHAPES = ["Dot", "Star", "Square", "Diamond", "Triangle", "Ring", "Cross", "Crescent", "Flag"];

test("markers are offered only when a single hex is selected, and the slot stays empty otherwise", async ({ app }) => {
  await expect(app.row("Markers")).toBeVisible();
  await app.holdHex(18, 26);
  await expect(app.row("Markers")).toHaveCount(0);
  await expect(app.sheet().locator(".rowgap")).toHaveCount(1);
});

test("the picker shows the nine symbols without names", async ({ app }) => {
  await app.row("Markers").click();
  for (const s of SHAPES) await expect(app.page.getByRole("button", { name: s, exact: true })).toBeVisible();
  const text = (await app.sheet().locator('[aria-label="New marker"]').innerText()).trim();
  expect(text).toBe("");
});

test("placing is two taps: a symbol, then a color", async ({ app }) => {
  await app.row("Markers").click();
  await app.page.getByRole("button", { name: "Square", exact: true }).click();
  await app.page.getByRole("button", { name: "Crimson square" }).click();
  expect((await app.view("h16_26")).m).toEqual([expect.objectContaining({ k: "army", color: "#c8323c" })]);
  // stays on the markers screen so the optional label is right there
  await expect(app.heading()).toHaveText("Markers");
  await expect(app.page.getByRole("button", { name: /^Add a label/ })).toBeVisible();
});

test("the color step fits on a phone: small preview, colors on screen, no Done", async ({ app }) => {
  // regression: on iPhone the preview drew full width and pushed the colors off screen
  await app.row("Markers").click();
  await app.page.getByRole("button", { name: "Star", exact: true }).click();
  const icons = app.sheet().locator("canvas");
  for (const box of await icons.evaluateAll(els => els.map(e => e.getBoundingClientRect().width))) expect(box).toBeLessThanOrEqual(64);
  const last = await app.page.getByRole("button", { name: "Bone star" }).boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(760);
  await expect(app.footer("Done")).toHaveCount(0);
  await app.footer("Cancel").click();
  await expect(app.page.getByRole("button", { name: "Star", exact: true })).toBeVisible();
});

test("a label is optional, added afterwards, and undoable", async ({ app }) => {
  await app.row("Markers").click();
  await app.page.getByRole("button", { name: "Dot", exact: true }).click();
  await app.page.getByRole("button", { name: "Gold dot" }).click();
  await app.page.getByRole("button", { name: /^Add a label/ }).click();
  await app.page.fill("#mkLabel", "Vgd");
  await app.footer("Save label").click();
  expect((await app.view("h16_26")).m[0].label).toBe("Vgd");
  await app.footer("Undo").click();
  expect((await app.view("h16_26")).m[0].label).toBeUndefined();
});

test("Same again places a matching marker in one tap", async ({ app }) => {
  await app.row("Markers").click();
  await app.page.getByRole("button", { name: "Flag", exact: true }).click();
  await app.page.getByRole("button", { name: "Teal flag" }).click();
  await app.page.getByRole("button", { name: "Add Teal flag" }).click();
  expect((await app.view("h16_26")).m).toHaveLength(2);
});

test("a marker can be moved to another hex, even one without land, and removed there", async ({ app }) => {
  // regression: a marker moved onto a hex with no land could not be reached to remove it
  await app.row("Markers").click();
  await app.page.getByRole("button", { name: "Ring", exact: true }).click();
  await app.page.getByRole("button", { name: "Sky ring" }).click();
  await app.button("Move").click();
  await expect(app.sheet()).toContainText("Tap the hex to move");
  await app.tapHex(18, 26);
  expect((await app.view("h16_26")).m || []).toHaveLength(0);
  expect((await app.view("h18_26")).m).toHaveLength(1);
  await app.row("Markers").click();
  await app.button("Remove").click();
  expect((await app.view("h18_26") || {}).m || []).toHaveLength(0);
});
