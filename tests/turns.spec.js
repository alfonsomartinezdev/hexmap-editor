// Turns: a new turn opens every Monday (Pacific time); numbering starts again with each age.
// Show filters by who and by turn, highlighting on today's map.
const { test, expect } = require("./support/fixtures");

// Mon 5 Oct 2026, Mon 12 Oct, Mon 19 Oct (Pacific); "now" is Wed 21 Oct
const at = s => new Date(s).getTime();
const W1 = at("2026-10-05T10:00:00-07:00"), W1SUN = at("2026-10-11T23:30:00-07:00"), W2 = at("2026-10-12T00:30:00-07:00"), W3 = at("2026-10-19T09:00:00-07:00");

test.beforeEach(async ({ app }) => {
  await app.page.clock.setFixedTime(new Date("2026-10-21T12:00:00-07:00"));
  await app.open({ mock: { userId: "u_me", names: { u_me: "Ash", u_other: "Rowan" } } });
  await app.page.evaluate(([W1, W1SUN, W2, W3]) => {
    window.__mockStore.put("posts/p1", { by: "u_other", name: "Rowan", at: W1, changes: { h10_10: { t: "forest" } } });
    window.__mockStore.put("posts/p2", { by: "u_me", at: W1SUN, changes: { h11_10: { t: "forest" } } });       // Sunday night: still turn 1
    window.__mockStore.put("posts/p3", { by: "u_other", name: "Rowan", at: W2, changes: { h12_10: { t: "sea" } } }); // just after midnight Monday: turn 2
    window.__mockStore.put("posts/p4", { by: "u_me", at: W3, changes: { h13_10: { t: "hills" }, h14_10: { t: "hills" } } });
  }, [W1, W1SUN, W2, W3]);
  await expect.poll(async () => (await app.state()).posts.length).toBe(4);
});

const pick = async (app, list, label) => {
  await app.page.locator("#showBtn").click();
  await app.page.locator(`#mBody .keylist.${list} button.link`, { hasText: label }).first().click();
};
const highlighted = app => app.page.evaluate(() => (window.__soc.highlight() || []).sort());

test("the age label shows the current turn", async ({ app }) => {
  await expect(app.page.locator("#ageLabel")).toHaveText("First Age · turn 3 · area 19");
});

test("When lists this turn, last turn and older turns, newest first", async ({ app }) => {
  await app.page.locator("#showBtn").click();
  const rows = app.page.locator("#mBody .keylist.when button.link strong");
  await expect(rows).toHaveText(["All time", "This turn", "Last turn", "Turn 1"]);
});

test("a turn highlights everything published in that week, Monday to Sunday night", async ({ app }) => {
  await pick(app, "when", "Turn 1");
  expect(await highlighted(app)).toEqual(["h10_10", "h11_10"]);
  await expect(app.page.locator("#showLabel")).toHaveText("Everyone · Turn 1");
  await pick(app, "when", "Last turn");
  expect(await highlighted(app)).toEqual(["h12_10"]);
});

test("who and when combine", async ({ app }) => {
  await pick(app, "who", "Ash (you)");
  expect(await highlighted(app)).toEqual(["h11_10", "h13_10", "h14_10"]);
  await pick(app, "when", "This turn");
  expect(await highlighted(app)).toEqual(["h13_10", "h14_10"]);
  await expect(app.page.locator("#showLabel")).toHaveText("Ash (you) · This turn");
  await app.page.getByRole("button", { name: "Stop highlighting" }).click();
  expect(await app.page.evaluate(() => window.__soc.highlight())).toBeNull();
});

test("a new age starts the turns again at 1", async ({ app }) => {
  await app.page.evaluate(W => window.__mockStore.put("posts/p5", { by: "u_me", at: W + 3600e3, changes: {}, world: { age: 2 } }), W2);
  await expect(app.page.locator("#ageLabel")).toHaveText("Second Age · turn 2 · area 7");
  await app.page.locator("#showBtn").click();
  await expect(app.page.locator("#mBody .keylist.when button.link strong")).toHaveText(["All time", "This turn", "Last turn", "First Age · Turn 2", "First Age · Turn 1"]);
});
