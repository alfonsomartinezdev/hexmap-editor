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
    await expect(bar).toContainText(/\d+ hex(es)? changed, not published/);
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
    await expect(bar).toContainText("Start over? This clears your changes.");
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

test.describe("powers first", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ mock: { userId: "u_me" } });
    await app.page.locator("#menuBtn").click();
    await app.page.getByRole("switch", { name: "Powers (try it)" }).click();
    await app.page.locator("#mClose").click();
    await app.zoomIn();
  });
  const bar = app => app.page.locator("#draftBar");
  const usePower = async (app, power) => { await bar(app).getByRole("button", { name: "Use a power" }).click(); await app.page.locator("#mBody").getByRole("button", { name: power, exact: true }).click(); };

  test("tapping a hex only shows it", async ({ app }) => {
    await expect(bar(app).getByRole("button", { name: "Edit freely" })).toBeVisible();
    await app.tapHex(16, 26);
    await expect(app.page.locator("#sheet")).toContainText("To change it, use a power or Edit freely.");
    await expect(app.row("Land")).toBeDisabled();
  });

  test("a power paints hexes as one step, and the steps go out with the post", async ({ app }) => {
    await usePower(app, "Shape Land");
    await app.button("Forest").click();
    await app.tapHex(16, 26); await app.tapHex(17, 26); await app.tapHex(18, 26);
    await expect(app.page.locator("#sheet")).toContainText("3 of 19");
    await app.tapHex(18, 26);                                          // a second tap takes it off again
    expect(await app.view("h18_26")).toBeNull();
    await app.footer("Done").click();
    await expect(bar(app)).toContainText("Shape LandStep 1 of 1");
    await usePower(app, "Shape Climate");                   // natures come from a picker, not a long strip
    await app.page.locator("#mBody").getByRole("button", { name: "Deep", exact: true }).click();
    await app.tapHex(16, 26);
    expect((await app.view("h16_26")).n).toEqual(["Deep"]);
    await app.footer("Done").click();
    await expect(bar(app)).toContainText("Shape ClimateStep 2 of 2");
    // going back to step 1 still shows everything
    await bar(app).getByRole("button", { name: "Previous step" }).click();
    await expect(bar(app)).toContainText("Shape LandStep 1 of 2");
    expect((await app.view("h16_26")).n).toEqual(["Deep"]);
    // carry on with step 1: add a hex to it, and Undo only takes back what's in that step
    await bar(app).getByRole("button", { name: "Edit step" }).click();
    await app.button("Forest").click(); await app.tapHex(18, 26);
    await app.footer("Done").click();
    expect((await app.view("h18_26")).t).toBe("forest");
    await bar(app).getByRole("button", { name: "Undo" }).click();
    expect(await app.view("h18_26")).toBeNull();
    expect((await app.view("h17_26")).t).toBe("forest");
    await bar(app).getByRole("button", { name: "Next step" }).click();
    await app.page.locator("#saveBtn").click();
    await expect.poll(() => app.page.evaluate(() => Object.entries(window.__mockStore.all()).filter(([k]) => k.startsWith("posts/")).map(([, v]) => v.steps))).toEqual([[
      { power: "Shape Land", hexes: ["h16_26", "h17_26"] }, { power: "Shape Climate", hexes: ["h16_26"] }]]);
  });

  test("create an ancestry, then settle next to it", async ({ app }) => {
    await usePower(app, "Shape Land"); await app.button("Plains").click();
    for (const c of [14, 15, 16, 17, 18]) await app.tapHex(c, 26);
    await app.footer("Done").click();
    await usePower(app, "Create Ancestry");
    await app.page.locator("#otherName").fill("Elves");
    await app.page.locator("#mBody").getByRole("button", { name: "Next" }).click();
    await expect(app.page.locator("#sheet")).toContainText("Tap where the Elves begin");
    await app.tapHex(14, 26);                              // one tap spreads over the connected plains
    await expect(app.page.locator("#sheet")).toContainText("5 of 19");
    await app.tapHex(17, 26); await app.tapHex(18, 26);     // then hexes can be taken off (or added)
    expect((await app.view("h18_26")).p).toBeUndefined();
    await app.footer("Done").click();
    await expect(app.page.locator("#mTitle")).toHaveText("Legends of the Elves?");
    await app.page.locator("#mBody").getByRole("button", { name: "Skip" }).click();
    await usePower(app, "Settle");                          // the only people is picked already
    await expect(app.page.locator("#sheet")).toContainText("Tap a hex next to them");
    await app.tapHex(17, 26);                              // spreads over the plains they don't live in yet
    expect((await app.view("h17_26")).p).toBe((await app.view("h15_26")).p);
    expect((await app.view("h18_26")).p).toBe((await app.view("h15_26")).p);
    await expect(app.page.locator("#sheet")).toContainText("2 of 19");
    await app.footer("Done").click();
    await expect(bar(app)).toContainText("SettleStep 3 of 3");
  });

  test("found a city, raise an army there, march it, build, and place a legend", async ({ app }) => {
    const name = async v => { await app.page.locator("#thingName").fill(v); await app.page.locator("#mBody").getByRole("button", { name: "Place" }).click(); };
    const things = async id => ((await app.view(id)) || {}).m || [];
    await usePower(app, "Shape Land"); await app.button("Plains").click();
    for (const c of [14, 15, 16, 17]) await app.tapHex(c, 26);
    await app.footer("Done").click();
    await usePower(app, "Create Ancestry");
    await app.page.locator("#otherName").fill("Elves"); await app.page.locator("#mBody").getByRole("button", { name: "Next" }).click();
    await app.tapHex(14, 26); await app.footer("Done").click();
    await app.page.locator("#mBody").getByRole("button", { name: "Add a legend" }).click();   // a legend arises for each player who paid
    await app.page.locator("#alignedTo").fill("Ash"); await name("The First Mother");
    await app.page.locator("#mBody").getByRole("button", { name: "Done" }).click();
    expect(Object.values(await app.page.evaluate(() => window.__soc.state().draft)).flatMap(p => p.m || [])).toEqual([expect.objectContaining({ k: "legend", label: "The First Mother", aligned: "Ash" })]);
    await usePower(app, "Found City");
    await expect(app.page.locator("#sheet")).toContainText("Tap a hex for the city");
    await app.tapHex(15, 26); await name("Vgd");
    expect(await things("h15_26")).toContainEqual(expect.objectContaining({ k: "city", label: "Vgd" }));
    await expect(bar(app)).toContainText("Found City");
    await usePower(app, "Raise Army"); await app.tapHex(15, 26); await name("The Host");
    await usePower(app, "March Army"); await app.tapHex(15, 26);
    await expect(app.page.locator("#sheet")).toContainText("Tap where The Host marches");
    await app.tapHex(17, 26);
    expect((await things("h17_26")).map(m => m.label)).toEqual(["The Host"]);
    expect((await things("h15_26")).map(m => m.label)).toEqual(["The First Mother", "Vgd"]);
    await usePower(app, "Build"); await app.tapHex(16, 26);
    await expect(app.page.locator("#mBody")).toContainText("Built by");
    await name("The Long Wall");
    expect(await things("h16_26")).toEqual([expect.objectContaining({ k: "built", label: "The Long Wall", of: (await things("h15_26")).find(m => m.k === "city").id })]);
    await usePower(app, "Create Legend"); await app.tapHex(14, 26); await name("The Grey Company");
    await expect(bar(app)).toContainText("Create Legend · The Grey CompanyStep 7 of 7");
    await expect(bar(app)).toContainText("The Grey Company");
    // Catastrophe: the army is crossed out, not removed
    await usePower(app, "Catastrophe"); await app.button("Destroy").click();
    await app.tapHex(17, 26);
    expect((await things("h17_26"))[0]).toMatchObject({ label: "The Host", x: true });
    await app.button("Wipe land").click(); await app.tapHex(16, 26);
    expect((await app.view("h16_26")).t).toBeUndefined();
    await app.footer("Done").click();
    // Exalt: one place, or the whole land form
    await usePower(app, "Exalt"); await app.page.locator("#mBody").getByRole("button", { name: "Whole land form" }).click();
    await app.tapHex(14, 26); await name("The Long Meadow");
    expect((await app.view("h14_26")).w).toBe("The Long Meadow");
    expect((await app.view("h15_26")).w).toBe("The Long Meadow");
    await usePower(app, "Exalt"); await app.page.locator("#mBody").getByRole("button", { name: "One hex" }).click();
    await app.tapHex(17, 26); await name("The World Tree");
    expect((await things("h17_26")).map(m => m.k)).toEqual(["army", "wonder"]);
  });

  test("a new people never placed is dropped when you leave", async ({ app }) => {
    await usePower(app, "Create Ancestry");
    await app.page.locator("#otherName").fill("Ghosts");
    await app.page.locator("#mBody").getByRole("button", { name: "Next" }).click();
    await app.footer("Done").click();
    expect(await app.page.evaluate(() => JSON.parse(localStorage.getItem("soc-defs")).peoples)).toEqual({});
  });

  test("edit freely is today's full editing", async ({ app }) => {
    await bar(app).getByRole("button", { name: "Edit freely" }).click();
    await app.setLand(16, 26, "Hills"); await app.done();
    expect((await app.view("h16_26")).t).toBe("hills");
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
    await expect(app.page.locator("#ageLabel")).toHaveText("Second Age · ×7");
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

test("if land arrives after the Land list opened by itself, the sheet goes back to the overview", async ({ app }) => {
  await app.open({ mock: { userId: "u_me", names: { u_me: "Ash" } } });
  await app.zoomIn();
  await app.tapHex(16, 26);
  await expect(app.heading()).toHaveText("Land");
  await app.page.evaluate(() => window.__mockStore.put("posts/p0001", { by: "u_other", name: "Rowan", at: 1, changes: { h16_26: { t: "forest" } } }));
  await expect(app.heading()).toHaveText("Selected");
  await expect(app.row("Land")).toContainText("Forest");
});


test("Clear map in the claude.ai copy starts a new map collection", async ({ app }) => {
  await app.open({ mock: { userId: "u_me", names: { u_me: "Ash" } } });
  await app.page.evaluate(() => window.__mockStore.put("posts/p0001", { by: "u_other", name: "Rowan", at: 1, changes: { h16_26: { t: "forest" } } }));
  await expect.poll(async () => (await app.view("h16_26") || {}).t).toBe("forest");
  await app.page.locator("#menuBtn").click();
  await app.page.locator("#mBody button.link", { hasText: /^Clear map/ }).click();
  await app.page.getByRole("button", { name: "Continue" }).click();
  await app.page.getByRole("button", { name: "Clear the map" }).click();
  await expect.poll(() => app.view("h16_26")).toBeNull();
  const map = await app.page.evaluate(() => window.__mockStore.all()["world/current"].map);
  expect(map).toMatch(/^m/);
  await expect.poll(async () => (await app.state()).posts.length).toBe(1);
});
