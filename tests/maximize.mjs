// Maximization's way back: a corner badge, clickable while the view is maximized (double
// click a tab to maximize; the badge restores). It stays clickable over a window parked
// on its corner.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);
const view = page.locator(".carreau").first();
const badge = page.locator(".carreau-restore");
console.log("no badge, normally:", !(await badge.isVisible()));

// Maximize (double click the tab): the badge is up, in the view's top right corner, and it
// sits above a window covering that corner.
await tab("main.ts").dblclick();
await page.waitForTimeout(150);
const pane = (name) => page.locator(".carreau-pane", { has: tab(name) }).last();
const shown = await pane("main.ts").boundingBox();
const v = await view.boundingBox();
const b = await badge.boundingBox();
console.log(
  "maximized, badge up top right:",
  (await view.evaluate((e) => e.classList.contains("is-maximized"))) &&
    (await page.locator(".carreau-pane.max-hidden").count()) > 0 &&
    (await badge.isVisible()) &&
    shown.width > v.width * 0.9 &&
    b.y - v.y < 16 &&
    v.x + v.width - (b.x + b.width) < 16,
);

// Still clickable over a window parked on that corner.
await page.evaluate(([x]) => window.ws.spawnFloat({ x: x - 150, y: 0, w: 220, h: 180 }), [v.width]);
await page.waitForTimeout(150);
const [bx, by] = [b.x + b.width / 2 - v.x, b.y + b.height / 2 - v.y];
const overWin = await page.evaluate(
  ([x, y]) => document.elementFromPoint(x, y)?.classList.contains("carreau-restore") === true,
  [v.x + bx, v.y + by],
);
console.log("badge is above a window on its corner:", overWin);

// Click it: restored.
await badge.click();
await page.waitForTimeout(150);
console.log(
  "click restores:",
  !(await view.evaluate((e) => e.classList.contains("is-maximized"))) &&
    (await page.locator(".carreau-pane.max-hidden").count()) === 0 &&
    !(await badge.isVisible()),
);
await browser.close();
