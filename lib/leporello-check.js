// Content check for the leporello: compares what the rendered timetable shows
// against what the rendered leporello shows (plus a few cross-checks against
// the raw CMS data), so missing / extra / mismatched entries are easy to spot.
//
// Used by the /check/leporello page (app.js, views/check-leporello.pug) and
// the CLI (scripts/check-leporello.js). runLeporelloCheck() returns a list of
// groups, each { scope, title, items: [{ level, msg }], table? } with level
// one of "ok" | "warn" | "err" | "info".
//
// The leporello's column layout (overflow, rows pushed off a panel) is
// computed in the browser - only the page checks that, client-side.

const CMS =
  "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000";
const LANGS = ["de", "en"];
const DAYS = ["14", "15", "16", "17", "18"];
const DAY_LABELS = {
  Mittwoch: "14", Wednesday: "14",
  Donnerstag: "15", Thursday: "15",
  Freitag: "16", Friday: "16",
  Samstag: "17", Saturday: "17",
  Sonntag: "18", Sunday: "18",
};
// same placeholder the leporello route leaves out (app.js)
const EXHIBITION_EXCLUDE_IDS = [241];

function decode(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
}
// whitespace/nbsp/line-break insensitive comparison key
function norm(s) {
  return decode(s).replace(/[\s ]+/g, " ").trim().toLowerCase();
}
function pad(n) { return (Number(n) < 10 ? "0" : "") + Number(n); }
// "9:00", "09:00 – 10:30", "19:00–20:00" -> "09:00"
function startOf(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? pad(m[1]) + ":" + m[2] : "";
}
function endOf(t) {
  const m = String(t || "").match(/\d{1,2}:\d{2}\s*–\s*(\d{1,2}):(\d{2})/);
  return m ? pad(m[1]) + ":" + m[2] : "";
}
function label(e) {
  return `${e.day}. ${e.start || "??:??"} ${(e.title || "(ohne Titel)").replace(/\s+/g, " ")}` +
    (e.venue ? ` @ ${e.venue}` : "");
}
function key(e) { return e.day + "|" + e.start + "|" + norm(e.title); }
function countBy(list, fn) {
  const c = {};
  list.forEach((x) => { const k = fn(x); c[k] = (c[k] || 0) + 1; });
  return c;
}
function cmsTitle(e, langIdx) {
  const t = e.translations || [];
  const code = langIdx === 1 ? "en" : "de";
  const tr = t.find((x) => x.languages_code === code) ||
    t.find((x) => x.languages_code === "de") || t[0] || {};
  return tr.Title || "";
}

// ---- parsing the rendered pages -------------------------------------------

