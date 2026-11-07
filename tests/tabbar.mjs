// The collapsible tab bar (▾/▴): collapsed, the bar keeps its 2px — the tabs' top line, the
// active tab's highlight, at the pane's bottom edge — plus the ▴ in the corner, in the active
// tab's accent. The tabs stay in the DOM: the tab shortcuts keep working.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
const pane = page.locator(".carreau-pane", { has: tab("main.ts") });
const fold = pane.locator(".carreau-tabbar-fold");
const height = () => pane.locator(".carreau-tabbar").evaluate((b) => getComputedStyle(b).height);
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

console.log("a ▾ on the bar's left:", (await fold.textContent()) === "▾", (await height()) === "27px");
await fold.click();
console.log("collapsed to 2px:", (await height()) === "2px", (await fold.textContent()) === "");
console.log("tabs kept, 2px high:", (await pane.locator(".carreau-tab").count()) === 4, (await tab("main.ts").evaluate((t) => getComputedStyle(t).height)) === "2px");
const accent = await pane.evaluate((p) => {
  const s = document.createElement("span");
  s.style.color = "var(--focus-accent)";
  p.append(s);
  const c = getComputedStyle(s).color;
  s.remove();
  return c;
});
// The corner triangle: a wedge over the pane's bottom-left corner, in the active tab's accent.
console.log(
  "the corner wedge takes the active tab's accent:",
  (await fold.evaluate((f) => getComputedStyle(f).backgroundColor)) === accent,
  (await fold.evaluate((f) => getComputedStyle(f).clipPath.startsWith("polygon"))) === true,
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

// Back (the wedge's clip is its hit area: click inside the triangle, not its box's center).
await fold.click({ position: { x: 2, y: 12 } });
console.log("unfolded:", (await height()) === "27px", (await fold.textContent()) === "▾");
await browser.close();
