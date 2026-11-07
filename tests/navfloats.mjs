// Navigation mode across windows: left/right at a window's edge goes into the next one (the
// main window, then the floating windows by x, cycling).
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const inFloat = () =>
  page.evaluate(() => !!document.querySelector(".selected")?.closest(".carreau-float"));
const floats = () => page.locator(".carreau-float").count();
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

await tab("main.ts").click();
await page.keyboard.down("Alt");
await page.keyboard.press("KeyQ"); // navigation mode
await page.keyboard.press("KeyF"); // …float the focused pane
await page.waitForTimeout(150);
console.log("the pane became a floating window:", (await floats()) === 1, (await inFloat()) === true);

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);
console.log("right, at the float's edge, crosses to the main window:", (await inFloat()) === false);

// And back: keep going right, through the main window; at its edge, the float takes us again.
let back = false;
for (let i = 0; i < 14 && !back; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(50);
  back = await inFloat();
}
console.log("right, at the main window's edge, comes back to the float:", back);

// Up and down stay within the window: from the float, up doesn't leave it.
await tab("main.ts").click();
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(100);
console.log("up doesn't cross:", (await inFloat()) === true);
await page.keyboard.up("Alt");
await browser.close();
