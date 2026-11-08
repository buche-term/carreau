// The tab menu (right click on a tab): the tab's own things — a new tab (of the clicked
// tab's kind, just after it), float this tab out on its own, close, rename, send it off.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
const bar = (name) => page.locator(".carreau-tabbar", { has: tab(name) }).last(); // README.md stays in the main tree
const items = () => page.locator(".carreau-menu > button, .carreau-menu > .carreau-menu-sub > .carreau-menu-subtitle").allTextContents();
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

// The menu, right on the tab: New tab, Float, Close tab, Rename tab…, Send to.
await tab("main.ts").click({ button: "right" });
const it = await items();
console.log(
  "the tab menu:",
  JSON.stringify(it) === JSON.stringify(["New tab", "Float", "Close tab", "Rename tab…", "Send to  ▸"]),
);

// New tab: a fresh tab spawned from the CLICKED tab (not the active one), just after it.
const t0 = await bar("README.md").locator(".carreau-tab-short").allTextContents();
await tab("main.ts").click({ button: "right" });
await page.locator(".carreau-menu > button", { hasText: /^New tab$/ }).click();
await page.waitForTimeout(150);
const t1 = await bar("README.md").locator(".carreau-tab-short").allTextContents();
const clone = t1[1]; // the file tab's spawn (an Untitled text tab), landed at index 1
console.log(
  "New tab: spawned from the clicked tab, right after it:",
  t1.length === t0.length + 1 && !!clone && clone !== "main.ts" && t1[0] === "main.ts" && t1.slice(2).join() === t0.slice(1).join(),
);

// Float: this tab alone goes to a window of its own; its pane keeps the rest.
const f0 = await page.locator(".carreau-float").count();
await bar("README.md").locator(".carreau-tab").nth(1).click({ button: "right" });
await page.locator(".carreau-menu > button", { hasText: /^Float$/ }).click();
await page.waitForTimeout(200);
const floater = page.locator(".carreau-float").last();
console.log(
  "Float: the tab, alone, in a window:",
  (await page.locator(".carreau-float").count()) === f0 + 1 &&
    (await floater.locator(".carreau-tab-short").allTextContents()).join() === clone &&
    (await bar("README.md").locator(".carreau-tab-short").count()) === t0.length,
);

// Rename tab…: the title edited in place.
await page.reload();
await page.waitForTimeout(200);
await tab("main.ts").click({ button: "right" });
await page.locator(".carreau-menu > button", { hasText: /^Rename tab…$/ }).click();
await page.waitForTimeout(100);
await page.keyboard.type("app.ts");
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
console.log("Rename tab…:", (await tab("app.ts").count()) === 1 && (await tab("main.ts").count()) === 0);

// Close tab: it goes.
await tab("app.ts").click({ button: "right" });
await page.locator(".carreau-menu > button", { hasText: /^Close tab$/ }).click();
await page.waitForTimeout(200);
console.log("Close tab:", (await tab("app.ts").count()) === 0 && (await bar("README.md").locator(".carreau-tab-short").count()) === 3);
await browser.close();
