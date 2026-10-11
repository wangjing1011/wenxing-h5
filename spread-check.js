// spread-check.js: verify spread definitions extracted from app.js
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/js/app.js", "utf8");
const m = src.match(/var SPREADS = \{[\s\S]*?\n  \};/);
if (!m) { console.error("FAIL: SPREADS not found"); process.exit(1); }
eval(m[0]);

const keys = Object.keys(SPREADS);
let errors = [];
const expect = ["single", "three", "soul", "choice", "relation", "break", "horseshoe", "celtic"];
if (keys.length !== expect.length) errors.push("spread count " + keys.length + " != " + expect.length);
keys.forEach((k) => {
  const sp = SPREADS[k];
  if (sp.count !== sp.positions.length) errors.push(k + ": count " + sp.count + " != positions " + sp.positions.length);
  if (sp.keyPos < 0 || sp.keyPos >= sp.positions.length) errors.push(k + ": keyPos out of range");
  if (!sp.name || !sp.ph || !sp.hint) errors.push(k + ": missing name/ph/hint");
  sp.positions.forEach((p) => { if (!p.label || !p.meaning) errors.push(k + ": position missing label/meaning"); });
});
const counts = keys.map((k) => SPREADS[k].count).join(",");
if (errors.length) { console.error("FAIL:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("OK: " + keys.length + " spreads [" + keys.join(",") + "] counts=[" + counts + "] all valid");
