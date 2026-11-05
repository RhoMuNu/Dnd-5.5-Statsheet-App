// Development and integration tests use the same source rules as the browser.
import "./register-rules.mjs";
export const rules = await import("./rules-entry.ts");
