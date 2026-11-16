// Bar modes (see barMode, ensureExpanded): editing a folded pane's tab title or name holds its bar
// full, a mark holds a folded bar full for its badge, a drag resting on a cell's wedge shows its
// hidden bar until the drag ends, and the wedge's click is a pinned fold (PaneNode.fold) that undoes.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(300);
const outline = page.locator(".carreau-pane", { has: page.locator(".carreau-tab-short", { hasText: /^Outline$/ }) });
let P;
const h = () => P.locator(":scope > .carreau-tabbar").evaluate((b) => getComputedStyle(b).height);
P = page.locator(`.carreau-pane[data-id="${await outline.evaluate((p) => p.dataset.id)}"]`);
console.log("outline folded:", await h());
const tid = await outline.evaluate((p) => window.ws.node(p.dataset.id).tabs[0].id);
await page.evaluate((t) => window.view.editTabTitle(t), tid);
console.log("renaming: bar", await h(), "field visible:", await page.locator(".carreau-tab-edit").isVisible());
await page.locator(".carreau-tab-edit").fill("Doc");
await page.keyboard.press("Enter");
await page.waitForTimeout(50);
console.log("renamed:", await P.locator(".carreau-tab-short").textContent(), "bar back:", await h());
const pid = await P.evaluate((p) => p.dataset.id);
await page.evaluate((id) => window.view.editPaneName(id), pid);
console.log("naming: bar", await h(), "field visible:", await page.locator(".carreau-pane-name-edit").isVisible());
await page.keyboard.press("Escape");
await page.waitForTimeout(50);
console.log("name cancelled: bar", await h());
// marks
await page.evaluate((id) => window.ws.toggleMark({ id }), pid);
await page.waitForTimeout(50);
console.log("marked: bar", await h(), "badge:", await P.locator("[data-mark]").count());
await page.evaluate((id) => window.ws.toggleMark({ id }), pid);
await page.waitForTimeout(50);
console.log("unmarked: bar", await h(), "badge:", await P.locator("[data-mark]").count());
// a cell: wedge dwell during a tab drag
await page.goto("http://localhost:5317/?example=Notebook");
await page.waitForTimeout(300);
const cell = page.locator(".carreau-scroll > .carreau-pane").first();
const cid = await cell.evaluate((p) => p.dataset.id);
const C = page.locator(`.carreau-pane[data-id="${cid}"]`);
const hidden = () => C.locator(":scope > .carreau-tabbar").evaluate((b) => b.hidden);
console.log("cell bar hidden:", await hidden(), "wedge:", await C.locator(":scope > .carreau-wedge").count());
const w = await C.locator(":scope > .carreau-wedge").boundingBox();
const t = await page.locator(".carreau-tab", { hasText: /build/ }).first().boundingBox();
await page.mouse.move(t.x + 10, t.y + 8); await page.mouse.down();
await page.mouse.move(w.x + w.width * 0.3, w.y + w.height * 0.7, { steps: 6 });
await page.mouse.move(w.x + w.width * 0.35, w.y + w.height * 0.75);
await page.waitForTimeout(500);
console.log("dwell: cell bar hidden:", await hidden());
const last = await C.locator(".carreau-tab").last().boundingBox();
await page.mouse.move(last.x + last.width + 3, last.y + last.height / 2, { steps: 4 });
await page.waitForTimeout(50);
await page.mouse.up();
await page.waitForTimeout(100);
console.log("dropped:", await page.evaluate((id) => window.ws.node(id).tabs.map((t) => t.title).join("+"), cid), "bar hidden:", await hidden());
await page.evaluate(() => window.ws.undo());
await page.waitForTimeout(100);
console.log("undo: bar hidden:", await hidden());
// click the cell wedge: full bar, pinned; undo
const w2 = await C.locator(":scope > .carreau-wedge").boundingBox();
await page.mouse.click(w2.x + w2.width * 0.25, w2.y + w2.height * 0.8);
await page.waitForTimeout(100);
console.log("wedge click: bar hidden:", await hidden(), "fold:", await page.evaluate((id) => window.ws.node(id).fold, cid));
await page.evaluate(() => window.ws.undo());
await page.waitForTimeout(100);
console.log("undo: bar hidden:", await hidden(), "fold:", await page.evaluate((id) => window.ws.node(id).fold, cid));
await browser.close();