function parseTimetable(html) {
  const chunks = html.split('<div class="EventTimetableA');
  const out = [];
  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i];
    const cls = c.slice(0, c.indexOf('"'));
    const format = (cls.match(/\bA(\S+)/) || [])[1] || "";
    const day = (c.match(/data-day="(\d+)"/) || [])[1] || "";
    const timetableOnly = /EventTimetableTimetableOnly/.test(cls);
    const slugs = [...chunks[i - 1].matchAll(/href="[^"]*\/events\/([^/"]+)/g)];
    const slug = !timetableOnly && slugs.length ? slugs[slugs.length - 1][1] : "";
    const title = (c.match(/<h2 class="title[^"]*">([\s\S]*?)<\/h2>/) || [])[1];
    const time = decode((c.match(/<h4 class="time">([\s\S]*?)<\/h4>/) || [])[1]);
    const [timePart, ...venueParts] = time.split(" / ");
    out.push({
      day, format, slug, timetableOnly,
      title: decode(title).replace(/^•/, "").trim(),
      start: startOf(timePart),
      end: endOf(timePart),
      venue: venueParts.join(" / ").trim(),
    });
  }
  return out;
}

function parseLeporello(html) {
  const m = html.match(/var FLOW_ROWS = (\[[\s\S]*?\]);\s*\n/);
  if (!m) throw new Error("FLOW_ROWS nicht gefunden im Leporello-HTML");
  const rows = JSON.parse(m[1]);
  const events = [];
  const sections = [];
  const dayOrder = [];
  let day = "";
  let section = "";
  rows.forEach((r) => {
    if (r.type === "day") {
      day = DAY_LABELS[r.label] || "?" + r.label;
      dayOrder.push(day);
    } else if (r.type === "section") {
      section = r.label;
      sections.push({ day, label: r.label });
    } else if (r.type === "event") {
      events.push({
        day, section,
        title: r.title || "",
        artist: r.artist || "",
        venue: r.venue || "",
        time: r.time || "",
        start: startOf(r.time),
        end: endOf(r.time),
      });
    }
  });

  const exhibitions = [];
  const t = html.match(/<table class="p-table p-table--noTime">([\s\S]*?)<\/table>/);
  if (t) {
    for (const tr of t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cell = (cls) =>
        decode((tr[1].match(new RegExp(`<td class="${cls}">([\\s\\S]*?)</td>`)) || [])[1]).trim();
      exhibitions.push({ title: cell("c-title"), artist: cell("c-artist"), venue: cell("c-venue") });
    }
  }
  return { events, sections, dayOrder, exhibitions };
}

// ---- checks ---------------------------------------------------------------

function checkLanguage(lang, tt, lep, cms, group) {
  const langIdx = lang === "en" ? 1 : 0;

  // 1. counts
  let g = group("Anzahl Veranstaltungen");
  const ttOnly = tt.filter((e) => e.timetableOnly);
  const ttExh = tt.filter((e) => !e.timetableOnly && e.format === "ausstellungen");
  const ttExpected = tt.filter((e) => !e.timetableOnly && e.format !== "ausstellungen");
  g.info(`Timetable: ${tt.length} Einträge total (davon ${ttOnly.length} Timetable-only, ` +
    `${ttExh.length} Ausstellungen) → ${ttExpected.length} erwartet im Leporello`);
  g.info(`Leporello: ${lep.events.length} Veranstaltungen, ${lep.exhibitions.length} Ausstellungen`);
  if (ttExpected.length === lep.events.length) g.ok("Anzahl stimmt überein");
  else g.err(`Anzahl weicht ab: Timetable ${ttExpected.length} vs. Leporello ${lep.events.length}`);
  const ttDay = countBy(ttExpected, (e) => e.day);
  const lepDay = countBy(lep.events, (e) => e.day);
  g.table = {
    head: ["Tag", "Timetable", "Leporello"],
    rows: DAYS.map((d) => ({
      cells: [`${d}.10.`, ttDay[d] || 0, lepDay[d] || 0],
      bad: (ttDay[d] || 0) !== (lepDay[d] || 0),
    })),
  };

  // 2. matching entries
  g = group("Einträge abgleichen (Tag + Startzeit + Titel, dann Ort + Endzeit)");
  const lepByKey = {};
  lep.events.forEach((e) => (lepByKey[key(e)] = lepByKey[key(e)] || []).push(e));
  const ttByKey = {};
  ttExpected.forEach((e) => (ttByKey[key(e)] = ttByKey[key(e)] || []).push(e));
  let problems = 0;
  ttExpected.forEach((e) => {
    const hit = lepByKey[key(e)];
    if (!hit || !hit.length) {
      problems++;
      g.err(`fehlt im Leporello: ${label(e)} [${e.format}${e.slug ? ", " + e.slug : ""}]`);
      return;
    }
    const l = hit[0];
    if (norm(l.venue) !== norm(e.venue)) {
      problems++;
      g.err(`Ort unterschiedlich: ${label(e)} → Leporello „${l.venue}“`);
    }
    if (e.end !== l.end) {
      problems++;
      g.err(`Endzeit unterschiedlich: ${label(e)} → Timetable ${e.end || "–"}, Leporello ${l.end || "–"}`);
    }
  });
  lep.events.forEach((e) => {
    if (!ttByKey[key(e)]) {
      problems++;
      g.err(`im Leporello, aber nicht im Timetable: ${label(e)} [${e.section}]`);
    }
  });
  if (!problems) g.ok("alle Einträge gefunden, Ort und Endzeit stimmen");

  // 3. duplicates
  g = group("Doppelte Einträge im Leporello");
  const dup = Object.entries(countBy(lep.events, (e) => key(e) + "|" + norm(e.venue)))
    .filter(([, n]) => n > 1);
  if (!dup.length) g.ok("keine Duplikate");
  dup.forEach(([k, n]) => g.err(`${n}× ${k.split("|").slice(0, 3).join(" ")}`));

  // 4. empty fields
  g = group("Leere Felder im Leporello");
  let empties = 0;
  lep.events.forEach((e) => {
    ["title", "artist", "venue", "time"].forEach((f) => {
      if (!String(e[f]).trim()) {
        empties++;
        (f === "artist" ? g.warn : g.err)(`${f} leer: ${label(e)}`);
      }
    });
  });
  lep.exhibitions.forEach((e) => {
    ["title", "artist", "venue"].forEach((f) => {
      if (!e[f]) {
        empties++;
        (f === "artist" ? g.warn : g.err)(`Ausstellung, ${f} leer: ${e.title || e.artist}`);
      }
    });
  });
  if (!empties) g.ok("keine leeren Felder");

  // 5. day order + section labels
  g = group("Tage und Format-Überschriften");
  if (JSON.stringify(lep.dayOrder) === JSON.stringify(DAYS)) g.ok("alle 5 Tage in richtiger Reihenfolge");
  else g.err(`Tage im Leporello: ${lep.dayOrder.join(", ")} (erwartet ${DAYS.join(", ")})`);
  const rawLabels = lep.sections.filter((s) => /^[a-z_]+$/.test(s.label));
  if (!rawLabels.length) g.ok("alle Format-Überschriften übersetzt");
  rawLabels.forEach((s) => g.err(`Format ohne Übersetzung (LEPORELLO_FORMAT_LABEL_*): „${s.label}“ am ${s.day}.`));
  DAYS.filter((d) => !lepDay[d]).forEach((d) => g.warn(`${d}.10. hat keine Veranstaltungen („Kein Eintrag“)`));

  // 6. exhibitions vs CMS
  g = group("Ausstellungen (CMS vs. Leporello)");
  const seen = {};
  const cmsExh = cms.filter((e) => {
    if (e.status !== "published" || e.Format !== "ausstellungen") return false;
    if (EXHIBITION_EXCLUDE_IDS.includes(e.id) || seen[e.id]) return false;
    return (seen[e.id] = true);
  });
  const lepExh = {};
  lep.exhibitions.forEach((e) => (lepExh[norm(e.title)] = e));
  let exhProblems = 0;
  cmsExh.forEach((e) => {
    const title = cmsTitle(e, langIdx);
    if (!e.Venues || !e.Venues[0]) {
      exhProblems++;
      g.err(`Ausstellung ohne Ort (wird im Leporello ausgelassen): ${title} [${e.slug}]`);
    } else if (!lepExh[norm(title)]) {
      exhProblems++;
      g.err(`Ausstellung fehlt im Leporello: ${title} [${e.slug}]`);
    }
  });
  const cmsExhTitles = new Set(cmsExh.map((e) => norm(cmsTitle(e, langIdx))));
  lep.exhibitions.forEach((e) => {
    if (!cmsExhTitles.has(norm(e.title))) {
      exhProblems++;
      g.err(`Ausstellung im Leporello, aber nicht (mehr) im CMS: ${e.title}`);
    }
  });
  if (!exhProblems) g.ok(`${cmsExh.length} Ausstellungen im CMS, alle im Leporello`);

  // 7. EN fallback
  if (langIdx === 1) {
    g = group("Fehlende englische Titel (EN-Leporello zeigt dann DE)");
    const noEn = cms.filter((e) => e.status === "published" && e.In_Timetable &&
      !((e.translations || []).find((t) => t.languages_code === "en") || {}).Title);
    if (!noEn.length) g.ok("alle Titel übersetzt");
    noEn.forEach((e) => g.warn(`kein EN-Titel: ${cmsTitle(e, 0)} [${e.slug}]`));
  }
}

// events that are marked for the timetable in the CMS but don't show up in
// the rendered timetable at all (so they're missing from the leporello, too).
function checkCmsVsTimetable(cms, tt, group) {
  let g = group("Im CMS für den Timetable markiert, aber nicht sichtbar");
  const ttSlugs = countBy(tt.filter((e) => e.slug), (e) => e.slug);
  let n = 0;
  cms.forEach((e) => {
    if (e.status !== "published" || !e.In_Timetable || e.Timetable_only === "1") return;
    const times = (e.Time || []).filter((t) => t && t.Start);
    const reasons = [];
    if (!times.length) reasons.push("keine Zeit");
    if (!e.Venues || !e.Venues[0]) reasons.push("kein Ort");
    const row = Number(e.Row_in_Timetable);
    if (!(row >= 1 && row <= 7)) {
      reasons.push(`Row_in_Timetable „${e.Row_in_Timetable == null ? "" : e.Row_in_Timetable}“ (muss 1–7 sein)`);
    }
    const outside = times.filter((t) => !DAYS.includes(t.Start.split("-")[2].slice(0, 2)));
    if (outside.length) reasons.push(`Datum ausserhalb 14.–18.10.: ${outside.map((t) => t.Start).join(", ")}`);
    const shown = ttSlugs[e.slug] || 0;
    if (reasons.length || shown < times.length - outside.length) {
      n++;
      g.err(`${cmsTitle(e, 0)} [${e.slug}]: ${shown}/${times.length} Termine im Timetable` +
        (reasons.length ? " – " + reasons.join("; ") : ""));
    }
  });
  if (!n) g.ok("alle Timetable-Events aus dem CMS werden angezeigt");

  g = group("Nicht publiziert, aber In_Timetable aktiv");
  const unpub = cms.filter((e) => e.status !== "published" && e.In_Timetable);
  if (!unpub.length) g.ok("keine");
  unpub.forEach((e) => g.info(`${e.status}: ${cmsTitle(e, 0)} [${e.slug}]`));
}

async function getText(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// base: URL of a running instance of this app, e.g. http://127.0.0.1:8080
async function runLeporelloCheck(base, fetchFn) {
  fetchFn = fetchFn || fetch;
  base = base.replace(/\/+$/, "");
  const groups = [];
  let scope = "";
  function group(title) {
    const g = { scope, title, items: [] };
    ["ok", "warn", "err", "info"].forEach((level) => {
      g[level] = (msg) => g.items.push({ level, msg });
    });
    groups.push(g);
    return g;
  }

  const cms = JSON.parse(await getText(fetchFn, CMS)).data || [];
  // one page at a time: app.js keeps the request language in module-level
  // globals, so concurrent DE/EN renders can end up in the wrong language.
  const pages = [];
  for (const lang of LANGS) {
    pages.push(await getText(fetchFn, `${base}/timetable/${lang}`));
    pages.push(await getText(fetchFn, `${base}/leporello/${lang}`));
  }

  const perLang = {};
  LANGS.forEach((lang, i) => {
    scope = lang.toUpperCase();
    perLang[lang] = {
      tt: parseTimetable(pages[i * 2]),
      lep: parseLeporello(pages[i * 2 + 1]),
    };
    checkLanguage(lang, perLang[lang].tt, perLang[lang].lep, cms, group);
  });

  scope = "CMS";
  checkCmsVsTimetable(cms, perLang.de.tt, group);

  scope = "DE vs. EN";
  const g = group("Gleiche Anzahl in beiden Sprachen");
  const de = perLang.de.lep, en = perLang.en.lep;
  if (de.events.length === en.events.length && de.exhibitions.length === en.exhibitions.length) {
    g.ok(`${de.events.length} Veranstaltungen, ${de.exhibitions.length} Ausstellungen in beiden`);
  } else {
    g.err(`DE ${de.events.length}/${de.exhibitions.length} vs. EN ${en.events.length}/${en.exhibitions.length} (Veranstaltungen/Ausstellungen)`);
  }

  const all = groups.flatMap((x) => x.items);
  return {
    groups: groups.map(({ scope, title, items, table }) => ({ scope, title, items, table })),
    errors: all.filter((i) => i.level === "err").length,
    warnings: all.filter((i) => i.level === "warn").length,
    // expected leporello rows per language, for the page's client-side layout check
    counts: Object.fromEntries(LANGS.map((lang) => [lang, {
      events: perLang[lang].lep.events.length,
      exhibitions: perLang[lang].lep.exhibitions.length,
    }])),
    checkedAt: new Date(),
  };
}

module.exports = { runLeporelloCheck };
