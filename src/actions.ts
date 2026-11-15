// Actions: what a key binding or a menu item runs, by reference.
//
// An action is identified by its id and its arguments (`{ id: "insert", args: { target:
// "left" } }`): a key and a menu item holding the same reference run the same thing. Each
// action has one definition (title, description, categories, parameters, `run`, `enabled`),
// kept in a registry. Old names (e.g. "insertLeft") are aliases of a reference.
//
// (No DOM at import time: hosts can load this without the view.)

import { find, findTab, panes } from "./model";
import type { LayoutNode, PaneNode, Side, Tab } from "./model";
import type { View } from "./view";
import type { Selection, Workspace } from "./workspace";

export type ArgValue = string | number | boolean;
export type Args = Record<string, ArgValue>;

/** What a binding or a menu item points at. */
export interface ActionRef {
  id: string;
  args?: Args;
}

export interface ParamSpec {
  /** Allowed values; absent: any value. */
  values?: readonly ArgValue[];
  /** Used when the argument is not given; absent: the argument is required. */
  default?: ArgValue;
}

export interface ActionDef<C> {
  id: string;
  /** Short, for menus: "Close tab". */
  title: string | ((args: Args) => string);
  /** A sentence, for the help pane and tooltips: "Close the focused tab; …". Absent: the title. */
  description?: string | ((args: Args) => string);
  categories: string[];
  params?: Record<string, ParamSpec>;
  /** Extra validation of resolved args: an error message, or null. */
  check?(args: Args): string | null;
  run(ctx: C, args: Args): void;
  enabled?(ctx: C, args: Args): boolean;
}

/** Action definitions, by id, and aliases (old names) of references. */
export class ActionRegistry<C> {
  private defs = new Map<string, ActionDef<C>>();
  private aliasMap = new Map<string, ActionRef>();

  /** Define an action. A duplicate id throws, unless `override`. */
  define(def: ActionDef<C>, options?: { override?: boolean }): void {
    if (this.defs.has(def.id) && !options?.override) throw new Error(`action "${def.id}" is already defined`);
    this.defs.set(def.id, def);
  }

  /** A name for a reference: "focusLeft" → { id: "focus", args: { target: "left" } }. */
  alias(name: string, ref: ActionRef): void {
    this.aliasMap.set(name, ref);
  }

  get(id: string): ActionDef<C> | undefined {
    return this.defs.get(id);
  }

  /** The definitions, in definition order. */
  list(): ActionDef<C>[] {
    return [...this.defs.values()];
  }

  aliases(): Record<string, ActionRef> {
    return Object.fromEntries(this.aliasMap);
  }

  /**
   * The canonical reference for a name (an id or an alias) and arguments: alias expanded
   * (explicit args win over the alias's), defaults filled in, values validated.
   * Throws an Error with a readable message: unknown action, unknown argument,
   * missing argument, value not allowed, or what `check` returned.
   */
  resolve(name: string, args?: Args): ActionRef {
    const alias = this.aliasMap.get(name);
    const id = alias ? alias.id : name;
    const given: Args = { ...alias?.args, ...args };
    const def = this.defs.get(id);
    if (!def) throw new Error(`unknown action "${name}"`);
    const params = def.params ?? {};
    for (const k of Object.keys(given)) if (!(k in params)) throw new Error(`${id}: unknown argument "${k}"`);
    const keys = Object.keys(params);
    if (!keys.length) return { id };
    const out: Args = {};
    for (const k of keys) {
      const spec = params[k];
      const v = k in given ? given[k] : spec.default;
      if (v === undefined) throw new Error(`${id}: missing argument "${k}"`);
      if (spec.values && !spec.values.includes(v)) throw new Error(`${id}: ${k}: expected one of ${spec.values.join(", ")}`);
      out[k] = v;
    }
    const err = def.check?.(out);
    if (err) throw new Error(`${id}: ${err}`);
    return { id, args: out };
  }

  /** A resolved reference's title. */
  title(ref: ActionRef): string {
    const def = this.defs.get(ref.id);
    if (!def) return ref.id;
    return typeof def.title === "function" ? def.title(ref.args ?? {}) : def.title;
  }

  /** A resolved reference's description (its title when the definition has none). */
  description(ref: ActionRef): string {
    const d = this.defs.get(ref.id)?.description;
    if (d === undefined) return this.title(ref);
    return typeof d === "function" ? d(ref.args ?? {}) : d;
  }

