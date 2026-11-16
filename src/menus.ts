// Context menus, as data: lists of actions (see actions.ts), rows of small buttons, submenus,
// and the "Send to" submenu. Each action decides, from the menu's context (its pane, its tab),
// whether it shows (`visible`), its label (`label`, else its title), whether it is enabled
// (`enabled`), and what it does (`run`): a menu only says which actions, in what order.
//
// The view shows `PANE_MENU` and `TAB_MENU` unless the host gives its own (`ViewOptions.menus`):
// copy one and edit it, e.g. `[...TAB_MENU.slice(0, 4), { action: "myAction" }, ...]`.

import type { Args } from "./actions";

/** An action in a menu, as a binding names it: its id (or an alias) and its arguments. */
export interface MenuAction {
  action: string;
  args?: Args;
  /** Instead of the action's own label. */
  label?: string;
}

export type MenuItemSpec =
  | MenuAction
  /** A row of small buttons (e.g. arrows): each an action, with a short label (its title as tooltip). */
  | { row: (MenuAction & { label: string })[] }
  /** A submenu, shown on hover (left out when none of its items shows). */
  | { submenu: string; items: MenuItemSpec[] }
  /** The "Send to" submenu: the four sides, then the named panes (`sendTo` actions). */
  | { sendTo: string };

export type MenuSpec = MenuItemSpec[];

/** The four sides, as a row of arrows: `action` with `{ target: <side> }` (and `args`). */
export function arrowRow(action: string, args: Args = {}): { row: (MenuAction & { label: string })[] } {
  const glyphs = { left: "←", right: "→", up: "↑", down: "↓" };
  return { row: Object.entries(glyphs).map(([target, label]) => ({ action, args: { ...args, target }, label })) };
}

/** A pane's menu (right click on the pane's chrome, or its ⋯ button). */
export const PANE_MENU: MenuSpec = [
  // Everything new around this pane, what nav's `i` opens (it takes the focused cell: this
  // pane takes it first). The arrows: a cell beside it on that side; Tab: one more of them
  // in its own tabs; Float: one in a window of its own.
  {
    submenu: "New",
    items: [
      arrowRow("insert"),
      { action: "insert", args: { target: "tab" }, label: "Tab" },
      { action: "insert", args: { target: "float" }, label: "Float" },
    ],
  },
  { action: "float" },
  { action: "group" },
  { action: "collapse" },
  { action: "closePane" },
  { action: "toggleStick" },
  { action: "namePane" },
  { action: "removePaneName" },
  { sendTo: "Send to" },
];

/**
 * A tab's menu (right click on a tab, or on the strip a pane shows instead of its tab bar):
 * the tab's own things — a new tab in its pane, this tab out in a window, close it, rename
 * it, send it somewhere, collapse its group.
 */
export const TAB_MENU: MenuSpec = [
  { action: "insert", args: { target: "tab" }, label: "New tab" },
  { action: "float" },
  { action: "closeTab" },
  { action: "renameTab" },
  { sendTo: "Send to" },
  { action: "collapse" },
];
