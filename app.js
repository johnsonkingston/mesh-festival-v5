//version 5.0.0
const express = require("express");
const app = express();
const serverPort = process.env.PORT || 8080;

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.use(express.json({ extended: true }));
var bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(express.urlencoded());

//var force = require('express-force-domain');
//app.use( force('https://meshfestival.ch') );

app.use("/static", express.static("static"));
app.use("/static/lang", express.static("lang"));
app.use("/static/includes", express.static("includes"));
app.use("/node_modules", express.static("node_modules"));

app.get("/ticketshop", function (req, res) {
  res.sendFile(path.join(__dirname, "static/html/tickets.html"));
});
app.get("/ticketshop/en", function (req, res) {
  res.sendFile(path.join(__dirname, "static/html/tickets-en.html"));
});

app.use((req, res, next) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  res.locals.baseURL = `${protocol}://${req.get("host")}/`;
  next();
});

const fs = require("fs");
var path = require("path");
var glob = require("glob");
const { runLeporelloCheck } = require("./lib/leporello-check");

app.engine("pug", require("pug").__express);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

//Start Server
const server = app.listen(serverPort, () => {
  console.log("App running on port " + serverPort);
});

let events;

// --- simple in-memory cache with short TTL --------------------------------
// Collapses the per-request CMS fan-out: identical upstream calls within the
// TTL window are served from memory instead of re-fetching Directus.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 30 * 1000;
const _cache = new Map(); // key -> { expires:Number, value:any }

function cacheSet(key, value) {
  // keep the map from growing unbounded (e.g. slug-fuzzing bots)
  if (_cache.size > 250) {
    const now = Date.now();
    for (const [k, v] of _cache) if (v.expires <= now) _cache.delete(k);
    if (_cache.size > 250) _cache.clear();
  }
  _cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

// For getters with no side effects: memoise their return value.
// Failed/empty responses are not cached, so recovery is immediate.
// Pass clone=true (structuredClone) or a cheaper custom clone function for
// results that route handlers mutate in place (page/event), so the cached
// copy is never touched. This clone runs on EVERY request for that key, hit
// or miss, so prefer the narrowest function that's still safe.
async function cached(key, producer, clone) {
  const cloneFn =
    typeof clone === "function" ? clone : clone ? structuredClone : null;
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return cloneFn ? cloneFn(hit.value) : hit.value;
  }
  const value = await producer();
  if (value !== "" && value != null) cacheSet(key, value);
  return cloneFn && value !== "" && value != null ? cloneFn(value) : value;
}

// getPage/getEvent route handlers only ever mutate the top-level CMS item
// (adding pathname/derived fields), the order of its `translations` array,
// and properties on the translation objects themselves (Price/Audience/...) -
// never the deeper relations (Main_Image, Venues, Artists_in_List, etc).
// A full structuredClone of that whole *.*.* tree on every single request
// is wasted CPU; this only copies the parts that actually get mutated.
function shallowCloneItem(value) {
  if (!value || !Array.isArray(value.data) || !value.data[0]) return value;
  const item = { ...value.data[0] };
  if (Array.isArray(item.translations)) {
    item.translations = item.translations.map((t) => (t ? { ...t } : t));
  }
  return { ...value, data: [item] };
}

// getStartpage's route handler aliases data.translations = data.title, then
// reorders that array in place - clone data.title so the shared cache entry
// is never touched by the alias.
function shallowCloneStartpage(value) {
  if (!value || !value.data) return value;
  const data = { ...value.data };
  if (Array.isArray(data.title)) {
    data.title = [...data.title];
  }
  return { ...value, data };
}

// For the Events getters, which also populate the module-level `events`:
// cache both the return value and the resulting `events` array, and restore
// the global on a cache hit.
async function cachedEvents(key, producer) {
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) {
    events = hit.value.events;
    return hit.value.data;
  }
  const data = await producer(); // sets the global `events` as a side effect
  if (data !== "" && data != null) cacheSet(key, { data, events });
  return data;
}

//Language
function languageTransform(string) {
  if (string == "en") {
    return 1;
  } else {
    return 0;
  }
}
function langRemove(pathname) {
  var queryIndex = pathname.indexOf("?");
  if (queryIndex !== -1) {
    pathname = pathname.substring(0, queryIndex);
  }
  if (
    pathname.substr(pathname.length - 3) == "/en" ||
    pathname.substr(pathname.length - 3) == "/de"
  ) {
    pathname = pathname.substring(1, pathname.length - 3);
  } else {
    pathname = pathname.substring(1, pathname.length);
  }
  if (pathname == "/") {
    pathname = "";
  }
  return pathname;
}

//Venues
async function getVenues() {
  return cached("venues", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Venues?fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    const data = await response.json();
    let dataArray = new Array();
    for (const [key, value] of Object.entries(data.data)) {
      dataArray[value.id] = { id: value.id, Name: value.Name };
    }
    data.data = dataArray;
    return data;
  });
}

