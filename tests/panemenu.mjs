// Right-clicking a pane (its own header, not its content) opens the pane menu: the same one
// its ⋯ opens. Tabs keep the tab menu; content keeps its own (browser) menu.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
const pane = (name) => page.locator(".carreau-pane", { has: tab(name) });
const items = () => page.locator(".carreau-menu > button, .carreau-menu > .carreau-menu-sub > .carreau-menu-subtitle").allTextContents();
const dismiss = async () => {
  await page.mouse.click(4, 4);
  await page.waitForTimeout(50);
};
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

// The ⋯ menu of the main.ts pane, then its right-click menu: the same items.
await pane("main.ts").locator(".carreau-more").click();
const viaMore = await items();
await dismiss();
await pane("main.ts").locator(".carreau-tabspace").click({ button: "right" });
const viaRight = await items();
console.log("right-click menu:", viaRight.join(" · "));
console.log("same as ⋯:", JSON.stringify(viaMore) === JSON.stringify(viaRight));
await page.screenshot({ path: "/tmp/pane-right-click.png" });

// And it acts on that pane: Name pane….
await page.locator(".carreau-menu button", { hasText: "Name pane…" }).click();
await page.keyboard.type("code");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
console.log("named through it:", await pane("main.ts").locator(".carreau-pane-name").textContent());

// Right click a tab: still the tab's menu.
await dismiss();
await tab("main.ts").click({ button: "right" });
console.log("tab menu:", (await items()).join(" · "));

// Right click the pane's content: no menu (the content keeps its own).
await dismiss();
await pane("main.ts").locator(".carreau-content").first().click({ button: "right" });
await page.waitForTimeout(50);
console.log("no menu on content:", (await page.locator(".carreau-menu").count()) === 0);
await browser.close();
