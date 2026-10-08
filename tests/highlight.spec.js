// "Is there a way to filter the view by spaces you created/impacted?"
// Highlighting a player keeps every hex their posts ever changed bright and dims the rest.
const { test, expect } = require("./support/fixtures");

test.beforeEach(async ({ app }) => {
  await app.open({ mock: { userId: "u_me", names: { u_me: "Ash", u_other: "Rowan" } } });
  await app.page.evaluate(() => {
    window.__mockStore.put("posts/p0001", { by: "u_other", name: "Rowan", at: 1, changes: { h16_26: { t: "forest" }, h17_26: { t: "forest" } } });
    window.__mockStore.put("posts/p0002", { by: "u_me", at: 2, changes: { h16_26: { t: "desert" }, h18_28: { t: "hills" } } });
  });
  await expect.poll(async () => (await app.state()).posts.length).toBe(2);
});

const pick = async (app, label) => {
  await app.page.locator("#showBtn").click();
  await app.page.locator("#mBody button.link", { hasText: label }).click();
};
const highlighted = app => app.page.evaluate(() => window.__soc.highlight());

test("the picker lists every player with how many hexes they have changed, you first", async ({ app }) => {
  await expect(app.page.locator("#showLabel")).toHaveText("Show: Everyone");
  await app.page.locator("#showBtn").click();
  const rows = app.page.locator("#mBody .keylist button.link");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Everyone");
  await expect(rows.nth(1)).toContainText("Ash (you)");
  await expect(rows.nth(1)).toContainText("2 hexes");
  await expect(rows.nth(2)).toContainText("Rowan");
  await expect(rows.nth(2)).toContainText("2 hexes");
});

test("highlighting counts every hex a player ever touched, even if someone changed it since", async ({ app }) => {
  await pick(app, "Rowan");
  await expect(app.page.locator("#showLabel")).toHaveText("Rowan");
  await expect(app.page.locator("#showBtn")).toHaveAttribute("aria-label", "Highlighting Rowan. Change");
  // h16_26 is a desert now (Ash's later post) but Rowan still touched it
  expect((await highlighted(app)).sort()).toEqual(["h16_26", "h17_26"]);
});

test("✕ turns the highlight off", async ({ app }) => {
  await pick(app, "Ash (you)");
  expect((await highlighted(app)).sort()).toEqual(["h16_26", "h18_28"]);
  await app.page.getByRole("button", { name: "Stop highlighting" }).click();
  expect(await highlighted(app)).toBeNull();
  await expect(app.page.locator("#showLabel")).toHaveText("Show: Everyone");
  await expect(app.page.locator("#showOff")).toBeHidden();
});

test("a new post from that player joins the highlight live", async ({ app }) => {
  await pick(app, "Rowan");
  await app.page.evaluate(() => window.__mockStore.put("posts/p0003", { by: "u_other", name: "Rowan", at: 3, changes: { h20_26: { t: "plains" } } }));
  await expect.poll(async () => (await highlighted(app) || []).length).toBe(3);
});

test("editing still works while a highlight is on", async ({ app }) => {
  await pick(app, "Rowan");
  await app.zoomIn();
  await app.setLand(19, 28, "Water");
  expect((await app.view("h19_28")).t).toBe("sea");
});

test("the top controls fit on a phone", async ({ app }) => {
  await pick(app, "Ash (you)");
  const menu = await app.page.locator("#menuBtn").boundingBox();
  const show = await app.page.locator(".showbox").boundingBox();
  expect(menu.x + menu.width).toBeLessThan(show.x);
  expect(show.x + show.width).toBeLessThanOrEqual(390);
});
