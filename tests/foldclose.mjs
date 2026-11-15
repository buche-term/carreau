// A folded tab bar shows a × at the pane's top right, which closes the pane (a cell always
// has one); with the bar open, the × stays on the tabs and no corner one shows.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const panes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".carreau-pane")]
      .map((p) => {
        const bar = p.querySelector(":scope > .carreau-tabbar");
        const state = bar?.classList.contains("collapsed") ? "folded" : bar?.hidden ? "hidden" : "open";
        const x = !!p.querySelector(":scope > .carreau-cell-close");
        const t = [...p.querySelectorAll(":scope > .carreau-tabbar .carreau-tab")].map((t) => t.querySelector(".carreau-tab-short")?.textContent).join("+");
        return `${t}[${state}]${x ? " ×" : ""}`;
      })
      .join(" | "),
  );
const clickClose = (tabText) =>
  page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: new RegExp(`^${tabText}$`) }) }).locator(":scope > .carreau-cell-close").click();

await page.goto("http://localhost:5317/?example=IDE");
await page.waitForTimeout(200);
console.log("IDE:", await panes(), "  (only the folded Outline has a corner ×)");
await clickClose("Outline");
await page.waitForTimeout(150);
console.log("Outline closed by its corner ×:", await panes());
// Fold the Files pane (3 tabs): the corner × appears, the tabs' × fold away; the × closes the pane.
await page.locator(".carreau-pane", { has: page.locator(".carreau-tab", { hasText: /^Files$/ }) }).locator(".carreau-tabbar-fold").click();
await page.waitForTimeout(150);
console.log("Files folded:", await panes());
await clickClose("Files");
await page.waitForTimeout(150);
console.log("Files (3 tabs) closed by its corner ×:", await panes());

// The last pane folds, but shows no corner ×: it cannot be closed.
await page.goto("http://localhost:5317/?example=Single%20pane");
await page.waitForTimeout(200);
console.log("single pane:", await panes());
await page.evaluate(() => {
  window.ws.load({ floating: [], root: { type: "row", id: "r", weight: 1, children: [
    { type: "pane", id: "pa", weight: 1, active: 0, tabs: [{ id: "ta", title: "A", content: "A" }] },
    { type: "pane", id: "pb", weight: 1, active: 0, tabs: [{ id: "tb", title: "B", content: "B" }] },
  ] } });
});
await page.waitForTimeout(200);
console.log("two folded panes:", await panes());
await clickClose("A");
await page.waitForTimeout(150);
console.log("last pane (folded, no corner ×):", await panes());

// Cells: their corner × is there whether the bar shows or not.
await page.goto("http://localhost:5317/?example=Notebook");
await page.waitForTimeout(300);
console.log("notebook:", await panes());
await browser.close();
