#!/usr/bin/env node
// Terminal version of the /check/leporello page (logic in lib/leporello-check.js).
//
// Needs a running server (npm run dev). Usage:
//   node scripts/check-leporello.js                        # http://localhost:8080
//   node scripts/check-leporello.js http://localhost:8090  # other server
//
// Exit code 1 if any error (✗) was found, 0 if only warnings / all ok.

const { runLeporelloCheck } = require("../lib/leporello-check");

const BASE = process.argv[2] || "http://localhost:8080";
const ICON = { ok: "✓", warn: "!", err: "✗", info: "·" };

(async function main() {
  console.log(`Leporello-Check gegen ${BASE}`);
  let result;
  try {
    result = await runLeporelloCheck(BASE);
  } catch (e) {
    console.error(`Check fehlgeschlagen (läuft der Server auf ${BASE}?): ${e.message}`);
    process.exit(2);
  }

  let scope = null;
  result.groups.forEach((g, i) => {
    if (g.scope !== scope) {
      scope = g.scope;
      console.log(`\n==================== ${scope} ====================`);
    }
    console.log(`\n${i + 1}. ${g.title}`);
    g.items.forEach((it) => console.log(`  ${ICON[it.level]} ${it.msg}`));
    if (g.table) {
      console.log("  " + g.table.head.join(" / "));
      g.table.rows.forEach((r) =>
        console.log("    " + r.cells.map((c) => String(c).padStart(6)).join(" ") + (r.bad ? "   <- Abweichung" : "")),
      );
    }
  });

  console.log(`\nFertig: ${result.errors} Fehler, ${result.warnings} Warnungen.`);
  process.exit(result.errors ? 1 : 0);
})();