  /** Whether the action can run here (true when the definition says nothing). */
  enabled(ctx: C, ref: ActionRef): boolean {
    const def = this.defs.get(ref.id);
    return !def?.enabled || def.enabled(ctx, ref.args ?? {});
  }

  /** Run a resolved reference (nothing if the id is unknown). */
  run(ctx: C, ref: ActionRef): void {
    this.defs.get(ref.id)?.run(ctx, ref.args ?? {});
  }
}

/** A stable key for a *resolved* reference: "closeTab", "insert?into=false&target=left". */
export function refKey(ref: ActionRef): string {
  const keys = Object.keys(ref.args ?? {}).sort();
  if (!keys.length) return ref.id;
  return `${ref.id}?${keys.map((k) => `${k}=${ref.args![k]}`).join("&")}`;
}

// ---------------------------------------------------------------------------
// Carreau's actions

export interface CarreauActionContext {
  ws: Workspace;
  view: View;
  /** A context menu's pane: the action applies to it instead of the selection. */
  node?: string;
  /** A tab menu's tab. */
  tab?: string;
}

/** Carreau's layout actions (keys and menus run them; a host may wrap them in its own registry). */
export const carreauActions = new ActionRegistry<CarreauActionContext>();

type Dir = "left" | "right" | "up" | "down";
const DIR: readonly Dir[] = ["left", "right", "up", "down"];
const SIDE: Record<Dir, Side> = { left: "left", right: "right", up: "top", down: "bottom" };
const CAP: Record<Dir, string> = { left: "Left", right: "Right", up: "Up", down: "Down" };
/** Where a direction points, in a sentence: "to the left", "above". */
const where = (t: unknown): string => ({ left: "to the left", right: "to the right", up: "above", down: "below" })[t as Dir] ?? String(t);
/** Where a floating window goes when there's no cell to put it over. */
export const FALLBACK_FLOAT = { x: 40, y: 40, w: 420, h: 280 };

/** The node cell operations act on (see `Workspace.operand`). */
function operand(ws: Workspace): LayoutNode | null {
  const op = ws.operand();
  return op && !op.range ? ws.node(op.id) : null;
}

/** If a prompt is selected, a selection of its column. */
function promptColumnSelection(ws: Workspace): Selection | null {
  const sel = ws.selection;
  if (sel.range || ws.node(sel.id)?.type !== "prompt") return null;
  const col = ws.index().parent(sel.id);
  return col ? { id: col.id } : null;
}

/**
 * The pane the selection is in: a selected pane, else the pane holding it (a prompt: its
 * column's). Naming acts on it, not on the operand: what's named is what's selected, even
 * where cell operations are redirected (a prompt's go to the cell above it).
 */
function selectedPane(ws: Workspace): PaneNode | null {
  const sel = ws.selection;
  if (sel.range) return null;
  const idx = ws.index();
  let n: LayoutNode | null = idx.node(sel.id);
  while (n && n.type !== "pane") n = idx.parent(n.id);
  return n;
}

/** A tab menu's pane and tab. */
function menuTab(ctx: CarreauActionContext): { pane: PaneNode; tab: Tab } | null {
  if (ctx.tab === undefined) return null;
  const n = ctx.node !== undefined ? ctx.ws.node(ctx.node) : null;
  const pane = n?.type === "pane" ? n : ctx.ws.trees().map((t) => findTab(t, ctx.tab!)?.pane).find((p) => p);
  const tab = pane?.tabs.find((t) => t.id === ctx.tab);
  return pane && tab ? { pane, tab } : null;
}

const dirParam = { target: { values: DIR } };

/** An action that runs a workspace command, whatever the context. */
function command(id: string, title: string, description: string, categories: string[]): void {
  carreauActions.define({ id, title, description, categories, run: ({ ws }) => ws.run(id as never) });
}

/** A directional workspace command ("focusLeft"…), with its old names as aliases. */
function directional(id: string, title: (t: string) => string, description: (t: string) => string, categories: string[]): void {
  carreauActions.define({
    id,
    title: (a) => title(a.target as string),
    description: (a) => description(a.target as string),
    categories,
    params: dirParam,
    run: ({ ws }, a) => ws.run(`${id}${CAP[a.target as Dir]}` as never),
  });
  for (const d of DIR) carreauActions.alias(`${id}${CAP[d]}`, { id, args: { target: d } });
}

