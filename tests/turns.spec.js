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

const open = app => app.page.locator("#showBtn").click();
const who = (app, label) => app.page.locator("#mBody .chips.who .chip", { hasText: label }).click();
const turnLabel = app => app.page.locator("#mBody .turnlabel strong");
const earlier = app => app.page.getByRole("button", { name: "Earlier turn" }).click();
const highlighted = app => app.page.evaluate(() => (window.__soc.highlight() || []).sort());

test("the turn stepper starts on this turn and steps back through older turns", async ({ app }) => {
  await open(app);
  await expect(turnLabel(app)).toHaveText("This turn");
  await earlier(app); await expect(turnLabel(app)).toHaveText("Last turn");
  await earlier(app); await expect(turnLabel(app)).toHaveText("Turn 1");
  await expect(app.page.getByRole("button", { name: "Earlier turn" })).toBeDisabled();
});

test("stepping to a turn highlights everything published that week, Monday to Sunday night", async ({ app }) => {
  await open(app);
  await earlier(app); await earlier(app);
  expect(await highlighted(app)).toEqual(["h10_10", "h11_10"]);
  await expect(app.page.locator("#showLabel")).toHaveText("Everyone · Turn 1");
  await app.page.getByRole("button", { name: "Later turn" }).click();
  expect(await highlighted(app)).toEqual(["h12_10"]);
});

test("who and when combine in one visit, and All time turns the turn off", async ({ app }) => {
  await open(app);
  await who(app, "Ash (you)");
  expect(await highlighted(app)).toEqual(["h11_10", "h13_10", "h14_10"]);
  await app.page.locator("#mBody .turnlabel").click();                 // pick "This turn"
  expect(await highlighted(app)).toEqual(["h13_10", "h14_10"]);
  await expect(app.page.locator("#showLabel")).toHaveText("Ash (you) · This turn");
  await app.page.locator("#mBody .chip", { hasText: "All time" }).click();
  expect(await highlighted(app)).toEqual(["h11_10", "h13_10", "h14_10"]);
  await app.page.locator("#mClose").click();
  await app.page.getByRole("button", { name: "Stop highlighting" }).click();
  expect(await app.page.evaluate(() => window.__soc.highlight())).toBeNull();
});

test("a new age starts the turns again at 1, and the stepper crosses into the old age", async ({ app }) => {
  await app.page.evaluate(W => window.__mockStore.put("posts/p5", { by: "u_me", at: W + 3600e3, changes: {}, world: { age: 2 } }), W2);
  await expect(app.page.locator("#ageLabel")).toHaveText("Second Age · area 7");
  await open(app);
  await earlier(app); await expect(turnLabel(app)).toHaveText("Last turn");
  await earlier(app); await expect(turnLabel(app)).toHaveText("First Age · Turn 2");
});

test("a finished age doesn't add an empty turn for the week the next age began", async ({ app }) => {
  await app.page.evaluate(W => window.__mockStore.put("posts/p5", { by: "u_me", at: W + 3600e3, changes: {}, world: { age: 2 } }), W3);
  await open(app);
  await earlier(app); await expect(turnLabel(app)).toHaveText("First Age · Turn 3");
});

test("a hex says who last changed it; tapping that shows their work that turn", async ({ app }) => {
  await app.page.evaluate(W => window.__mockStore.put("posts/p6", { by: "u_other", name: "Rowan", at: W + 7200e3, changes: { h16_26: { t: "sea" } } }), W2);
  await app.zoomIn();
  await app.tapHex(16, 26);
  await expect(app.page.locator(".lastby")).toContainText("Last changed by Rowan · Last turn");
  await app.page.locator(".lastby").click();
  expect(await highlighted(app)).toEqual(["h12_10", "h16_26"]);
});
