// The "Send to" submenu stays reachable: moving the pointer slowly (one step at a time, with
// pauses — slower than any mouse reports) used to hide it before the pointer got there: across
// the (now absent) gap, and diagonally across a neighbouring item on the way to its top.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
const bars = () => page.evaluate(() => [...document.querySelectorAll(".carreau-tabbar:not([hidden])")].map((b) => [...b.querySelectorAll(".carreau-tab-short")].map((x) => x.textContent).join(" ")).join(" | "));
const shown = () => page.locator(".carreau-submenu").evaluate((s) => getComputedStyle(s).display !== "none");
const centre = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
// Crawl from where the pointer is to `to`, in 1px-ish steps, pausing at each.
let pos = { x: 0, y: 0 };
const move = async (x, y) => {
  pos = { x, y };
  await page.mouse.move(x, y);
};
const crawl = async (to) => {
  for (let i = 1; i <= 24; i++) {
    await move(pos.x + ((to.x - pos.x) * i) / 24, pos.y + ((to.y - pos.y) * i) / 24);
    await page.waitForTimeout(20);
  }
};
const hoverAt = async (loc) => {
  const c = await centre(loc);
  await move(c.x, c.y);
};
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);
// Name the "Terminal" pane "logs", so the submenu has a target.
await page.locator(".carreau-pane", { has: tab("Terminal") }).locator(".carreau-more").click();
await page.locator(".carreau-menu button", { hasText: "Name pane…" }).click();
await page.locator(".carreau-pane-name-edit").fill("logs");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);

// Right click a tab: hover "Send to", then crawl to one of its submenu's entries.
await tab("model.ts").click({ button: "right" });
await hoverAt(page.locator(".carreau-menu-subtitle"));
console.log("open on hover:", await shown());
await crawl(await centre(page.locator(".carreau-submenu button", { hasText: "logs" })));
console.log("still open after a very slow crossing:", await shown());
await page.screenshot({ path: "/tmp/submenu-slow.png" });
await page.locator(".carreau-submenu button", { hasText: "logs" }).click();
await page.waitForTimeout(100);
console.log("model.ts sent to logs:", await bars());

// A slow crawl to the submenu's top row (the arrows): a diagonal crossing a neighbouring item.
await tab("view.ts").click({ button: "right" });
await hoverAt(page.locator(".carreau-menu-subtitle"));
await crawl(await centre(page.locator(".carreau-submenu button", { hasText: "←" })));
console.log("still open after a slow crawl to its top:", await shown());
await page.locator(".carreau-submenu button", { hasText: "←" }).click();
await page.waitForTimeout(100);
console.log("view.ts sent left:", await bars());

// Leaving for good does close it (the grace period is not forever).
await tab("main.ts").click({ button: "right" });
await hoverAt(page.locator(".carreau-menu-subtitle"));
console.log("open again:", await shown());
await move(20, 700);
await page.waitForTimeout(600);
console.log("closed after leaving:", !(await shown()));
await browser.close();