directional("focus", (t) => `Focus ${t}`, (t) => `Move the focus to the cell ${where(t)}`, ["focus"]);
directional("expand", (t) => `Extend the selection ${t}`, (t) => `Extend the selection to the cell ${where(t)}`, ["selection"]);
command("unexpand", "Shrink the selection", "Undo the last extension of the selection", ["selection", "advanced"]);
command("parent", "Select the parent", "Select the cell around the selection", ["selection", "advanced"]);
command("child", "Select the child", "Narrow the selection to the cell inside it that was focused last", ["selection", "advanced"]);
command("root", "Select everything", "Select the whole window (the main layout, or a floating window's)", ["selection"]);
directional("swap", (t) => `Swap with the cell ${t}`, (t) => `Swap the focused cell with its neighbour ${where(t)}`, ["layout"]);
command("nextTab", "Next tab", "Show the next tab of the innermost pane that has several", ["tabs"]);
command("prevTab", "Previous tab", "Show the previous tab of the innermost pane that has several", ["tabs"]);
command("undo", "Undo", "Undo the last layout change", ["history"]);
command("redo", "Redo", "Redo the last undone layout change", ["history"]);
command("maximize", "Maximize", "Make the selection take the whole window", ["layout"]);
command("restore", "Restore", "Undo the maximization", ["layout"]);

carreauActions.define({
  id: "toggleMaximize",
  title: "Maximize / restore",
  description: "Maximize the selection, or restore it if it is maximized",
  categories: ["layout"],
  run: ({ ws }) => ws.toggleMaximize(),
});

carreauActions.define({
  id: "float",
  title: "Float",
  description: "Move the cell out into a floating window",
  categories: ["layout", "windows"],
  run(ctx) {
    const { ws, view } = ctx;
    if (ctx.tab !== undefined) {
      const t = menuTab(ctx);
      if (t) view.floatTab(t.pane, t.tab);
      return;
    }
    if (ctx.node !== undefined) {
      view.floatPane(ctx.node);
      return;
    }
    const n = operand(ws);
    if (n?.type === "pane") view.floatPane(n.id);
  },
  enabled(ctx) {
    const { ws } = ctx;
    if (ctx.tab !== undefined) {
      const t = menuTab(ctx);
      // The tab's pane is in the main tree, and pulling the tab out doesn't empty it (all
      // of a lone pane's tabs float the pane itself, which the main tree cannot be).
      return !!t && !!find(ws.root, t.pane.id) && (t.pane.tabs.length > 1 || panes(ws.root).length > 1);
    }
    if (ctx.node !== undefined) return panes(ws.root).length > 1 && !!find(ws.root, ctx.node);
    return true;
  },
});

carreauActions.define({
  id: "group",
  title: "Group",
  description: "Put the selection in a new tab group, and name it",
  categories: ["layout"],
  run(ctx) {
    // Group now, then edit the new tab's title in place. From a prompt, it groups the
    // prompt's column, not the operand.
    if (ctx.node !== undefined) ctx.view.groupAndName({ id: ctx.node });
    else ctx.view.groupAndName(promptColumnSelection(ctx.ws) ?? undefined);
  },
});

carreauActions.define({
  id: "collapse",
  title: "Collapse group",
  description: "Replace a group's tab by the group's layout",
  categories: ["layout"],
  run: (ctx) => void (ctx.node !== undefined ? ctx.ws.collapse(ctx.node) : ctx.ws.collapse()),
  enabled: (ctx) => (ctx.node !== undefined ? ctx.ws.canCollapse(ctx.node) : true),
});

carreauActions.define({
  id: "closeTab",
  title: "Close tab",
  description: "Close the focused tab; its contents are asked to close first",
  categories: ["tabs", "close"],
  run(ctx) {
    const { ws } = ctx;
    if (ctx.tab !== undefined) {
      void ws.closeTab(ctx.tab);
      return;
    }
    const n = operand(ws);
    if (n?.type === "pane") {
      const tab = n.tabs[n.active];
      // (A pane with no tabs, which stays when emptied (named, kept): the pane itself.)
      if (tab) void ws.closeTab(tab.id);
      else void ws.closePane(n.id);
    }
  },
  enabled: (ctx) => (ctx.tab !== undefined ? ctx.ws.canCloseTab(ctx.tab) : true),
});

