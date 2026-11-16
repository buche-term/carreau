// Public API.
//
// Styles are not imported here: import "carreau/style.css" (and "carreau/prompt.css" when
// using prompts) from the host app. Prompt *rendering* is optional as well: import
// "carreau/prompt-view" (or register a renderer for "prompt" yourself).

declare const __CARREAU_VERSION__: string;
/** The version of this package (its `package.json` at build time). */
export const VERSION: string = __CARREAU_VERSION__;

export * from "./actions";
export * from "./cells";
export * from "./colors";
export * from "./dnd";
export * from "./keyboard";
export * from "./menus";
export * from "./model"; // (and what it re-exports: types, geometry, kinds, tree, complex)
export * from "./names";
export * from "./prompt";
export * from "./view";
export * from "./workspace";
