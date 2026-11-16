// Headless checks of the action registry (run through vite's SSR loader).
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { ActionRegistry, refKey } = await server.ssrLoadModule("/src/actions.ts");
let fails = 0;
const check = (name, ok) => { console.log(ok ? "ok  " : "FAIL", name); if (!ok) fails++; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return !re || re.test(e.message); } };

// A throwaway registry.
{
  const reg = new ActionRegistry();
  let ran = [];
  reg.define({ id: "x", title: "X", categories: ["test"], run: () => ran.push("x") });
  reg.define({
    id: "go",
    title: (a) => `Go ${a.target}`,
    description: (a) => `Go to the ${a.target}`,
    categories: ["test"],
    params: { target: { values: ["left", "right", "tab"] }, into: { default: false } },
    check: (a) => (a.into && a.target === "tab" ? "`into` needs a direction" : null),
    run: (_ctx, a) => ran.push(`go ${a.target} ${a.into}`),
    enabled: (ctx) => ctx.ok,
  });
  reg.define({ id: "d", title: "D", description: "A d", categories: ["test"], run: () => {} });
  reg.alias("goLeft", { id: "go", args: { target: "left" } });
  reg.alias("goIntoLeft", { id: "go", args: { target: "left", into: true } });

  const rx = reg.resolve("x");
  check("an action without params resolves to { id } without args", rx.id === "x" && !("args" in rx));
  const g = reg.resolve("go", { target: "left" });
  check("defaults are filled", g.args.target === "left" && g.args.into === false);
  check("args keys in the order of params", Object.keys(g.args).join() === "target,into");
  check("an alias expands", refKey(reg.resolve("goIntoLeft")) === "go?into=true&target=left");
  check("explicit args win over the alias's", reg.resolve("goLeft", { target: "right" }).args.target === "right");
  check("unknown action throws", throws(() => reg.resolve("nope"), /unknown action "nope"/));
  check("unknown argument throws", throws(() => reg.resolve("go", { target: "left", side: 1 }), /go: unknown argument "side"/));
  check("missing argument throws", throws(() => reg.resolve("go"), /go: missing argument "target"/));
  check("value not allowed throws", throws(() => reg.resolve("go", { target: "up" }), /go: target: expected one of left, right, tab/));
  check("check's message throws", throws(() => reg.resolve("go", { target: "tab", into: true }), /needs a direction/));
  check("refKey: equal for references written differently", refKey(reg.resolve("go", { target: "left" })) === refKey(reg.resolve("go", { into: false, target: "left" })));
  check("refKey: no args is the id", refKey({ id: "x" }) === "x" && refKey({ id: "x", args: {} }) === "x");
  check("define twice throws", throws(() => reg.define({ id: "x", title: "X2", categories: [], run: () => {} })));
  reg.define({ id: "x", title: "X2", categories: ["test"], run: () => ran.push("x2") }, { override: true });
  check("define with override replaces", reg.title({ id: "x" }) === "X2");
  reg.run({}, { id: "x" });
  reg.run({}, g);
  check("run runs the definition", ran.join("|") === "x2|go left false");
  let threw = false;
  try { reg.run({}, { id: "unknown" }); } catch { threw = true; }
  check("run on an unknown id does nothing", !threw && ran.length === 2);
  check("enabled without a predicate is true", reg.enabled({}, { id: "x" }) === true);
  check("enabled with a predicate", reg.enabled({ ok: false }, g) === false && reg.enabled({ ok: true }, g) === true);
  check("title as a function of args", reg.title(g) === "Go left");
  check("description: a string", reg.description({ id: "d" }) === "A d");
  check("description: a function of args", reg.description(g) === "Go to the left");
  check("description: the title when absent", reg.description({ id: "x" }) === "X2");
  check("list in definition order", reg.list().map((d) => d.id).join() === "x,go,d");
  check("aliases", Object.keys(reg.aliases()).join() === "goLeft,goIntoLeft");
}