carreauActions.define({
  id: "forceCloseTab",
  title: "Close tab now",
  description: "Close the focused tab right away, without waiting for its contents to agree",
  categories: ["tabs", "close", "advanced"],
  run({ ws }) {
    const n = operand(ws);
    if (n?.type === "pane") {
      const tab = n.tabs[n.active];
      if (tab && (ws.isClosing(tab.id) || ws.canCloseTab(tab.id))) ws.forceClose(tab.id);
      else if (!tab) void ws.closePane(n.id);
    }
  },
});

carreauActions.define({
  id: "closePane",
  title: "Close pane",
  description: "Close the pane and all its tabs",
  categories: ["panes", "close"],
  run(ctx) {
    if (ctx.node !== undefined) {
      void ctx.ws.closePane(ctx.node);
      return;
    }
    const n = operand(ctx.ws);
    if (n) void ctx.ws.closePane(n.id);
  },
  enabled: (ctx) => (ctx.node !== undefined ? ctx.ws.canClosePane(ctx.node) : true),
});

carreauActions.define({
  id: "renameTab",
  title: "Rename tab…",
  description: "Edit the focused tab's title",
  categories: ["tabs"],
  run(ctx) {
    if (ctx.tab !== undefined) {
      ctx.view.editTabTitle(ctx.tab);
      return;
    }
    const p = selectedPane(ctx.ws);
    const tab = p?.tabs[p.active];
    if (tab) ctx.view.editTabTitle(tab.id);
  },
});

carreauActions.define({
  id: "namePane",
  title: "Name pane…",
  description: "Name the pane, so that things can be sent to it by name",
  categories: ["panes"],
  run(ctx) {
    if (ctx.node !== undefined) {
      ctx.view.editPaneName(ctx.node);
      return;
    }
    const p = selectedPane(ctx.ws);
    if (p) ctx.view.editPaneName(p.id);
  },
});

carreauActions.define({
  id: "removePaneName",
  title: "Remove name",
  description: "Remove the pane's name",
  categories: ["panes"],
  run(ctx) {
    const id = ctx.node ?? selectedPane(ctx.ws)?.id;
    if (id !== undefined) ctx.ws.namePane(id, null);
  },
});

carreauActions.define({
  id: "toggleStick",
  title: "Stick to the other end",
  description: "Make the scroll stream stick to its other end",
  categories: ["panes"],
  run(ctx) {
    const id = ctx.node ?? selectedPane(ctx.ws)?.id;
    const sc = id !== undefined ? ctx.ws.scrollOf(id) : null;
    if (sc) ctx.ws.toggleReverse(sc.id);
  },
});

carreauActions.define({
  id: "mark",
  title: "Mark",
  description: "Mark or unmark the focused cell, to move it later",
  categories: ["selection", "advanced"],
  run: ({ ws }) => ws.toggleMark(),
});

carreauActions.define({
  id: "moveMarked",
  title: "Move the marked cells here",
  description: "Move the marked cells into the focused one, in the order they were marked",
  categories: ["selection", "layout", "advanced"],
  run: ({ ws }) => void ws.moveMarked(),
});

carreauActions.define({
  id: "clear",
  title: "Clear finished cells",
  description: "Close the finished cells (done, standby, error) in the selection",
  categories: ["close"],
  run: ({ ws }) => void ws.clear(),
});

const RESIZE_WORD: Record<string, string> = { "width grow": "wider", "width shrink": "narrower", "height grow": "taller", "height shrink": "shorter" };
carreauActions.define({
  id: "resize",
  title: (a) => `${a.by === "grow" ? "Grow" : "Shrink"} ${a.axis}`,
  description: (a) => `Make the focused cell ${RESIZE_WORD[`${a.axis} ${a.by}`]}`,
  categories: ["layout", "advanced"],
  params: { axis: { values: ["width", "height"] }, by: { values: ["grow", "shrink"] } },
  run({ ws, view }, a) {
    const axis = a.axis === "width" ? "row" : "column";
    // (A cell's current size, when it has none of its own: measured.)
    ws.resizeFocus(axis, a.by === "grow" ? 1 : -1, (id) => {
      const r = view.pxRect(id);
      return r && (axis === "row" ? r.w : r.h);
    });
  },
});
for (const by of ["grow", "shrink"])
  for (const axis of ["width", "height"]) carreauActions.alias(`${by}${axis === "width" ? "Width" : "Height"}`, { id: "resize", args: { axis, by } });

