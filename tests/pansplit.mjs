// The pane menu's New submenu (a cell beside the pane, a tab in it, a cell in a floating
// window — what nav's `i` does) and its Group item; and right click inside a floating window
// (the pane's chrome menu, not the window's own bar).
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const tab = (name) => page.locator(".carreau-tab", { has: page.locator(".carreau-tab-short", { hasText: new RegExp(`^${name}$`) }) });
// The IDE spawns cells of the focused pane's kind (so several panes/bars take a name): the
// one we act on is the last — clones sit left of it, and the float layer comes last.
const pane = (name) => page.locator(".carreau-pane", { has: tab(name) }).last();
// A pane's own bar (not a nested pane's): the bar holding that tab.
const bar = (name) => page.locator(".carreau-tabbar", { has: tab(name) }).last();
const items = () => page.locator(".carreau-menu > button, .carreau-menu > .carreau-menu-sub > .carreau-menu-subtitle").allTextContents();
const dismiss = async () => {
  await page.mouse.click(4, 4);
  await page.waitForTimeout(50);
};
const newSub = () => page.locator(".carreau-menu-sub").filter({ has: page.locator(".carreau-menu-subtitle", { hasText: /^New/ }) });
await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);

const n0 = await page.locator(".carreau-pane").count();
const box0 = await pane("main.ts").boundingBox();
await pane("main.ts").locator(".carreau-tabspace").click({ button: "right" });
const it = await items();
console.log("New and Group are in the menu:", it.includes("New  ▸"), it.includes("Group"));

// New → Tab: one more of the pane's own tabs.
const t0 = await bar("main.ts").locator(".carreau-tab-short").count();
await newSub().hover();
await page.waitForTimeout(120);
await newSub().locator(".carreau-submenu button", { hasText: /^Tab$/ }).click();
await page.waitForTimeout(150);
console.log("New → Tab:", (await bar("main.ts").locator(".carreau-tab-short").count()) === t0 + 1);

// New → ← : a new cell opens to the pane's left (the arrows: ← → ↑ ↓).
await pane("main.ts").locator(".carreau-tabspace").click({ button: "right" });
await newSub().hover();
await page.waitForTimeout(120);
await newSub().locator(".carreau-submenu .carreau-menu-arrow").first().click();
await page.waitForTimeout(150);
const box1 = await pane("main.ts").boundingBox();
console.log("New ← (split): a cell to the left:", (await page.locator(".carreau-pane").count()) === n0 + 1, box1.x > box0.x);

// Group: the pane groups (and the new group's title is typed in place). The holder pane —
// the one whose single tab is the group — is what collapses.
await pane("main.ts").locator(".carreau-tabspace").click({ button: "right" });
await page.locator(".carreau-menu button", { hasText: /^Group$/ }).click();
await page.waitForTimeout(150);
await page.keyboard.type("team");
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
await bar("team").locator(".carreau-tabspace").click({ button: "right" });
console.log("grouped (the menu knows: Collapse group):", (await items()).includes("Collapse group"));
await dismiss();

// New → Float: a new cell in a window of its own.
const f0 = await page.locator(".carreau-float").count();
await pane("main.ts").locator(".carreau-tabspace").click({ button: "right" });
await newSub().hover();
await page.waitForTimeout(120);
await newSub().locator(".carreau-submenu button", { hasText: /^Float$/ }).click();
await page.waitForTimeout(200);
console.log("New → Float:", (await page.locator(".carreau-float").count()) === f0 + 1);

// Float through the pane menu too; the floated pane's right-click menu still works, the
// window's own bar doesn't take it.
await pane("Terminal").locator(".carreau-tabspace").click({ button: "right" });
await page.locator(".carreau-menu > button", { hasText: /^Float$/ }).click();
await page.waitForTimeout(200);
console.log("floated pane:", (await page.locator(".carreau-float").count()) === f0 + 2);
await pane("Terminal").locator(".carreau-tabspace").click({ button: "right" });
console.log("right-click inside the float: the pane's menu:", (await page.locator(".carreau-menu").count()) === 1);
await dismiss();
await page.locator(".carreau-float-bar").last().click({ button: "right" });
await page.waitForTimeout(50);
console.log("no pane menu on the window's own bar:", (await page.locator(".carreau-menu").count()) === 0);
await browser.close();
