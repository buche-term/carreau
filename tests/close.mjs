import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const layout = () => page.evaluate(() => {
  const show = (n) => (n.type === "pane" ? n.tabs.map((t) => t.title).join("+") : `${n.type}(${n.children.map(show).join(", ")})`);
  return `${show(window.ws.root)}${window.ws.floating.length ? " | floats: " + window.ws.floating.map((w) => show(w.root)).join(" ; ") : ""}`;
});
// Closing is asynchronous (the host's close() is awaited, even when instant).
const settle = () => page.waitForTimeout(80);
const closeOf = (t) => page.locator(".carreau-tab", { hasText: new RegExp(`^${t.replace(".", "\\.")}$`) }).locator(".carreau-tab-close");
await page.goto("http://localhost:5317/?example=IDE");
await page.screenshot({ path: "/tmp/close.png", clip: { x: 160, y: 560, width: 640, height: 40 } });
console.log("start:          ", await layout());
await closeOf("model.ts").click(); await settle();
console.log("close model.ts: ", await layout());
// The Outline pane's bar is folded (a lone unnamed tab): its × is on the pane's corner (see foldclose.mjs).
await page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: /^Outline$/ }) }).locator(":scope > .carreau-cell-close").click(); await settle();
console.log("close Outline:  ", await layout());
await page.locator(".carreau-tab", { hasText: /^Problems$/ }).click({ button: "middle" }); await settle();
console.log("middle Problems:", await layout());
// float Terminal, then close its only tab => window closes
const term = page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: /^Terminal$/ }) });
// Its bar folded with the lone tab (the ⋯ folds with it): click the wedge to bring it back.
await term.locator(":scope > .carreau-wedge").click(); await settle();
await term.locator(".carreau-more").click();
await page.locator(".carreau-menu > button", { hasText: /^Float$/ }).click();
console.log("floated:        ", await layout());
await closeOf("Terminal").click(); await settle();
console.log("close in window:", await layout());
// close everything down to the last tab
for (const t of ["Files", "Search"]) { await closeOf(t).click(); await settle(); }
// Git is alone, its bar folded: the pane's corner × closes it (and the pane with it).
await page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: /^Git$/ }) }).locator(":scope > .carreau-cell-close").click(); await settle();
for (const t of ["main.ts", "view.ts"]) { await closeOf(t).click(); await settle(); }
console.log("almost empty:   ", await layout(), "| close button on last tab:", await closeOf("README.md").count());
await browser.close();
