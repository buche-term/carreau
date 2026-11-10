// Dragging a tab (or a pane) onto a collapsed tab bar's corner wedge: resting there a moment
// unfolds the bar, so the drag can then drop into it. Passing over it quickly doesn't, and a
// pane dragged by its own wedge doesn't unfold its own bar.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5317/?example=" + encodeURIComponent("Single pane"));
await page.waitForTimeout(200);
// pa: a single unnamed tab (folded); pc: two tabs (unfolded), C is dragged.
const load = (pa = "pa") =>
  page.evaluate((pa) => {
    const tab = (t) => ({ id: "t" + t, title: t, content: t });
    window.ws.load({ floating: [], root: { type: "row", id: "r", weight: 1, children: [
      { type: "pane", id: pa, weight: 1, active: 0, tabs: [tab("A")] },
      { type: "pane", id: "pc", weight: 1, active: 0, tabs: [tab("C"), tab("D")] },
    ] } });
  }, pa);
await load();
await page.waitForTimeout(200);
const folded = (id) => page.evaluate((id) => document.querySelector(`[data-id="${id}"] > .carreau-tabbar`).classList.contains("collapsed"), id);
const wedge = async (id) => (await page.locator(`[data-id="${id}"] > .carreau-tabbar > .carreau-tabbar-fold`).boundingBox());
console.log("pa folded at first:", await folded("pa"));
let w = await wedge("pa");
const c = await page.locator(".carreau-tab[data-tab=tC]").boundingBox();
await page.mouse.move(c.x + 10, c.y + 8); await page.mouse.down();
await page.mouse.move(c.x - 100, c.y - 100, { steps: 4 });
// A quick pass over the wedge: no unfold.
await page.mouse.move(w.x + 10, w.y + 12, { steps: 2 });
await page.mouse.move(w.x - 150, w.y - 150, { steps: 2 });
await page.waitForTimeout(300);
console.log("quick pass, still folded:", await folded("pa"));
// Resting on it (with a little motion inside): unfolds. Meanwhile, the wedge has priority over
// every other drop (here, it sits on the line between pa and pc): nothing is offered, or drawn.
await page.mouse.move(w.x + 10, w.y + 12, { steps: 3 });
await page.mouse.move(w.x + 14, w.y + 14);
console.log(
  "on the wedge, no drop offered:",
  await page.evaluate(() => window.view.dnd.state.active === null && window.view.overlay.childElementCount === 0),
);
await page.waitForTimeout(300);
console.log("rest, unfolded:", !(await folded("pa")));
// Into the bar now: the gap after A.
const a = await page.locator(".carreau-tab[data-tab=tA]").boundingBox();
await page.mouse.move(a.x + a.width + 2, a.y + a.height / 2, { steps: 4 });
await page.waitForTimeout(50);
await page.mouse.up();
await page.waitForTimeout(100);
console.log("dropped into pa:", JSON.stringify(await page.evaluate(() => window.ws.node("pa").tabs.map((t) => t.title))), "(expected [A,C])");

// A pane dragged by its own wedge: its bar stays folded. (A fresh id: the fold sticks by id.)
await load("pb");
await page.waitForTimeout(200);
console.log("pb folded at first:", await folded("pb"));
w = await wedge("pb");
await page.mouse.move(w.x + 12, w.y + 13); await page.mouse.down();
await page.mouse.move(w.x + 4, w.y + 6, { steps: 3 });
await page.mouse.move(w.x + 12, w.y + 13, { steps: 3 });
await page.waitForTimeout(300);
console.log("own wedge, still folded:", await folded("pb"));
await page.keyboard.press("Escape");
await page.mouse.up();

// Released on a wedge before it unfolds: no drop at all.
await load("pd");
await page.waitForTimeout(200);
const before = await page.evaluate(() => JSON.stringify(window.ws.tree()));
w = await wedge("pd");
const c2 = await page.locator(".carreau-tab[data-tab=tC]").boundingBox();
await page.mouse.move(c2.x + 10, c2.y + 8); await page.mouse.down();
await page.mouse.move(w.x + 14, w.y + 14, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(100);
console.log("released on the wedge, nothing moved:", before === (await page.evaluate(() => JSON.stringify(window.ws.tree()))), "still folded:", await folded("pd"));
await browser.close();
