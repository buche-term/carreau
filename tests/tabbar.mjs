// The collapsible tab bar (▾): collapsed, the bar keeps its 2px — the tabs' top line, the
// active tab's highlight, at the pane's bottom edge — plus the pane's wedge in a bottom corner
// (bottom left, while the EXPERIMENT in view.ts/style.css lasts), in the active tab's accent
// (click: unfold; drag: move the pane). The fold is the pane's `fold` (an undo step). The tabs stay in
// the DOM: the tab shortcuts keep working. A single unnamed tab starts folded, and a tab
// joining unfolds it — until the user folds it themselves, which then sticks.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
const pane = page.locator(".carreau-pane", { has: tab("main.ts") });
const fold = pane.locator(".carreau-tabbar-fold");
const wedgeEl = pane.locator(":scope > .carreau-wedge");
const height = () => pane.locator(".carreau-tabbar").evaluate((b) => getComputedStyle(b).height);
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

console.log(
  "a ▾ at the bar's left end (the wedge's side):",
  (await fold.textContent()) === "▾",
  (await height()) === "27px",
  await fold.evaluate((f) => f.parentElement.firstElementChild === f),
);
await fold.click();
console.log("collapsed to 2px:", (await height()) === "2px", "▾ gone, wedge there:", (await fold.count()) === 0, (await wedgeEl.count()) === 1);
console.log("tabs kept, 2px high:", (await pane.locator(".carreau-tab").count()) === 4, (await tab("main.ts").evaluate((t) => getComputedStyle(t).height)) === "2px");
const accent = await pane.evaluate((p) => {
  const s = document.createElement("span");
  s.style.color = "var(--focus-accent)";
  p.append(s);
  const c = getComputedStyle(s).color;
  s.remove();
  return c;
});
// The corner triangle: a wedge over the pane's bottom-right corner, in the active tab's accent
// (painted by the pseudo-element: the button's own box, its hit area, stays an unclipped square).
console.log(
  "the corner wedge takes the active tab's accent:",
  (await wedgeEl.evaluate((f) => getComputedStyle(f, "::before").backgroundColor)) === accent,
  (await wedgeEl.evaluate((f) => getComputedStyle(f, "::before").clipPath.startsWith("polygon"))) === true,
  "unclipped box:",
  (await wedgeEl.evaluate((f) => getComputedStyle(f).clipPath)) === "none",
  "pointer cursor:",
  (await wedgeEl.evaluate((f) => getComputedStyle(f).cursor)) === "pointer",
  "in the corner:",
  await wedgeEl.evaluate((f) => {
    const r = f.getBoundingClientRect(), p = f.closest(".carreau-pane").getBoundingClientRect(); // (the pane's 1px border insets it)
    return (Math.abs(r.right - p.right) <= 1 || Math.abs(r.left - p.left) <= 1) && Math.abs(r.bottom - p.bottom) <= 1;
  }),
);
// The wedge drags the pane (a ghost follows the cursor; Escape cancels, leaving the layout be).
const wedge = await wedgeEl.boundingBox();
const grab = { x: wedge.x + wedge.width - 3, y: wedge.y + wedge.height - 3 }; // inside the wedge's box
await page.mouse.move(grab.x, grab.y);
await page.mouse.down();
await page.mouse.move(grab.x - 60, grab.y - 60, { steps: 6 });
const dragged = (await page.locator(".carreau-ghost").count()) === 1;
await page.keyboard.press("Escape");
await page.mouse.up();
console.log(
  "the wedge drags the pane:", dragged,
  "and the drag is not a click:", (await height()) === "2px",
  "(the ghost is gone:", (await page.locator(".carreau-ghost").count()) === 0, ")",
);
await page.screenshot({ path: "/tmp/pane-folded.png", clip: { x: 160, y: 30, width: 650, height: 620 } });

// The tab shortcuts still work: nextTab (Alt+Q Period) moves the highlight.
await tab("main.ts").click();
await page.keyboard.down("Alt");
await page.keyboard.press("KeyQ");
await page.keyboard.press("Period");
await page.keyboard.up("Alt");
await page.waitForTimeout(100);
console.log("nextTab while collapsed:", (await pane.locator(".carreau-tab.active .carreau-tab-short").textContent()) === "model.ts");

// Back (the hit area is the wedge's whole square box, not the painted triangle: this corner of
// it, over the content, unfolds all the same).
await wedgeEl.click({ position: { x: 14, y: 2 } });
console.log("unfolded:", (await height()) === "27px", (await fold.textContent()) === "▾");
// The fold is part of the layout: undo folds it back.
await page.evaluate(() => window.ws.undo());
console.log("undo folds it back:", (await height()) === "2px");
await page.evaluate(() => window.ws.redo());

// The automatic fold: a single unnamed tab starts folded, a tab joining unfolds it, but a fold
// the user clicked sticks (the Outline pane).
const outline = page.locator(".carreau-pane", { has: tab("Outline") });
const outlineHeight = () => outline.locator(".carreau-tabbar").evaluate((b) => getComputedStyle(b).height);
const spawnTab = () => outline.evaluate((p) => window.ws.spawnTabInto(p.dataset.id));
console.log("a single unnamed tab starts folded:", (await outlineHeight()) === "2px");
await spawnTab();
console.log("a tab joining unfolds it:", (await outlineHeight()) === "27px");
await outline.locator(".carreau-tabbar-fold").click(); // the user folds it (pinned)
await spawnTab();
console.log("the user's fold sticks, tabs notwithstanding:", (await outlineHeight()) === "2px");
await outline.locator(":scope > .carreau-wedge").click({ position: { x: 8, y: 12 } }); // and so does their unfold
console.log("…and so does their unfold:", (await outlineHeight()) === "27px");
// The automatic fold, unpinned, follows the pane: a reload, then a name is a reason for the
// bar (it unfolds), and taking the name away folds the single tab again.
await page.reload();
await page.waitForTimeout(200);
const name = (n) => outline.evaluate((p, v) => window.ws.namePane(p.dataset.id, v), n);
await name("Docs");
console.log("a name unfolds it too:", (await outlineHeight()) === "27px");
await name(null);
console.log("…un-naming folds it back:", (await outlineHeight()) === "2px");

// A group the user makes is not a stray single tab: a lone group tab keeps its bar (see
// barMode), where its name goes (and where it is typed). Escape cancels the grouping, as it does the name.
await outline.evaluate((p) => window.view.groupAndName({ id: p.dataset.id }));
await page.waitForTimeout(100);
const holder = page.locator(`.carreau-pane[data-id="${await page.evaluate(() => window.ws.selection.id)}"]`);
console.log(
  "a new group's bar starts open:",
  (await holder.locator(":scope > .carreau-tabbar").evaluate((b) => getComputedStyle(b).height)) === "27px",
  "the name being typed is readable:",
  (await page.locator(".carreau-tab-edit").count()) === 1,
);
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
console.log(
  "Escape takes the group back:",
  (await holder.count()) === 0,
  "the Outline pane is on its own, folded again:",
  (await outlineHeight()) === "2px",
);
await browser.close();