const isDir = (t: unknown): t is Dir => DIR.includes(t as Dir);

carreauActions.define({
  id: "insert",
  title(a) {
    if (a.target === "tab") return "New tab";
    if (a.target === "float") return "New floating window";
    return a.into ? `New tab in the pane ${where(a.target)}` : `New cell ${where(a.target)}`;
  },
  description(a) {
    if (a.target === "tab") return "Open a new tab in the focused pane";
    if (a.target === "float") return "Open a new cell in a new floating window";
    return a.into
      ? `Open a new tab in the pane ${where(a.target)}, or in a new pane there if there is none`
      : `Open a new cell in a new pane ${where(a.target)}`;
  },
  categories: ["new"],
  params: { target: { values: ["tab", ...DIR, "float"], default: "tab" }, into: { values: [true, false], default: false } },
  check: (a) => (a.into && !isDir(a.target) ? "`into` needs a direction" : null),
  run(ctx, a) {
    const { ws, view } = ctx;
    const node = ctx.node;
    if (a.target === "tab") {
      // Into the focused cell's tabs (a split: its most recently focused pane's).
      if (node !== undefined) ws.spawnTabInto(node, ctx.tab);
      else ws.spawn({ split: "tab" });
      return;
    }
    if (a.target === "float") {
      if (node !== undefined) {
        ws.select({ id: node }, false);
        ws.spawnFloat(view.floatRect(node) ?? FALLBACK_FLOAT);
        return;
      }
      // Where the focused cell is (80% of it, centered), or near the workspace's corner.
      const n = operand(ws);
      const pane = n && (n.type === "pane" ? n.id : ws.descend(n));
      ws.spawnFloat((pane ? view.floatRect(pane) : null) ?? FALLBACK_FLOAT);
      return;
    }
    const dir = a.target as Dir;
    if (node !== undefined) ws.select({ id: node }, false);
    // Into a neighbour's tabs: if there is none on that side, where it would be.
    if (a.into) ws.spawn({ split: "tab", base: dir, force: true });
    else ws.spawn({ split: SIDE[dir] });
  },
});
carreauActions.alias("insertInto", { id: "insert", args: { target: "tab" } });
carreauActions.alias("insertFloat", { id: "insert", args: { target: "float" } });
for (const d of DIR) {
  carreauActions.alias(`insert${CAP[d]}`, { id: "insert", args: { target: d } });
  carreauActions.alias(`insertInto${CAP[d]}`, { id: "insert", args: { target: d, into: true } });
}

carreauActions.define({
  id: "move",
  title: (a) => (a.into ? `Move tab into the pane ${a.target}` : `Move tab ${a.target}`),
  description: (a) => (a.into ? `Move the focused tab into the pane ${where(a.target)}` : `Move the focused tab to a new pane ${where(a.target)}`),
  categories: ["tabs", "layout"],
  params: { ...dirParam, into: { values: [true, false], default: false } },
  run({ ws }, a) {
    const dir = a.target as Dir;
    ws.moveTab(a.into ? { split: "tab", base: dir, force: true } : { split: SIDE[dir] });
  },
});
for (const d of DIR) {
  carreauActions.alias(`move${CAP[d]}`, { id: "move", args: { target: d } });
  carreauActions.alias(`moveInto${CAP[d]}`, { id: "move", args: { target: d, into: true } });
}

carreauActions.define({
  id: "sendTo",
  title: (a) => `Send ${a.target}`,
  description: (a) => (isDir(a.target) ? `Send the tab or pane into the pane ${where(a.target)}` : `Send the tab or pane to the pane named ${a.target}`),
  categories: ["layout", "advanced"],
  params: { target: {} },
  run(ctx, a) {
    const id = ctx.tab ?? ctx.node ?? operand(ctx.ws)?.id;
    if (id !== undefined) ctx.ws.sendTo(id, String(a.target));
  },
  enabled(ctx, a) {
    const id = ctx.tab ?? ctx.node;
    return id !== undefined ? ctx.ws.canSendTo(id, String(a.target)) : true;
  },
});
