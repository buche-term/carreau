import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const esc = (t) => t.replace(/[.]/g, "\\.");
const paneBox = (t) => page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: new RegExp(`^${esc(t)}$`) }) }).boundingBox();
const st = () => page.evaluate(() => { const d = window.view.drag; const t = d.active?.target; return `center=${d.inCenter} active=${t ? t.kind + ":" + (t.side ?? "") : "none"}`; });
const icons = () => page.evaluate(() => { const d = window.view.drag; const r = window.view.el.getBoundingClientRect(); return (d.zones?.centers ?? []).map((c) => ({ kind: c.kind, x: r.left + c.cx, y: r.top + c.cy })); });
const tabs = () => page.evaluate(() => [...document.querySelectorAll(".carreau-pane")].map((p) => [...p.querySelectorAll(".carreau-tab")].map((t) => t.textContent).join("+")).join(" | "));
await page.goto("http://localhost:5317/?example=IDE");
let t = await page.locator(".carreau-tab", { hasText: /^Search$/ }).boundingBox();
await page.mouse.move(t.x + 5, t.y + 5); await page.mouse.down();
await page.mouse.move(t.x + 60, t.y + 80, { steps: 5 });
const m = await paneBox("main.ts");
for (const [label, fx, fy] of [["left third", 0.15, 0.5], ["right third", 0.85, 0.5], ["top third", 0.5, 0.2], ["bottom third", 0.5, 0.9], ["corner nearer left", 0.05, 0.25], ["center off icon", 0.4, 0.45]]) {
  await page.mouse.move(m.x + m.width * fx, m.y + m.height * fy, { steps: 3 });
  console.log(label.padEnd(20), await st());
  if (label === "left third") await page.screenshot({ path: "/tmp/third.png" });
}
// The center icons, side by side: swap, then the tab icon (add to its tabs).
await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2, { steps: 3 });
for (const i of await icons()) {
  await page.mouse.move(i.x, i.y, { steps: 3 });
  console.log(("center " + i.kind).padEnd(20), await st());
  if (i.kind === "swap") await page.screenshot({ path: "/tmp/swap.png" });
}
const swapIcon = (await icons()).find((i) => i.kind === "swap");
await page.mouse.move(swapIcon.x, swapIcon.y, { steps: 3 }); // drop on the swap icon
await page.mouse.up();
console.log("after tab swap:  ", await tabs());
// pane swap: drag Terminal pane grip onto Files pane's center
const grip = page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: /^Terminal$/ }) }).locator(".carreau-tabspace");
const g = await grip.boundingBox();
const f = await paneBox("Files");
await page.mouse.move(g.x + 5, g.y + 5); await page.mouse.down();
await page.mouse.move(g.x + 50, g.y - 50, { steps: 5 });
await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2, { steps: 8 });
const swap2 = (await icons()).find((i) => i.kind === "swap");
await page.mouse.move(swap2.x, swap2.y, { steps: 4 });
console.log("pane over center:", await st());
await page.mouse.up();
console.log("after pane swap: ", await tabs());
await browser.close();
