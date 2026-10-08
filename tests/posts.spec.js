// Drafts, undo, start over, publishing, history and other players.
const { test, expect } = require("./support/fixtures");

test.describe("drafts", () => {
  test.beforeEach(async ({ app }) => { await app.open(); await app.zoomIn(); });

  test("while hexes are selected the bottom offers Done, not Publish", async ({ app }) => {
    await app.setLand(16, 26, "Forest");
    await expect(app.page.locator("#draftBar")).toBeHidden();
    await expect(app.footer("Done")).toBeVisible();
    await app.done();
    const bar = app.page.locator("#draftBar");
    await expect(bar).toContainText("1 hex changed · not published yet");
    for (const name of ["Undo", "Start over", "Publish post"]) await expect(bar.getByRole("button", { name, exact: true })).toBeVisible();
  });

  test("undo steps back one change at a time", async ({ app }) => {
    await app.setLand(16, 26, "Forest");
    await app.row("Land").click(); await app.button("Desert").click();
    await app.footer("Undo").click();
    expect((await app.view("h16_26")).t).toBe("forest");
    await app.footer("Undo").click();
    expect(await app.view("h16_26")).toBeNull();
  });

  test("start over asks first, then clears the whole draft", async ({ app }) => {
    await app.setLand(16, 26, "Forest"); await app.done();
    await app.setLand(18, 26, "Hills"); await app.done();
    const bar = app.page.locator("#draftBar");
    await bar.getByRole("button", { name: "Start over" }).click();
    await expect(bar).toContainText("Start over? This clears your 2 changes.");
    await bar.getByRole("button", { name: "Keep" }).click();
    expect(Object.keys((await app.state()).draft)).toHaveLength(2);
    await bar.getByRole("button", { name: "Start over" }).click();
    await bar.getByRole("button", { name: "Start over" }).click();
    expect((await app.state()).draft).toEqual({});
    await expect(bar).toBeHidden();
  });

  test("a draft survives a reload on the same device", async ({ app }) => {
    await app.setLand(16, 26, "Forest"); await app.done();
    await app.page.reload(); await app.page.waitForFunction(() => window.__soc);
    expect((await app.state()).draft).toHaveProperty("h16_26");
  });
});

test.describe("publishing", () => {
  test.beforeEach(async ({ app }) => { await app.open({ mock: { userId: "u_me" } }); await app.zoomIn(); });

  test("publishing saves one post under the player's id and empties the draft", async ({ app }) => {
    await app.setLand(16, 26, "Forest"); await app.done();
    await app.page.locator("#saveBtn").click();
    await expect(app.page.locator("#draftBar")).toBeHidden();
    const store = await app.page.evaluate(() => window.__mockStore.all());
    const posts = Object.entries(store).filter(([k]) => k.startsWith("posts/"));
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toMatchObject({ by: "u_me", changes: { h16_26: { t: "forest" } } });
    expect((await app.state()).base).toHaveProperty("h16_26");
  });

  test("another player's post appears live", async ({ app }) => {
    await app.page.evaluate(() => window.__mockStore.put("posts/p0001", { by: "u_other", at: Date.now(), changes: { h18_26: { t: "hills" } } }));
    await expect.poll(async () => (await app.view("h18_26") || {}).t).toBe("hills");
  });

  test("when two posts touch one hex, the later wins field by field", async ({ app }) => {
    await app.page.evaluate(() => {
      window.__mockStore.put("posts/p0001", { by: "u_other", at: 1, changes: { h18_26: { t: "hills", n: ["Deep"] } } });
      window.__mockStore.put("posts/p0002", { by: "u_me", at: 2, changes: { h18_26: { t: "forest" } } });
    });
    await expect.poll(async () => await app.view("h18_26")).toEqual({ t: "forest", n: ["Deep"] });
  });

  test("history lists posts newest first and shows the map after one", async ({ app }) => {
    await app.page.evaluate(() => {
      window.__mockStore.put("posts/p0001", { by: "u_other", at: 1, changes: { h16_26: { t: "hills" } } });
      window.__mockStore.put("posts/p0002", { by: "u_me", at: 2, changes: { h16_26: { t: "forest" } } });
    });
    await app.page.locator("#menuBtn").click();
    await app.page.locator("#mBody button.link", { hasText: "History" }).click();
    const items = app.page.locator("#mBody .keylist button.link");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Ash (you)");
    await expect(items.nth(1)).toContainText("Rowan");
    await items.nth(1).click();
    await expect(app.page.locator("#histBanner")).toContainText("After Rowan's post");
    expect((await app.view("h16_26")).t).toBe("hills");
    // history is view-only
    await app.tapHex(16, 26);
    await expect(app.sheet()).toBeHidden();
    await app.page.getByRole("button", { name: "Back to now" }).click();
    expect((await app.view("h16_26")).t).toBe("forest");
  });

  test("changing the age is shared", async ({ app }) => {
    await app.page.locator("#menuBtn").click();
    await app.page.locator("#mBody button.link", { hasText: /^Age/ }).click();
    await app.page.getByRole("button", { name: "Second Age" }).click();
    await expect(app.page.locator("#ageLabel")).toHaveText("Second Age · area 7");
    // the age travels as a small post, so history shows when the world moved on
    await expect.poll(() => app.page.evaluate(() => Object.entries(window.__mockStore.all()).filter(([k]) => k.startsWith("posts/")).map(([, v]) => v.world))).toEqual([expect.objectContaining({ age: 2 })]);
  });
});

test("a view-only player cannot open edit controls", async ({ app }) => {
  await app.open({ mock: { canWrite: false } });
  await app.zoomIn();
  await app.page.waitForTimeout(100);
  await app.tapHex(16, 26);
  await expect(app.heading()).toHaveText("Selected");
  await expect(app.row("Land")).toBeDisabled();
  await expect(app.sheet()).toContainText("You can view this map but not change it.");
});
