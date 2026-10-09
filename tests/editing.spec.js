// Land, rivers, natures and settled land.
const { test, expect } = require("./support/fixtures");

test.beforeEach(async ({ app }) => { await app.open(); await app.zoomIn(); });

test("the land list is the seven defaults in order, then New land", async ({ app }) => {
  await app.tapHex(16, 26);
  const names = await app.sheet().locator(".opts button.opt").allTextContents();
  expect(names.map(s => s.trim())).toEqual(["Desert", "Forest", "Hills", "Mountains", "Plains", "Water", "Wetland", "New land…"]);
});

test("a hex with no land opens straight to the land choices", async ({ app }) => {
  await app.tapHex(16, 26);
  await expect(app.heading()).toHaveText("Land");
});

test("a hex that has land opens its rows, not the land choices", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.done();
  await app.tapHex(16, 26);
  await expect(app.heading()).toHaveText("Selected");
  await expect(app.row("Land")).toContainText("Forest");
});

test("adding an empty hex to a landed one shows Mixed instead of jumping to land", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.done();
  await app.tapHex(16, 26);
  await app.holdHex(18, 26);
  await expect(app.heading()).toHaveText("Selected");
  await expect(app.row("Land")).toContainText("Mixed");
  await expect(app.row("Natures")).toBeDisabled();
  await expect(app.row("Natures")).toContainText("Needs land first");
});

test("rows show the current value and open their options", async ({ app }) => {
  await app.setLand(16, 26, "Hills");
  await expect(app.row("Land")).toContainText("Hills");
  await expect(app.row("Natures")).toContainText("None");
  await expect(app.row("Settled by")).toContainText("No one");
  await app.row("Natures").click();
  await expect(app.heading()).toHaveText("Natures");
});

test("river is only offered once a hex has land, and runs over it", async ({ app }) => {
  await app.tapHex(16, 26);
  await expect(app.button("Add river")).toHaveCount(0);
  await app.button("Water").click();
  await app.row("Land").click();
  await app.button("Add river").click();
  const h = await app.view("h16_26");
  expect(h.t).toBe("sea");
  expect(h.r).toBe(true);
});

test("natures are a checklist: tap to add several, the screen stays open", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.row("Natures").click();
  await app.button("Deep").click();
  await app.button("Wild").click();
  await expect(app.heading()).toHaveText("Natures");
  await expect(app.button("Deep")).toHaveAttribute("aria-pressed", "true");
  await expect(app.button("Burning")).toHaveAttribute("aria-pressed", "false");
  expect((await app.view("h16_26")).n).toEqual(["Deep", "Wild"]);
  await app.button("‹ Back").click();
  await expect(app.row("Natures")).toContainText("Deep, Wild");
});

test("tapping a checked nature removes it", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.row("Natures").click();
  await app.button("Deep").click();
  await app.button("Wild").click();
  await app.button("Deep").click();
  expect((await app.view("h16_26")).n).toEqual(["Wild"]);
  await expect(app.button("Deep")).toHaveAttribute("aria-pressed", "false");
});

test("with several hexes, a nature only some have shows as mixed and a tap gives it to all", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.row("Natures").click(); await app.button("Deep").click();
  await app.done();
  await app.setLand(18, 26, "Forest");
  await app.done();
  await app.tapHex(16, 26);
  await app.holdHex(18, 26);
  await app.row("Natures").click();
  await expect(app.button("Deep")).toHaveAttribute("aria-pressed", "mixed");
  await app.button("Deep").click();
  expect((await app.view("h18_26")).n).toEqual(["Deep"]);
  await expect(app.button("Deep")).toHaveAttribute("aria-pressed", "true");
  await app.button("Deep").click();
  expect((await app.view("h16_26")).n || []).toEqual([]);
  expect((await app.view("h18_26")).n || []).toEqual([]);
});

test("a new nature is added and checked", async ({ app }) => {
  await app.setLand(16, 26, "Forest");
  await app.row("Natures").click();
  await app.button("New nature…").click();
  await app.page.getByRole("button", { name: "Flake", exact: true }).click();
  await app.page.fill("#otherName", "Singing");
  await app.footer("Add").click();
  await expect(app.button("Singing")).toHaveAttribute("aria-pressed", "true");
  expect((await app.view("h16_26")).n).toEqual(["Singing"]);
  const defs = await app.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("soc-defs")).types));
  expect(defs).toEqual([{ kind: "nature", name: "Singing", glyph: "flake" }]);
});

test("a new land that would look just like another one says so", async ({ app }) => {
  await app.tapHex(16, 26);
  await app.button("New land…").click();
  await app.page.getByRole("button", { name: "Trees", exact: true }).click();
  await app.page.getByRole("button", { name: "Green", exact: true }).click();
  await expect(app.page.locator("#sheet .note[role=status]")).toHaveText(/Looks just like Forest/);
  await app.page.getByRole("button", { name: "Dots", exact: true }).click();
  await expect(app.page.locator("#sheet .note[role=status]")).toBeHidden();
});

test("choosing land applies to every selected hex", async ({ app }) => {
  await app.tapHex(16, 26);
  await app.page.getByRole("button", { name: /^Grow the selection/ }).click();
  await app.button("Desert").click();
  const st = await app.state();
  expect(st.selection).toHaveLength(7);
  for (const id of st.selection) expect((await app.view(id)).t).toBe("desert");
});

test("a new land takes a pen, a color and a name, keyboard last", async ({ app }) => {
  await app.tapHex(16, 26);
  await app.button("New land…").click();
  // the name field must not grab focus (and pop the keyboard) before the player gets to it
  expect(await app.page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe("landName");
  await app.page.getByRole("button", { name: "Crosshatch", exact: true }).click();
  await app.page.getByRole("button", { name: "Snow", exact: true }).click();
  await app.page.fill("#landName", "Ice spires");
  await app.footer("Add land").click();
  await expect.poll(async () => (await app.view("h16_26") || {}).t).toMatch(/^x-/);
  const h = await app.view("h16_26");
  const info = await app.page.evaluate(t => window.__soc.landInfo(t), h.t);
  expect(info).toMatchObject({ name: "Ice spires", pen: "cross", color: "#e3edf3" });
  // reusable on another hex
  await app.done();
  await app.tapHex(20, 26);
  await expect(app.button("Ice spires")).toBeVisible();
});

test("a new people settles the selected hexes", async ({ app }) => {
  await app.setLand(16, 26, "Plains");
  await app.row("Settled by").click();
  await app.button("New people…").click();
  await app.page.fill("#otherName", "Goblins");
  await app.footer("Add").click();
  await expect(app.row("Settled by")).toContainText("Goblins");
});
