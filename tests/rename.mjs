import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5317/?example=IDE");
const tabs = () => page.evaluate(() => [...document.querySelectorAll(".carreau-root .carreau-tab")].map((t) => t.textContent).join(","));
// a round of navigation mode, then Alt up to leave it (an in-place field keeps the focus)
const nav = async (...keys) => {
  await page.keyboard.down("Alt");
  await page.keyboard.press("KeyQ");
  for (const k of keys) await page.keyboard.press(k);
  await page.keyboard.up("Alt");
  await page.waitForTimeout(100);
};
await page.locator(".carreau-tab", { hasText: /^Terminal$/ }).click();
await nav("KeyP", "KeyG");
// G: groups immediately, the new tab's title is being edited
const def = await page.locator(".carreau-tab-edit").inputValue();
console.log("G → editing", await page.locator(".carreau-tab-edit").count(), "default", JSON.stringify(def), "| group exists:", await page.locator(".carreau-tab.is-group").count());
await page.screenshot({ path: "/tmp/rename.png", clip: { x: 160, y: 760, width: 400, height: 40 } });
await page.keyboard.type("Zazz"); // replaces the selected default text
await page.keyboard.press("Enter");
console.log("typed Zazz, Enter:", await tabs());
// %: rename the selected tab (the selection is Zazz's holder)
await nav("Shift+Digit5");
await page.keyboard.type("Workspace");
await page.keyboard.press("Escape");
console.log("% then Esc (kept):", await tabs());
await nav("KeyC");
await nav("Shift+Digit5");
await page.keyboard.type("Shell");
await page.locator(".carreau-root .carreau-tab", { hasText: /^Files$/ }).click(); // blur confirms
console.log("% in Terminal, blur:", await tabs());
// undo: the renames, then the group
await page.locator(".carreau-root .carreau-tab", { hasText: /^Files$/ }).click();
for (let i = 0; i < 3; i++) {
  await nav("KeyZ");
  console.log("Z:", await tabs());
}
await browser.close();
