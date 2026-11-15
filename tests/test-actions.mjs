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

await server.close();
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
