// Navigation mode: its state, and running actions in it.
//
// While in navigation mode, the selection shows, multi-selections and marks live, and the
// keyboard focus is out of the cells; leaving it commits the focus to the selected cell.
// Carreau binds no keys: the host listens for them, sets the mode (`setMode`) and runs actions
// (`run`, or `carreauActions` directly). The demo has a key handler of its own (demo/keys.ts).

import { ActionRef, carreauActions } from "./actions";
import { View } from "./view";
import { Workspace } from "./workspace";

export type NavMode = "off" | "held";

export class KeyboardNav {
  mode: NavMode = "off";
  private listeners: ((mode: NavMode) => void)[] = [];

  constructor(
    readonly ws: Workspace,
    readonly view: View,
  ) {}

  /** Run `fn` when the mode changes (and when `notify` says the host's own state did). */
  onChange(fn: (mode: NavMode) => void): void {
    this.listeners.push(fn);
  }

  /** Tell the listeners again, the mode unchanged (e.g. a host's key handler's own state). */
  protected notify(): void {
    for (const fn of this.listeners) fn(this.mode);
  }

  /**
   * Change mode. Leaving navigation mode commits the focus to the focused cell (see
   * `Lifecycle.commitFocus`), unless `commit` is false. Entering it takes the keyboard focus
   * back from inside the workspace (an iframe, a text field of its own).
   */
  setMode(mode: NavMode, commit = true): void {
    if (mode === this.mode) return;
    const was = this.mode;
    // Multi-selections, and marks, only live within navigation mode.
    if (mode === "off") {
      this.ws.clearMultiSelection();
      this.ws.clearMarks();
    }
    this.mode = mode;
    this.view.setNavMode(mode);
    if (was === "off") {
      // Take the keyboard focus back from inside the workspace: the following keys are
      // navigation.
      const a = document.activeElement;
      if (a instanceof HTMLElement && this.view.el.contains(a)) {
        a.blur();
        if (a instanceof HTMLIFrameElement) window.focus();
      }
    }
    this.notify();
    if (mode === "off" && commit) this.view.commitFocus();
  }

  /** Leave navigation mode (for commands that end it). `commit`: the focused cell takes the focus. */
  leave(commit = true): void {
    this.setMode("off", commit);
  }

  /** Run one of carreau's actions, by name (an id or an old name) or reference. Unknown: nothing. */
  run(action: string | ActionRef): void {
    let ref: ActionRef;
    try {
      ref = typeof action === "string" ? carreauActions.resolve(action) : carreauActions.resolve(action.id, action.args);
    } catch {
      return;
    }
    carreauActions.run({ ws: this.ws, view: this.view }, ref);
  }
}