async function getVenuesOverview() {
  return cached("venuesOverview", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Venues/?filter[In_Overview][_eq]=true&fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Navigation
async function getNavigation() {
  return cached("navigation", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Navigation_translations",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Hightlights
async function getHighlights() {
  return cached("highlights", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Highlights?fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//News
// async function getNews() {
//     const response = await fetch("https://env-9468449.appengine.flow.ch/items/News?fields[]=*.*");
//     if (!response.ok) {
//         console.log('Response not okay');
//         const data = '';
//         return data;
//     }else
//     {
//         const data = await response.json();
//         return data;
//     }
// }

//Footer
async function getFooter() {
  return cached("footer", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Footer_translations",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Timetable
async function getAllEvents() {
  return cachedEvents("allEvents", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;

    for (const [key, value] of Object.entries(events)) {
      if (
        Array.isArray(value.translations) &&
        value.translations[0] &&
        value.translations[0].languages_code !== "de" &&
        value.translations[1]
      ) {
        var deTranslation = value.translations[1];
        value.translations[1] = value.translations[0];
        value.translations[0] = deTranslation;
      }

      if (value.Time == undefined) {
        events[key].Time = [{}];
        events[key].Time[0].Start = "";
        events[key].Time[0].End = "";
        events[key].DateToOrder = "zzz";
        events[key].Day = "";
        events[key].Hour = "";
        events[key].Minute = "";
        events[key].HourEnd = "";
      } else {
        if (value.Time.length > 1) {
          for (let i = 0; i < value.Time.length; i++) {
            // corrEvent is a fresh clone owned only by this loop, so
            // repointing Time[0] and pushing it need no further cloning
            var corrEvent = structuredClone(events[key]);
            corrEvent.Time[0] = corrEvent.Time[i];
            corrEvent = rewriteDate(corrEvent, 0);
            events.push(corrEvent);
          }
        } else {
          events[key] = rewriteDate(events[key], 0);
        }
      }
    }
    events.sort((a, b) =>
      (a.DateToOrder || "").localeCompare(b.DateToOrder || ""),
    );

    return data;
  });
}

function rewriteDate(event, subkey) {
  if (event.Time[subkey].Start !== undefined) {
    event.Day = event.Time[subkey].Start.split("-")[2].substring(0, 2);
    event.Hour = event.Time[subkey].Start.split("-")[2].substring(3, 5);
    event.Minute = event.Time[subkey].Start.split(":")[1];
  }

  if (event.Time[subkey].End !== undefined) {
    var endDay = event.Time[subkey].End.split("-")[2].substring(0, 2);
    var dayOffset = endDay !== event.Day ? 24 : 0;
    event.HourEnd =
      dayOffset +
      parseInt(event.Time[subkey].End.split("-")[2].substring(3, 5)) +
      parseInt(event.Time[subkey].End.split(":")[1]) / 60;

    event.MinuteEnd = event.Time[subkey].End.split(":")[1];
  } else {
    event.HourEnd = "";
    event.MinuteEnd = "";
  }
  event.DateToOrder = event.Time[subkey].Start;

  return event;
}

async function renderTimetable(req, res, extraLocals) {
  extraLocals = extraLocals || {};
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];
  format = extraLocals.format || req.params.format || "none";

  [result, navigation, footer, venues] = await Promise.all([
    getAllEvents(),
    getNavigation(),
    getFooter(),
    getVenues(),
  ]);

  result.data[0].pathname = langRemove(pathname);

  if (result.data[0]) {
    res.render("timetable", {
      data: result.data[0],
      events: events,
      navigation: navigation.data,
      footer: footer.data,
      language: languageObject,
      highlights: [],
      venues: venues.data,
      format: format,
      slides: [],
      autoOpenEvent: extraLocals.autoOpenEvent || null,
    });
  }
}

app.get("/timetable/:language?/:format?", async function (req, res) {
  try {
    await renderTimetable(req, res);
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Artists
async function getAllArtists() {
  return cachedEvents("allArtists", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;
    let artists = [];

    for (const [key, value] of Object.entries(events)) {
      if (events[key].status !== "published") continue;

      if (events[key].Artists_in_List !== null) {
        var artist = [];
        for (const [keyArtist, valueArtist] of Object.entries(
          events[key].Artists_in_List,
        )) {
          if (valueArtist.First_name == undefined) {
            artist.First_Name = "";
          } else {
            artist.First_Name = valueArtist.First_name;
          }

          artist.Name = valueArtist.Name;
          artist.Format = value.Format;
          artist.Thema = value.Thema;
          artist.slug = value.slug;
          var translations = value.translations || [];
          var titleDE =
            translations.find(
              (t) => t && t.languages_code && t.languages_code.code === "de",
            ) ||
            translations[0] ||
            {};
          var titleEN =
            translations.find(
              (t) => t && t.languages_code && t.languages_code.code === "en",
            ) ||
            translations[1] ||
            titleDE;
          artist.Title = [titleDE.Title || "", titleEN.Title || ""];
          artist.Venues = value.Venues;
          artists.push(structuredClone(artist));
        }
      } else if (value.Format === "guided_tour") {
        // guided tours aren't tied to a per-person Artists_in_List entry in
        // the CMS - synthesize one from the event's own Artist field so the
        // tour still shows up in the artists/Formate view.
        var tourTranslations = value.translations || [];
        var tourTitleDE =
          tourTranslations.find(
            (t) => t && t.languages_code && t.languages_code.code === "de",
          ) ||
          tourTranslations[0] ||
          {};
        var tourTitleEN =
          tourTranslations.find(
            (t) => t && t.languages_code && t.languages_code.code === "en",
          ) ||
          tourTranslations[1] ||
          tourTitleDE;
        artists.push({
          First_Name: "",
          Name: value.Artist || "",
          Format: value.Format,
          Thema: value.Thema,
          slug: value.slug,
          Title: [tourTitleDE.Title || "", tourTitleEN.Title || ""],
          Venues: value.Venues,
        });
      }
    }

    // neutral base order (by name); the /artists route re-sorts per view
    artists.sort((a, b) => (a.Name || "").localeCompare(b.Name || ""));

    events = artists;

    return data;
  });
}

// artist list view orderings: "formate" (by format), "themen" (by topic), "az" (name only)
const ARTIST_FORMAT_ORDER = [
  "ausstellungen",
  "screenings",
  "diskurs",
  "konferenz",
  "performances",
  "clubnights",
  "opening",
  "workshop",
  "satellite",
  "welcoming",
];
// fixed order requested for the "Themen" view (not alphabetical); any Thema
// not listed here still shows up, sorted after these by name.
const ARTIST_THEMA_ORDER = [
  "Commons of Connection",
  "Memory Machines",
  "Future Playgrounds",
  "Wild Cities",
  "Circular Systems",
  "Non-Public Publics",
  "Urban Actions | Spatial Utopias",
];
function sortArtists(list, sort) {
  var out = (list || []).slice();
  if (sort === "themen") {
    out.sort((a, b) => {
      var at = (a.Thema || "").trim();
      var bt = (b.Thema || "").trim();
      var ae = at === "" ? 1 : 0;
      var be = bt === "" ? 1 : 0;
      if (ae !== be) return ae - be; // entries without a topic go last
      var ai = ARTIST_THEMA_ORDER.indexOf(at);
      var bi = ARTIST_THEMA_ORDER.indexOf(bt);
      if (ai === -1) ai = ARTIST_THEMA_ORDER.length;
      if (bi === -1) bi = ARTIST_THEMA_ORDER.length;
      if (ai !== bi) return ai - bi;
      if (at !== bt) return at.localeCompare(bt);
      return (a.Name || "").localeCompare(b.Name || "");
    });
  } else if (sort === "az") {
    out.sort(
      (a, b) =>
        (a.Name || "").localeCompare(b.Name || "") ||
        (a.First_Name || "").localeCompare(b.First_Name || ""),
    );
  } else {
    out.sort((a, b) => {
      var ai = ARTIST_FORMAT_ORDER.indexOf(a.Format);
      var bi = ARTIST_FORMAT_ORDER.indexOf(b.Format);
      if (ai === -1) ai = ARTIST_FORMAT_ORDER.length;
      if (bi === -1) bi = ARTIST_FORMAT_ORDER.length;
      if (ai !== bi) return ai - bi;
      return (a.Name || "").localeCompare(b.Name || "");
    });
  }
  return out;
}

app.get("/artists/:language?/", async function (req, res) {
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];

  var sort = req.query.sort;
  if (sort !== "themen" && sort !== "az") sort = "formate";

  try {
    [result, navigation, footer, venues] = await Promise.all([
      getAllArtists(),
      getNavigation(),
      getFooter(),
      getVenues(),
    ]);

    language = req.params.language || "de";

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0]) {
      res.render("artists", {
        data: result.data[0],
        events: sortArtists(events, sort),
        sort: sort,
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        venues: venues.data,
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// the exhibitions page is gone – it is now the "Themen" view of /artists
app.get(["/ausstellungen", "/ausstellungen/:language?"], function (req, res) {
  var lang = req.params.language === "en" ? "/en" : "";
  res.redirect("/artists" + lang + "?sort=themen");
});

//List
async function getAllEventsList() {
  return cachedEvents("allEventsList", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;

    for (const [key, value] of Object.entries(events)) {
      if (
        Array.isArray(value.translations) &&
        value.translations[0] &&
        value.translations[0].languages_code !== "de" &&
        value.translations[1]
      ) {
        var deTranslation = value.translations[1];
        value.translations[1] = value.translations[0];
        value.translations[0] = deTranslation;
      }

      if (value.Time == undefined) {
        events[key].Time = [{}];
        events[key].Time[0].Start = "";
        events[key].Time[0].End = "";
        events[key].DateToOrder = "zzz";
        events[key].Day = "";
        events[key].Hour = "";
        events[key].Minute = "";
        events[key].HourEnd = "";
      } else {
        if (value.Time.length > 1) {
          for (let i = 0; i < value.Time.length; i++) {
            // corrEvent is a fresh clone owned only by this loop, so
            // repointing Time[0] and pushing it need no further cloning
            var corrEvent = structuredClone(events[key]);
            corrEvent.Time[0] = corrEvent.Time[i];
            corrEvent = rewriteDate(corrEvent, 0);
            events.push(corrEvent);
          }
        } else {
          events[key] = rewriteDate(events[key], 0);
        }
      }
    }
    events.sort((a, b) =>
      (a.DateToOrder || "").localeCompare(b.DateToOrder || ""),
    );

    return data;
  });
}

app.get("/list/:language?/:format?", async function (req, res) {
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];
  format = req.params.format || "none";

  try {
    [result, navigation, footer, venues] = await Promise.all([
      getAllEvents(),
      getNavigation(),
      getFooter(),
      getVenues(),
    ]);

    language = req.params.language || "de";

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0]) {
      res.render("list", {
        data: result.data[0],
        events: events,
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        venues: venues.data,
        format: format,
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Page
async function getPage(pageSlug) {
  console.log(pageSlug);
  return cached(
    "page:" + pageSlug,
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Pages/?filter[slug][_eq]=" +
          pageSlug +
          "&fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    shallowCloneItem,
  );
}

app.get("/pages/:pageSlug/:language?", async function (req, res) {
  var pathname = req.originalUrl;
  try {
    pageSlug = req.params.pageSlug;
    language = req.params.language || "de";

    console.log(language);
    [result, navigation, footer] = await Promise.all([
      getPage(pageSlug),
      getNavigation(),
      getFooter(),
    ]);

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0].translations[0].languages_code.code !== "de") {
      var deContent = result.data[0].translations[1];
      result.data[0].translations[1] = result.data[0].translations[0];
      result.data[0].translations[0] = deContent;
    }

    languageObject = [language, languageTransform(language)];
    if (result.data[0]) {
      //console.log(languageObject);
      var template =
        pageSlug === "visit"
          ? "visit"
          : pageSlug === "locations"
            ? "locations"
            : "page";
      var venuesOverview = [];
      if (pageSlug === "locations") {
        var venuesOverviewResult = await getVenuesOverview();
        venuesOverview = venuesOverviewResult.data || [];
      }
      res.render(template, {
        data: result.data[0],
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        events: [],
        venues: venuesOverview,
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Event
async function getEvent(eventSlug) {
  console.log(eventSlug);
  return cached(
    "event:" + eventSlug,
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Events/?filter[slug][_eq]=" +
          eventSlug +
          "&fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    shallowCloneItem,
  );
}

app.get("/events/:eventSlug/:language?", async function (req, res) {
  var pathname = req.originalUrl;

  try {
    eventSlug = req.params.eventSlug;
    language = req.params.language || "de";

    if (!req.query.embed) {
      await renderTimetable(req, res, { autoOpenEvent: eventSlug });
      return;
    }

    console.log(language);
    [result, navigation, footer] = await Promise.all([
      getEvent(eventSlug),
      getNavigation(),
      getFooter(),
    ]);
    //console.log(result.data[0]);

    result.data[0].pathname = langRemove(pathname);

    //Order of languages
    if (result.data[0].translations[0].languages_code.code == "en") {
      let engData = result.data[0].translations[0];
      let deData = result.data[0].translations[1];
      result.data[0].translations[0] = deData;
      result.data[0].translations[1] = engData;
    }
    //console.log('Code: '+result.data[0].translations[0].languages_code.code);

    //Fallback if only one translation exists in the CMS
    if (!result.data[0].translations[1]) {
      result.data[0].translations[1] = JSON.parse(
        JSON.stringify(result.data[0].translations[0]),
      );
    }
    if (!result.data[0].translations[0]) {
      result.data[0].translations[0] = JSON.parse(
        JSON.stringify(result.data[0].translations[1]),
      );
    }

    //Transformations
    //Price
    if (result.data[0].Price == 0) {
      result.data[0].translations[0].Price = "Eintritt gratis";
      result.data[0].translations[1].Price = "Free entrance";
    } else if (result.data[0].Price == null) {
      result.data[0].translations[0].Price = "";
      result.data[0].translations[1].Price = "";
    } else {
      result.data[0].translations[0].Price = result.data[0].Price;
      result.data[0].translations[1].Price = result.data[0].Price;
    }

    //Audience
    if (result.data[0].Audience == "all") {
      result.data[0].translations[0].Audience = "Geeignet für alle Gäste";
      result.data[0].translations[1].Audience = "Suitable for all guests";
    } else if (result.data[0].Audience == "kids") {
      result.data[0].translations[0].Audience = "Geeignet für Kinder";
      result.data[0].translations[1].Audience = "Suitable for kids";
    } else if (result.data[0].Audience == "pros") {
      result.data[0].translations[0].Audience = "Geeignet für Pros";
      result.data[0].translations[1].Audience = "Suitable for pros";
    } else if (result.data[0].Audience == "konferenz") {
      result.data[0].translations[0].Audience = "Für Konferenzgäste";
      result.data[0].translations[1].Audience = "For guests of the conference";
    } else {
      result.data[0].translations[0].Audience = "";
      result.data[0].translations[1].Audience = "";
    }

    //Language
    if (result.data[0].Language == "german") {
      result.data[0].translations[0].Language = "In deutscher Sprache";
      result.data[0].translations[1].Language = "In German";
    } else if (result.data[0].Language == "english") {
      result.data[0].translations[0].Language = "In englischer Sprache";
      result.data[0].translations[1].Language = "In English";
    } else {
      result.data[0].translations[0].Language = "";
      result.data[0].translations[1].Language = "";
    }

    //Seats
    if (result.data[0].Seats_available == "yes") {
      result.data[0].translations[0].Seats_available = "Plätze verfügbar";
      result.data[0].translations[1].Seats_available = "Seats available";
    } else if (result.data[0].Seats_available == "sold_out") {
      result.data[0].translations[0].Seats_available = "Sorry, sold out!";
      result.data[0].translations[1].Seats_available = "Sorry, sold out!";
    } else {
      result.data[0].translations[0].Seats_available = "";
      result.data[0].translations[1].Seats_available = "";
    }

    //Time
    if (result.data[0].Time !== null) {
      result.data[0].time_transformed = new Object();
      result.data[0].time_transformed.start = dateformat(
        result.data[0].Time[0].Start,
      );
      if (result.data[0].Time[0].End !== undefined) {
        result.data[0].time_transformed.end = dateformat(
          result.data[0].Time[0].End,
        );
      } else {
        result.data[0].time_transformed.end =
          result.data[0].time_transformed.start;
      }
      result.data[0].time_transformed_de = new Object();
      result.data[0].time_transformed_de.start = dateformat_de(
        result.data[0].Time[0].Start,
      );
      if (result.data[0].Time[0].End !== undefined) {
        result.data[0].time_transformed_de.end = dateformat_de(
          result.data[0].Time[0].End,
        );
      } else {
        result.data[0].time_transformed_de.end =
          result.data[0].time_transformed.start;
      }
    } else {
      result.data[0].time_transformed = new Object();
      result.data[0].time_transformed.start = "";
      result.data[0].time_transformed.end = "";
    }

    //Format
    var formatSlug = result.data[0].Format;
    const formatTranslationDE = {
      ausstellungen: "Ausstellung",
      performances: "Performance",
      screenings: "Screening",
      konferenz: "Konferenz",
      workshop: "Workshop",
      satellite: "Satellit",
      clubnights: "Club Nights",
      diskurs: "Talks & Panels",
      opening: "Opening",
      welcoming: "Welcome",
      guided_tour: "Rundgang",
    };
    const formatTranslationEN = {
      ausstellungen: "Exhibitions",
      performances: "Performances",
      screenings: "Screenings",
      konferenz: "Conference",
      workshop: "Workshop",
      satellite: "Satellite",
      clubnights: "Club Nights",
      diskurs: "Talks & Panels",
      opening: "Opening",
      welcoming: "Welcome",
      guided_tour: "Guided Tour",
    };
    result.data[0].formatTranslation = [
      formatTranslationDE[formatSlug],
      formatTranslationEN[formatSlug],
    ];

    // Content images: the Directus rich-text editor inserts asset URLs with
    // the original upload's raw pixel size (?width=1894&height=1894, varies
    // per image), which skips Directus' image transforms entirely - swap
    // that query string for the "content" transform preset so these images
    // are always served pre-sized/optimized instead of at full upload res.
    var CONTENT_IMAGE_SIZE_PARAMS =
      /\?(?:width=\d+&(?:amp;)?height=\d+|height=\d+&(?:amp;)?width=\d+)/g;
    [0, 1].forEach(function (i) {
      if (result.data[0].translations[i].Content) {
        result.data[0].translations[i].Content = result.data[0].translations[
          i
        ].Content.replace(CONTENT_IMAGE_SIZE_PARAMS, "?key=content");
      }
    });

    //Time Frontend
    // console.log(result.data[0].translations[0].Time_frontend );
    if (result.data[0].translations[0].Time_frontend !== null) {
      result.data[0].translations[0].Time_frontend =
        result.data[0].translations[0].Time_frontend.replace("\n", "<br>");
    }
    if (result.data[0].translations[1].Time_frontend !== null) {
      result.data[0].translations[1].Time_frontend =
        result.data[0].translations[1].Time_frontend.replace("\n", "<br>");
    }

    languageObject = [language, languageTransform(language)];
    if (result.data[0]) {
      //console.log(languageObject);
      res.render("event", {
        data: result.data[0],
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        events: [],
        venues: [],
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

// robots.txt
app.get("/robots.txt", async function (req, res) {
  res.type("text/plain");
  res.send("User-agent: *");
});

// Title-slide generator tool for conference speakers
app.get("/generate-slides", function (req, res) {
  res.render("generate-slides");
});

// Title-video generator tool: fixed background video + editable text overlay,
// exported as a video (WebM, via canvas + MediaRecorder).
app.get("/generate-video", function (req, res) {
  res.render("generate-video");
});

// Quick A4 print tool for small posters / notes
app.get("/print", function (req, res) {
  res.render("print");
});

// Content check: timetable vs. leporello (see lib/leporello-check.js). The
// check fetches this app's own /timetable and /leporello pages, so it always
// tests exactly what's rendered. The page additionally checks the leporello's
// column layout client-side (hidden iframes).
app.get("/check/leporello", async function (req, res) {
  let result = null;
  let error = null;
  try {
    result = await runLeporelloCheck(`http://127.0.0.1:${serverPort}`);
  } catch (err) {
    console.error(err);
    error = err.message;
  }
  res.set("X-Robots-Tag", "noindex");
  res.render("check-leporello", { result, error });
});

// Per-day program poster (9:16), exportable as JPG
app.get("/screens/:language?", async function (req, res) {
  try {
    const language = req.params.language || "de";
    const langIdx = languageTransform(language);

    const [, venuesResult] = await Promise.all([
      getAllEvents(), // populates the module-level `events` (cached)
      getVenues(),
    ]);
    const venuesData = (venuesResult && venuesResult.data) || [];

    const screenEvents = (events || [])
      .filter(
        (e) =>
          e &&
          e.status === "published" &&
          e.In_Timetable &&
          e.Timetable_only !== "1" &&
          e.Venues &&
          e.Venues[0] &&
          e.Day &&
          e.Hour !== "" &&
          e.Hour != null,
      )
      .map((e) => {
        const tr =
          (e.translations && (e.translations[langIdx] || e.translations[0])) ||
          {};
        const v = venuesData[e.Venues[0].Venues_id];
        return {
          day: String(e.Day),
          format: e.Format || "",
          subformat: e.Subformat || "",
          title: tr.Title || "",
          artist: keepNamesTogether(e.Artist || ""),
          hourStart: parseInt(e.Hour, 10) || 0,
          minStart: e.Minute ? parseInt(e.Minute, 10) : 0,
          hourEnd:
            e.HourEnd === "" || e.HourEnd == null ? null : Number(e.HourEnd),
          minEnd: e.MinuteEnd ? parseInt(e.MinuteEnd, 10) : 0,
          venue: v ? v.Name : "",
        };
      });

    // exhibitions run for the whole festival rather than at a single day/time
    // (most aren't even flagged In_Timetable), so they can't come from the
    // day/hour-based filter above - queried separately, with a pseudo day
    // ("ausstellungen") the client already matches against for that sheet.
    // The "Diverse Artists" entry is a generic CMS placeholder, not a real
    // exhibition, and must not show up here.
    const exhibitionScreenEvents = (events || [])
      .filter(
        (e) =>
          e &&
          e.status === "published" &&
          e.Format === "ausstellungen" &&
          e.Artist !== "Diverse Artists" &&
          e.Venues &&
          e.Venues[0],
      )
      .map((e) => {
        const tr =
          (e.translations && (e.translations[langIdx] || e.translations[0])) ||
          {};
        const v = venuesData[e.Venues[0].Venues_id];
        return {
          day: "ausstellungen",
          format: "ausstellungen",
          subformat: "",
          title: tr.Title || "",
          artist: keepNamesTogether(e.Artist || ""),
          hourStart: null,
          minStart: 0,
          hourEnd: null,
          minEnd: 0,
          venue: v ? v.Name : "",
        };
      })
      .sort(
        (a, b) =>
          a.venue.localeCompare(b.venue) || a.title.localeCompare(b.title),
      );

    res.render("screens", {
      screenEvents: screenEvents.concat(exhibitionScreenEvents),
      language: [language, langIdx],
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

// Printed accordion-fold program (Leporello), A3 landscape, day program without exhibitions
const LEPORELLO_DAYS = [
  { code: "14", labelDE: "Mittwoch", labelEN: "Wednesday", date: "14.10.2026" },
  {
    code: "15",
    labelDE: "Donnerstag",
    labelEN: "Thursday",
    date: "15.10.2026",
  },
  { code: "16", labelDE: "Freitag", labelEN: "Friday", date: "16.10.2026" },
  { code: "17", labelDE: "Samstag", labelEN: "Saturday", date: "17.10.2026" },
  { code: "18", labelDE: "Sonntag", labelEN: "Sunday", date: "18.10.2026" },
];

function leporelloPad(n) {
  return (n < 10 ? "0" : "") + n;
}
// Hand-picked leporello title/artist texts that need a forced line break. Key
// is the CMS text (whitespace-insensitive), value is the text to break after -
// a "\n" is inserted there and rendered via white-space:pre-line on
// .c-title/.c-artist.
const LEPORELLO_BREAKS = {
  "Mesh 2026: Infrastructures of Care": "Mesh 2026:",
};
function leporelloBreak(str) {
  if (!str) return str;
  const key = str.replace(/\s+/g, " ").trim();
  const breakAfter = LEPORELLO_BREAKS[key];
  if (!breakAfter || key.indexOf(breakAfter) !== 0) return str;
  return breakAfter + "\n" + key.slice(breakAfter.length).trim();
}
// Keeps each name in an artist list ("Anna Puigjaner & Ethel Baraona Pohl,
// Teresa Dillon") from wrapping between its first and last name: joins the
// words within each comma/&-separated name with a non-breaking space, but
// leaves the separators themselves as normal breakable spaces, so the line
// still wraps between different people. A name only breaks internally if it
// alone is wider than the column - overflow-wrap on the table cell still
// applies as a fallback then. Used wherever an artist list is rendered as a
// table cell (leporello, screens).
function keepNamesTogether(str) {
  if (!str) return str;
  return str
    .split(/(\s*[,&]\s*)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      // a first+last name longer than 30 characters together is left with
      // normal breakable spaces, so it can wrap instead of forcing the
      // whole cell to overflow.
      if (part.trim().length > 30) return part;
      return part.replace(/ /g, " ");
    })
    .join("");
}
function leporelloFormatTime(hourStart, minStart, hourEnd, minEnd) {
  var s = leporelloPad(hourStart % 24) + ":" + leporelloPad(minStart);
  if (hourEnd != null && !isNaN(hourEnd)) {
    s +=
      " – " +
      leporelloPad(Math.floor(hourEnd) % 24) +
      ":" +
      leporelloPad(minEnd);
  }
  return s;
}

// known format labels for section pills; any other CMS format value still
// gets a section, just labelled with its raw slug (see buildSections below) -
// this way a format never silently drops off the leporello if the CMS
// introduces a new one or spells an existing one differently (e.g. "workshop"
// vs "workshops"). Wording mirrors the DE/EN dictionaries used for
// event.formatTranslation in the /events/:eventSlug route.
const LEPORELLO_FORMAT_LABEL_DE = {
  performances: "Performances",
  screenings: "Screenings",
  konferenz: "Konferenz",
  workshop: "Workshop",
  workshops: "Workshops",
  satellite: "Satellite",
  diskurs: "Talks & Panels",
  clubnights: "Club Nights",
  opening: "Opening",
  welcoming: "Welcome",
  guided_tour: "Rundgang",
};
const LEPORELLO_FORMAT_LABEL_EN = {
  performances: "Performances",
  screenings: "Screenings",
  konferenz: "Conference",
  workshop: "Workshop",
  workshops: "Workshops",
  satellite: "Satellite",
  diskurs: "Talks & Panels",
  clubnights: "Club Nights",
  opening: "Opening",
  welcoming: "Welcome",
  guided_tour: "Guided Tour",
};

// fixed section order requested for the leporello (not chronological); any
// format not listed here falls back to sorting by its first start time so
// it still shows up rather than disappearing.
const LEPORELLO_FORMAT_ORDER = [
  "welcoming",
  "konferenz",
  "performances",
  "screenings",
  "workshop",
  "workshops",
  "satellite",
  "guided_tour",
  "clubnights",
];

app.get("/leporello/:language?", async function (req, res) {
  try {
    const language = req.params.language || "de";
    const langIdx = languageTransform(language);

    const [, venuesResult] = await Promise.all([
      getAllEvents(), // populates the module-level `events` (cached)
      getVenues(),
    ]);
    const venuesData = (venuesResult && venuesResult.data) || [];

    const leporelloEvents = (events || [])
      .filter(
        (e) =>
          e &&
          e.status === "published" &&
          e.In_Timetable &&
          e.Timetable_only !== "1" &&
          e.Format &&
          e.Format !== "ausstellungen" &&
          e.Venues &&
          e.Venues[0] &&
          e.Day &&
          e.Hour !== "" &&
          e.Hour != null,
      )
      .map((e) => {
        const tr =
          (e.translations && (e.translations[langIdx] || e.translations[0])) ||
          {};
        const v = venuesData[e.Venues[0].Venues_id];
        const hourStart = parseInt(e.Hour, 10) || 0;
        const minStart = e.Minute ? parseInt(e.Minute, 10) : 0;
        const hourEnd =
          e.HourEnd === "" || e.HourEnd == null ? null : Number(e.HourEnd);
        const minEnd = e.MinuteEnd ? parseInt(e.MinuteEnd, 10) : 0;
        return {
          day: String(e.Day),
          format: e.Format,
          time: leporelloFormatTime(hourStart, minStart, hourEnd, minEnd),
          sortKey: hourStart * 60 + minStart,
          title: leporelloBreak(tr.Title || ""),
          artist: keepNamesTogether(leporelloBreak(e.Artist || "")),
          venue: v ? v.Name : "",
        };
      });

    const leporelloFormatLabel =
      langIdx === 1 ? LEPORELLO_FORMAT_LABEL_EN : LEPORELLO_FORMAT_LABEL_DE;

    const buildSections = (dayCode) => {
      const byFormat = {};
      leporelloEvents
        .filter((ev) => ev.day === dayCode)
        .forEach((ev) => {
          (byFormat[ev.format] = byFormat[ev.format] || []).push(ev);
        });
      return Object.keys(byFormat)
        .map((fmt) => {
          const items = byFormat[fmt].sort((a, b) => a.sortKey - b.sortKey);
          const rank = LEPORELLO_FORMAT_ORDER.indexOf(fmt);
          return {
            label: leporelloFormatLabel[fmt] || fmt,
            items,
            rank: rank === -1 ? LEPORELLO_FORMAT_ORDER.length : rank,
            firstStart: items[0].sortKey,
          };
        })
        .sort((a, b) => a.rank - b.rank || a.firstStart - b.firstStart);
    };

    const buildDayBlock = (day) =>
      day && {
        label: langIdx === 1 ? day.labelEN : day.labelDE,
        date: day.date,
        sections: buildSections(day.code),
      };

    // exhibitions run for the whole festival rather than at a single day/time,
    // so they get their own list (no time column) instead of being repeated
    // across every day panel.
    // id 241 ("diverse-artists-ausstellung") is a generic CMS placeholder
    // entry, not a real exhibition - it must not show up in the leporello.
    const LEPORELLO_EXHIBITION_EXCLUDE_IDS = [241];
    const buildExhibitionBlock = () => {
      const seenIds = {};
      const items = (events || [])
        .filter((e) => {
          if (
            !e ||
            e.status !== "published" ||
            e.Format !== "ausstellungen" ||
            !e.Venues ||
            !e.Venues[0] ||
            LEPORELLO_EXHIBITION_EXCLUDE_IDS.includes(e.id) ||
            seenIds[e.id]
          ) {
            return false;
          }
          seenIds[e.id] = true;
          return true;
        })
        .map((e) => {
          const tr =
            (e.translations &&
              (e.translations[langIdx] || e.translations[0])) ||
            {};
          const v = venuesData[e.Venues[0].Venues_id];
          return {
            title: leporelloBreak(tr.Title || ""),
            artist: keepNamesTogether(leporelloBreak(e.Artist || "")),
            venue: v ? v.Name : "",
          };
        })
        .sort(
          (a, b) =>
            a.venue.localeCompare(b.venue) || a.title.localeCompare(b.title),
        );

      return {
        label: langIdx === 1 ? "Exhibitions" : "Ausstellungen",
        note:
          langIdx === 1
            ? "Open Wednesday – Sunday, 14:00 – 17:00"
            : "Geöffnet Mittwoch – Sonntag, jeweils 14:00 – 17:00",
        isExhibition: true,
        items,
      };
    };

    // one continuous, ordered stream of rows for all 5 days (day heading,
    // then that day's section pills and events, then straight on to the
    // next day's heading) - the client flows this across the 5 day panels
    // (front 1-4 + back 1) itself, breaking wherever a panel actually runs
    // out of room instead of pinning one day per panel, so e.g. Thursday
    // continues directly under Wednesday and spills into the next column
    // mid-day if it has to. See layoutFlow() in leporello.pug.
    const leporelloEmptyLabel = langIdx === 1 ? "No entries" : "Kein Eintrag";

    const flowRows = [];
    LEPORELLO_DAYS.forEach((day) => {
      const block = buildDayBlock(day);
      flowRows.push({ type: "day", label: block.label });
      if (!block.sections.length) {
        flowRows.push({ type: "empty", label: leporelloEmptyLabel });
      } else {
        block.sections.forEach((section) => {
          flowRows.push({ type: "section", label: section.label });
          section.items.forEach((item) => {
            flowRows.push({
              type: "event",
              time: item.time,
              title: item.title,
              artist: item.artist,
              venue: item.venue,
            });
          });
        });
      }
    });

    // sheet is 630mm wide - 6 panels of 105mm each. The front sheet is pure
    // day flow, all 6 panels. The back sheet's panels 1-2 and 4-6 are pure
    // artwork (title/sponsors resp. site map + wordmark) baked into
    // MESH-LEPORELLO-RS(-EN).png, which is rendered full-bleed as the
    // sheet's own background - those panels get no block/flow content of
    // their own, just null (blank pug branch), so the artwork shows
    // through. Both the front (VS) and back (RS) artwork have an EN
    // variant for the language-dependent text baked into them.
    // Exhibitions get their own dedicated panel (back, panel 3) - they run
    // the whole festival rather than on one day, so they don't belong in
    // the day flow.
    const vsImage =
      langIdx === 1 ? "MESH-LEPORELLO-VS-EN.png" : "MESH-LEPORELLO-VS.png";
    const rsImage =
      langIdx === 1 ? "MESH-LEPORELLO-RS-EN.png" : "MESH-LEPORELLO-RS.png";

    const leporelloLabels = {
      pageTitle:
        langIdx === 1 ? "Mesh – Programme Leporello" : "Mesh – Programm Leporello",
      toolbarInfo:
        langIdx === 1
          ? "Leporello · 630×297mm landscape · zigzag fold · 6 panels per sheet"
          : "Leporello · 630×297mm quer · Zickzackfalz · 6 Panels je Seite",
      print: langIdx === 1 ? "Print" : "Drucken",
      emptyEntry: leporelloEmptyLabel,
    };

    const sheets = [
      [
        { isFlow: true, flowIndex: 0 },
        { isFlow: true, flowIndex: 1 },
        { isFlow: true, flowIndex: 2 },
        { isFlow: true, flowIndex: 3 },
        { isFlow: true, flowIndex: 4 },
        { isFlow: true, flowIndex: 5 },
      ],
      [
        null,
        null,
        { blocks: [buildExhibitionBlock()] },
        null,
        null,
        null,
      ],
    ];

    res.render("leporello", {
      sheets,
      flowRows,
      vsImage,
      rsImage,
      labels: leporelloLabels,
      language: [language, langIdx],
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Startpage
async function getStartpage() {
  return cached(
    "startpage",
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Startpage?fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    shallowCloneStartpage,
  );
}

//Startpage Slider
async function getSlides() {
  return cached(
    "slides",
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Slides_Startpage?fields[]=*.*&fields[]=Link.item:Events.slug",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    true, // route handler mutates slide objects in place
  );
}

// shared by "/" (startpage) and "/civic" (on-site display, same content
// minus the hamburger/pagination chrome) - both render the same CMS data,
// just through a different template.
async function buildStartpageLocals(req) {
  var pathname = req.originalUrl;
  var language = req.params.language || "de";

  var [result, navigation, footer, highlights, slidesResult] =
    await Promise.all([
      getStartpage(),
      getNavigation(),
      getFooter(),
      getHighlights(),
      getSlides(),
    ]);

  var languageObject = [language, languageTransform(language)];

  result.data.pathname = langRemove(pathname);
  result.data.translations = result.data.title;

  if (result.data.translations && result.data.translations.length > 0) {
    if (result.data.translations[0].languages_code.code !== "de") {
      var deContent = result.data.translations[1];
      result.data.translations[1] = result.data.translations[0];
      result.data.translations[0] = deContent;
    }
  }

  var translation = result.data.translations
    ? result.data.translations[languageObject[1]]
    : null;

  var slideLangCode = function (translation) {
    if (!translation) return null;
    return translation.languages_code && translation.languages_code.code
      ? translation.languages_code.code
      : translation.languages_code;
  };

  var slides = ((slidesResult && slidesResult.data) || [])
    .filter((slide) => slide.status === "published" && slide.File)
    .map((slide) => {
      if (slide.translations && slide.translations.length > 1) {
        if (slideLangCode(slide.translations[0]) !== "de") {
          var deSlide = slide.translations[1];
          slide.translations[1] = slide.translations[0];
          slide.translations[0] = deSlide;
        }
      }
      var eventLink =
        slide.Link &&
        slide.Link[0] &&
        slide.Link[0].collection === "Events" &&
        slide.Link[0].item &&
        slide.Link[0].item.slug
          ? slide.Link[0].item.slug
          : null;
      slide.eventSlug = eventLink;
      return slide;
    })
    .sort((a, b) => {
      var sortA = a.sort === null || a.sort === undefined ? 0 : a.sort;
      var sortB = b.sort === null || b.sort === undefined ? 0 : b.sort;
      return sortA - sortB;
    });

  var mapLogos = (entries) =>
    (entries || [])
      .map((entry) => entry.directus_files_id)
      .filter((file) => file)
      .map((file) => ({
        src: "https://env-9468449.appengine.flow.ch/assets/" + file.id,
        href: file.description || null,
        title: file.title || file.filename_download || "",
        tags: file.tags || [],
      }));

  return {
    data: result.data,
    navigation: navigation.data,
    footer: footer.data,
    highlights: highlights.data,
    language: languageObject,
    events: [],
    venues: [],
    slides: slides,
    format: [],
    initiative: translation ? translation.Logos_Line_1_Title : null,
    sponsor: translation ? translation.Logos_Line_2_Title : null,
    logosLine1: mapLogos(result.data.Logos_Line_1),
    logosLine2: mapLogos(result.data.Logos_Line_2),
    logosLine3: result.data.Logos_Line_3 || null,
    logosLine3Title: translation ? translation.Logos_Line_3_Title : null,
    newsContent:
      result.data.Show_News && translation ? translation.News : null,
  };
}

// On-site display page for a large screen: same content as the startpage,
// primarily showing the slider, without the (mobile-only) hamburger menu
// or the slider's pagination dots - registered before the "/:language?"
// catch-all below so "/civic" isn't swallowed as a language code.
app.get("/civic/:language?", async function (req, res) {
  try {
    const locals = await buildStartpageLocals(req);
    res.render("civic", locals);
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

app.get("/:language?", async function (req, res) {
  try {
    const locals = await buildStartpageLocals(req);
    res.render("startpage", locals);
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

function dateformat(dateIn) {
  var dateUnix = Date.parse(dateIn);
  var time = dateIn.split("-")[2].substring(3, 5) + ":" + dateIn.split(":")[1];

  return (
    new Date(dateUnix).toLocaleDateString("en-us", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " / " +
    time
  );
}
function dateformat_de(dateIn) {
  var dateUnix = Date.parse(dateIn);
  var time = dateIn.split("-")[2].substring(3, 5) + ":" + dateIn.split(":")[1];

  return (
    new Date(dateUnix).toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " / " +
    time
  );
}

//404
app.all("*", (req, res) => {
  res.redirect("/");
});
