// Actions: what a key binding or a menu item runs, by reference.
//
// An action is identified by its id and its arguments (`{ id: "insert", args: { target:
// "left" } }`): a key and a menu item holding the same reference run the same thing. Each
// action has one definition (title, description, categories, parameters, `run`, `enabled`),
// kept in a registry. Old names (e.g. "insertLeft") are aliases of a reference.
//
// (No DOM at import time: hosts can load this without the view.)

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
