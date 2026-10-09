// The GitHub Pages setup: posts live in a Firebase Realtime Database, no accounts,
// a name typed once per device.
const { test, expect } = require("./support/fixtures");

test.beforeEach(async ({ app }) => { await app.open({ firebase: true }); await app.zoomIn(); });

const publish = async app => { await app.page.locator("#saveBtn").click(); };
const writes = app => app.page.evaluate(() => window.__fakeFirebase.writes);
const nameBox = app => app.page.locator("#playerName");

test("the first publish asks for a name, then sends the post", async ({ app }) => {
  await app.setLand(16, 26, "Forest"); await app.done();
  await publish(app);
  await expect(app.page.locator("#mTitle")).toHaveText("Who's posting?");
  expect(await writes(app)).toEqual([]);
  await nameBox(app).fill("Ash");
  await app.page.getByRole("button", { name: "Continue" }).click();
  await expect.poll(async () => (await writes(app)).length).toBe(1);
  const [w] = await writes(app);
  expect(w.body).toMatchObject({ name: "Ash", changes: { h16_26: { t: "forest" } } });
  expect(w.body.by).toMatch(/^d_/);
  expect(typeof w.body.at).toBe("number");     // stamped by the server, not the phone
  await expect(app.page.locator("#draftBar")).toBeHidden();
});

test("the name is remembered for the next post", async ({ app }) => {
  await app.page.evaluate(() => localStorage.setItem("soc-name", "Ash"));
  await app.setLand(16, 26, "Forest"); await app.done();
  await publish(app);
  await expect.poll(async () => (await writes(app)).length).toBe(1);
  await expect(app.page.locator("#modal")).toBeHidden();
});

test("names already used are offered as one-tap choices", async ({ app }) => {
  await app.page.evaluate(() => window.__fakeFirebase.add("p0001", { by: "d_other", name: "Rowan", changes: { h18_26: { t: "hills" } } }));
  await app.setLand(16, 26, "Forest"); await app.done();
  await publish(app);
  await app.page.locator("#mBody").getByRole("button", { name: "Rowan", exact: true }).click();
  await expect.poll(async () => (await writes(app)).map(w => w.body.name)).toEqual(["Rowan"]);
});

test("another player's post arrives live and leaves my draft alone", async ({ app }) => {
  await app.setLand(16, 26, "Forest"); await app.done();
  await app.page.evaluate(() => window.__fakeFirebase.add("p0001", { by: "d_other", name: "Rowan", changes: { h18_26: { t: "hills" } } }));
  await expect.poll(async () => (await app.view("h18_26") || {}).t).toBe("hills");
  expect((await app.state()).draft).toHaveProperty("h16_26");
  expect((await app.view("h16_26")).t).toBe("forest");
});

test("clearing a field survives the trip through Firebase", async ({ app }) => {
  // Firebase drops nulls and empty lists, so a clear must travel as something else
  await app.page.evaluate(() => {
    localStorage.setItem("soc-name", "Ash");
    window.__fakeFirebase.add("p0001", { by: "d_other", name: "Rowan", changes: { h16_26: { t: "forest", n: ["Deep"] } } });
  });
  await expect.poll(async () => (await app.view("h16_26") || {}).t).toBe("forest");
  await app.tapHex(16, 26);
  await app.row("Natures").click();
  await app.button("Deep").click();
  await app.button("‹ Back").click();
  await app.row("Land").click();
  await app.button("Clear land").click();
  await app.done();
  await publish(app);
  await expect.poll(async () => (await writes(app)).length).toBe(1);
  expect(await app.view("h16_26")).toBeNull();
});

test("a new land and a new people are shared inside the post", async ({ app }) => {
  await app.page.evaluate(() => localStorage.setItem("soc-name", "Ash"));
  await app.tapHex(16, 26);
  await app.button("New land…").click();
  await app.page.getByRole("button", { name: "Crosshatch", exact: true }).click();
  await app.page.fill("#landName", "Ice spires");
  await app.footer("Add land").click();
  await app.row("Settled by").click();
  await app.button("New people…").click();
  await app.page.fill("#otherName", "Goblins");
  await app.footer("Add").click();
  await app.done();
  await publish(app);
  await expect.poll(async () => (await writes(app)).length).toBe(1);
  const [w] = await writes(app);
  expect(Object.values(w.body.types)).toEqual([expect.objectContaining({ kind: "land", name: "Ice spires", pen: "cross" })]);
  expect(Object.values(w.body.peoples)).toEqual([expect.objectContaining({ name: "Goblins" })]);
});

test("another player's new land shows up for everyone", async ({ app }) => {
  await app.page.evaluate(() => window.__fakeFirebase.add("p0001", { by: "d_other", name: "Rowan",
    types: { abc: { kind: "land", name: "Salt flat", color: "#e3edf3", glyph: "dash" } }, changes: { h18_26: { t: "x-abc" } } }));
  await app.tapHex(20, 26);
  await expect(app.button("Salt flat")).toBeVisible();
  // made before pens existed: the old symbol picks the nearest pen
  expect(await app.page.evaluate(() => window.__soc.landInfo("x-abc").pen)).toBe("rows");
});

test("changing the age publishes a small post that shows in history", async ({ app }) => {
  await app.page.evaluate(() => localStorage.setItem("soc-name", "Ash"));
  await app.page.locator("#menuBtn").click();
  await app.page.locator("#mBody button.link", { hasText: /^Age/ }).click();
  await app.page.getByRole("button", { name: "Second Age" }).click();
  await expect.poll(async () => (await writes(app)).map(w => w.body.world)).toEqual([expect.objectContaining({ age: 2 })]);
  await expect(app.page.locator("#ageLabel")).toHaveText("Second Age · area 7");
  await app.page.locator("#menuBtn").click();
  await app.page.locator("#mBody button.link", { hasText: "History" }).click();
  await expect(app.page.locator("#mBody .keylist button.link").first()).toContainText("Ash (you)");
  await expect(app.page.locator("#mBody .keylist button.link").first()).toContainText("Second Age");
});

test("the menu lets a player change their name", async ({ app }) => {
  await app.page.locator("#menuBtn").click();
  await expect(app.page.locator("#mBody")).toContainText("Not set yet");
  await app.page.locator("#mBody button.link", { hasText: "Your name" }).click();
  await nameBox(app).fill("Ash");
  await app.page.getByRole("button", { name: "Save" }).click();
  expect(await app.page.evaluate(() => localStorage.getItem("soc-name"))).toBe("Ash");
});

test("a dropped connection says it is reconnecting", async ({ app }) => {
  await app.page.evaluate(() => window.__fakeFirebase.drop());
  await expect(app.page.locator("#toast")).toHaveText("Reconnecting to the map…");
});