// Carreau's actions.
{
  const { carreauActions: A } = await server.ssrLoadModule("/src/actions.ts");
  const D = ["Left", "Right", "Up", "Down"];
  const oldNames = [
    // Command (workspace.ts)
    "nextTab", "prevTab", "parent", "root", "child", "undo", "redo",
    ...D.map((d) => `focus${d}`), ...D.map((d) => `expand${d}`), "unexpand", ...D.map((d) => `swap${d}`), "maximize", "restore",
    // NavAction (keyboard.ts)
    "toggleMaximize", "float", "closeTab", "closePane", "forceCloseTab", "group", "collapse", "renameTab", "namePane",
    "mark", "moveMarked", "clear", "growWidth", "shrinkWidth", "growHeight", "shrinkHeight", "insertInto", "insertFloat",
    ...D.map((d) => `insert${d}`), ...D.map((d) => `insertInto${d}`), ...D.map((d) => `move${d}`), ...D.map((d) => `moveInto${d}`),
  ];
  const bad = oldNames.filter((n) => throws(() => A.resolve(n)));
  check(`every old name resolves (${oldNames.length})${bad.length ? `: not ${bad.join(", ")}` : ""}`, !bad.length);
  check("insertIntoLeft's key", refKey(A.resolve("insertIntoLeft")) === "insert?into=true&target=left");
  check("insert {target: left} = insertLeft", refKey(A.resolve("insert", { target: "left" })) === refKey(A.resolve("insertLeft")));
  check("insert {target: tab, into: true} throws", throws(() => A.resolve("insert", { target: "tab", into: true })));
  check("insertLeft's title", A.title(A.resolve("insertLeft")) === "New cell to the left");
  const defs = A.list();
  check("every definition has lowercase categories", defs.every((d) => d.categories.length && d.categories.every((c) => c === c.toLowerCase())));
  check("forceCloseTab is advanced", A.get("forceCloseTab").categories.includes("advanced"));
  check("every definition has a description", defs.every((d) => d.description !== undefined));
  check("insertIntoUp's description", A.description(A.resolve("insertIntoUp")) === "Open a new tab in the pane above, or in a new pane there if there is none");
  check("resize's description", A.description(A.resolve("shrinkHeight")) === "Make the focused cell shorter");

  // Behavior, with a workspace (actions that need the view can't run here).
  const { Workspace } = await server.ssrLoadModule("/src/workspace.ts");
  const { row, pane, serialize, clone } = await server.ssrLoadModule("/src/model.ts");
  const tree = row([pane(["a", "b"]), pane(["c", "d"])]);
  const make = () => {
    const ws = new Workspace(clone(tree));
    ws.select({ id: ws.root.children[0].id });
    return ws;
  };
  const same = (a, b) => serialize(a.root) === serialize(b.root) && JSON.stringify(a.selection) === JSON.stringify(b.selection);
  const run = (ws, name, args) => A.run({ ws, view: null }, A.resolve(name, args));
  {
    const a = make(), b = make();
    run(a, "focus", { target: "right" });
    b.run("focusRight");
    check("focus {target: right} = ws.run(focusRight)", same(a, b) && a.selection.id !== make().selection.id);
  }
  {
    const a = make(), b = make();
    run(a, "nextTab");
    b.run("nextTab");
    check("nextTab = ws.run(nextTab)", same(a, b));
  }
  {
    const a = make(), b = make();
    const before = serialize(a.root);
    run(a, "swap", { target: "right" });
    b.run("swapRight");
    const swapped = same(a, b) && serialize(a.root) !== before;
    run(a, "undo");
    b.run("undo");
    check("swap then undo = the workspace's", swapped && same(a, b) && serialize(a.root) === before);
  }

  // Menus: what shows, and labels, from the context.
  {
    const ws = make();
    const p = ws.root.children[0];
    const ctx = { ws, view: null, node: p.id };
    const ref = (n) => A.resolve(n);
    check("namePane's label: unnamed", A.label(ctx, ref("namePane")) === "Name pane…");
    check("removePaneName hidden on an unnamed pane", !A.visible(ctx, ref("removePaneName")));
    ws.namePane(p.id, "foo");
    check("namePane's label: named", A.label(ctx, ref("namePane")) === "Rename pane…");
    check("removePaneName shown on a named pane", A.visible(ctx, ref("removePaneName")));
    check("collapse hidden without a group", !A.visible(ctx, ref("collapse")));
    check("toggleStick hidden out of a stream", !A.visible(ctx, ref("toggleStick")));
    check("label: the title when the action has none", A.label(ctx, ref("closePane")) === "Close pane");
    check("visible without a menu context", A.visible({ ws, view: null }, ref("removePaneName")));
    const { PANE_MENU, TAB_MENU } = await server.ssrLoadModule("/src/menus.ts");
    const names = (spec) => spec.flatMap((it) => ("action" in it ? [it] : "row" in it ? it.row : "submenu" in it ? names(it.items) : [{ action: it.namedPanes.action, args: { [it.namedPanes.arg]: "x" } }]));
    const bad = [...names(PANE_MENU), ...names(TAB_MENU)].filter((it) => throws(() => A.resolve(it.action, it.args)));
    check("the default menus name known actions", !bad.length);
  }
}

await server.close();
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
